"""Logique métier des commandes.

Les vues restent minces : elles valident l'entrée (serializers) puis
appellent les fonctions de ce module.
"""

import logging
import re
import time
from collections import defaultdict
from datetime import timedelta
from html import unescape
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError

from apps.catalogue.models import ParametresVente
from apps.catalogue.services import VarianteInconnue, prix_unitaire, quantite_restante
from apps.core.exceptions import TransitionInterdite, VentesFermees
from apps.core.validators import detecter_type, empreinte_sha256

from .models import Capture, Commande, Evenement, LigneCommande, Paiement
from .statuts import TRANSITIONS, Acteur, Action, Statut

logger = logging.getLogger(__name__)


class StockInsuffisant(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Stock insuffisant pour au moins une ligne de cette commande."
    default_code = "stock_insuffisant"


def generer_code_suivi(commande: Commande) -> str:
    """Code lisible et unique, ex. POLO-2026-0042 (basé sur l'id en base)."""
    return f"POLO-{commande.date_creation:%Y}-{commande.pk:04d}"


# ==========================================================================
# Parcours acheteur
# ==========================================================================


def enregistrer_capture(commande: Commande, fichier) -> Capture:
    """Enregistre une capture de paiement (création de commande et renvoi).

    L'empreinte est calculée avant l'écriture du fichier : son chemin en dépend.
    """
    return Capture.objects.create(
        commande=commande,
        empreinte=empreinte_sha256(fichier),
        type_mime=detecter_type(fichier),
        taille_octets=fichier.size,
        fichier=fichier,
    )


def _verifier_lignes(lignes: list[dict], parametres: ParametresVente) -> None:
    """Quantité maximum et stock restant, par variante.

    Les lignes identiques sont additionnées : deux lignes de 3 polos de la même
    taille comptent pour 6.
    """
    totaux: dict[tuple, int] = defaultdict(int)
    for ligne in lignes:
        totaux[(ligne["modele"], ligne["version"], ligne["manches"], ligne["taille"])] += ligne["quantite"]

    erreurs = []
    for (modele, version, manches, taille), quantite in totaux.items():
        libelle = f"{modele} {version} {manches} {taille}"
        if quantite > parametres.quantite_max_par_ligne:
            erreurs.append(f"{libelle} : {parametres.quantite_max_par_ligne} polos maximum.")
            continue
        restant = quantite_restante(modele, version, manches, taille)
        if restant is not None and quantite > restant:
            erreurs.append(f"{libelle} : taille épuisée ou quantité disponible insuffisante.")
    if erreurs:
        raise ValidationError({"lignes": erreurs})


@transaction.atomic
def creer_commande(donnees: dict) -> Commande:
    """Enregistre une commande au statut EN_ATTENTE à partir des données validées
    par CommandeCreationSerializer. Les prix sont calculés ici, jamais reçus du client."""
    parametres = ParametresVente.charger()
    if not parametres.ventes_ouvertes:
        raise VentesFermees()

    lignes = donnees["lignes"]
    _verifier_lignes(lignes, parametres)
    try:
        prix = [prix_unitaire(ligne["modele"], ligne["version"], ligne["manches"]) for ligne in lignes]
    except VarianteInconnue as exc:
        raise ValidationError({"lignes": ["Ce modèle de polo n'est pas disponible."]}) from exc

    commande = Commande.objects.create(
        nom=donnees["nom"],
        prenoms=donnees["prenoms"],
        email=donnees["email"].lower(),
        montant_total=sum(p * ligne["quantite"] for p, ligne in zip(prix, lignes, strict=True)),
    )
    commande.code_suivi = generer_code_suivi(commande)
    commande.save(update_fields=["code_suivi"])

    LigneCommande.objects.bulk_create(
        LigneCommande(
            commande=commande,
            modele=ligne["modele"],
            version=ligne["version"],
            manches=ligne["manches"],
            taille=ligne["taille"],
            quantite=ligne["quantite"],
            prix_unitaire=p,
        )
        for p, ligne in zip(prix, lignes, strict=True)
    )
    Paiement.objects.create(
        commande=commande,
        moyen=donnees["moyen_paiement"],
        numero_envoi=donnees["numero_envoi"],
        reference_transaction=donnees.get("reference_transaction", ""),
    )
    enregistrer_capture(commande, donnees["capture"])
    Evenement.objects.create(
        commande=commande,
        action=Action.SOUMETTRE,
        statut_avant="",
        statut_apres=Statut.EN_ATTENTE,
    )

    # Accusé de réception, envoyé une fois la commande réellement enregistrée.
    transaction.on_commit(lambda: notifier_changement_statut(commande.pk, Action.SOUMETTRE))
    return commande


def trouver_commande_acheteur(code_suivi: str, email: str) -> Commande:
    """Retrouve la commande d'un acheteur par son code de suivi ET son email.

    Les codes se suivent (POLO-2026-0042) : le code seul ne suffit pas. Le
    message d'erreur est le même quel que soit le champ faux.
    """
    commande = (
        Commande.objects.prefetch_related("lignes")
        .filter(code_suivi__iexact=code_suivi.strip(), email__iexact=email.strip())
        .first()
    )
    if commande is None:
        raise NotFound("Commande introuvable. Vérifiez le code de suivi et l'email.")
    return commande


def donnees_suivi(commande: Commande) -> dict:
    """Ce que l'acheteur voit de sa commande (entrée de SuiviSerializer)."""
    retrait = None
    if commande.statut == Statut.POLO_DISPONIBLE:
        parametres = ParametresVente.charger()
        retrait = {
            "lieu": parametres.lieu_retrait,
            "horaires": parametres.horaires_retrait,
            "contact": parametres.contact_retrait,
        }
    return {
        "code_suivi": commande.code_suivi,
        "statut": commande.statut,
        "statut_libelle": commande.get_statut_display(),
        "montant_total": commande.montant_total,
        "lignes": commande.lignes.all(),
        "date_creation": commande.date_creation,
        "motif": commande.motif,
        "motif_libelle": commande.get_motif_display() if commande.motif else "",
        "commentaire": commande.commentaire,
        "retrait": retrait,
        "peut_renvoyer_capture": commande.statut == Statut.A_CORRIGER,
    }


@transaction.atomic
def renvoyer_capture(code_suivi: str, email: str, capture, reference_transaction: str = "") -> Commande:
    """L'acheteur renvoie une capture quand sa commande est « À corriger ».

    L'ancienne capture est conservée ; la commande repasse EN_ATTENTE via
    appliquer_transition (qui écrit l'historique et déclenche l'email).
    """
    commande = trouver_commande_acheteur(code_suivi, email)
    # Contrôle avant d'écrire le fichier ; appliquer_transition revérifie sous verrou.
    if commande.statut != Statut.A_CORRIGER:
        raise TransitionInterdite()

    enregistrer_capture(commande, capture)
    if reference_transaction:
        Paiement.objects.filter(commande=commande).update(reference_transaction=reference_transaction)
    return appliquer_transition(commande, Action.RENVOYER_CAPTURE)


def _verifier_acteur(transition, auteur):
    if transition.acteur == Acteur.GESTIONNAIRE:
        if auteur is None or not auteur.est_gestionnaire:
            raise PermissionDenied()
    elif transition.acteur == Acteur.ADMIN:
        if auteur is None or not auteur.est_admin:
            raise PermissionDenied("Action réservée à l'administrateur.")


def _verifier_stock(commande: Commande):
    """RG10 : on bloque la validation si une ligne dépasse le stock restant."""
    manquants = []
    for ligne in commande.lignes.all():
        restant = quantite_restante(ligne.modele, ligne.version, ligne.manches, ligne.taille)
        if restant is not None and ligne.quantite > restant:
            manquants.append(str(ligne))
    if manquants:
        raise StockInsuffisant("Stock insuffisant pour : " + ", ".join(manquants) + ".")


@transaction.atomic
def appliquer_transition(
    commande: Commande,
    action: str,
    *,
    auteur=None,
    motif: str = "",
    commentaire: str = "",
) -> Commande:
    """Fait passer une commande d'un statut à un autre, en respectant TRANSITIONS.

    - verrouille la ligne en base (deux trésorières ne peuvent pas décider
      en même temps sur la même commande) ;
    - vérifie le droit de l'auteur, le statut de départ et le motif ;
    - enregistre l'événement dans l'historique ;
    - déclenche l'email après validation de la transaction.
    """
    transition = TRANSITIONS.get(action)
    if transition is None:
        raise ValueError(f"Action inconnue : {action}")

    commande = Commande.objects.select_for_update().get(pk=commande.pk)
    _verifier_acteur(transition, auteur)

    if commande.statut not in transition.depuis:
        raise TransitionInterdite()
    if transition.motif_obligatoire and not motif:
        raise ValidationError({"motif": "Le motif est obligatoire pour cette action."})
    if action == Action.VALIDER:
        _verifier_stock(commande)

    statut_avant = commande.statut
    maintenant = timezone.now()
    commande.statut = transition.vers

    if action in (Action.VALIDER, Action.REFUSER, Action.DEMANDER_COMPLEMENT):
        commande.date_decision = maintenant
        commande.motif = motif
        commande.commentaire = commentaire
    elif action == Action.MARQUER_REMIS:
        commande.date_remise = maintenant
        commande.remis_par = auteur
    elif action == Action.ANNULER_DECISION:
        commande.date_decision = None
        commande.motif = ""
        commande.commentaire = ""
    elif action == Action.RENVOYER_CAPTURE:
        commande.motif = ""
        commande.commentaire = ""

    commande.save()
    Evenement.objects.create(
        commande=commande,
        action=action,
        statut_avant=statut_avant,
        statut_apres=commande.statut,
        auteur=auteur,
        motif=motif,
        commentaire=commentaire,
    )

    transaction.on_commit(lambda: notifier_changement_statut(commande.pk, action))
    return commande


# ==========================================================================
# Emails (cahier §7)
# ==========================================================================

# Action qui vient d'avoir lieu -> (gabarit dans templates/emails/, objet de l'email).
# Le statut seul ne suffit pas : EN_ATTENTE peut venir d'une création, d'un
# renvoi de capture ou d'une annulation de décision.
# ANNULER_DECISION n'envoie volontairement aucun email (décision interne).
EMAILS = {
    Action.SOUMETTRE: ("accuse_reception", "Commande reçue"),
    Action.RENVOYER_CAPTURE: ("capture_recue", "Nouvelle capture reçue"),
    Action.DEMANDER_COMPLEMENT: ("complement_demande", "Action requise : complément demandé"),
    Action.VALIDER: ("commande_validee", "Commande validée"),
    Action.MARQUER_DISPONIBLE: ("polo_disponible", "Votre polo est disponible"),
    Action.MARQUER_REMIS: ("polos_remis", "Polos remis"),
    Action.REFUSER: ("commande_refusee", "Commande refusée"),
    Action.CLOTURER: ("commande_cloturee", "Commande clôturée"),
}
ESSAIS_EMAIL = 3


def _fcfa(montant: int) -> str:
    return f"{montant:,}".replace(",", " ") + " FCFA"


def _contexte_email(commande: Commande) -> dict:
    parametres = ParametresVente.charger()
    date_limite = None
    if commande.date_decision:
        date_limite = timezone.localtime(
            commande.date_decision + timedelta(days=parametres.delai_correction_jours)
        )
    lignes_email = [
        {
            "libelle": f"{ligne.quantite} × Polo {ligne.get_modele_display()} "
            f"{ligne.get_version_display().lower()}, {ligne.get_manches_display().lower()}, "
            f"taille {ligne.taille}",
            "prix": _fcfa(ligne.prix_ligne),
        }
        for ligne in commande.lignes.all()
    ]
    return {
        "commande": commande,
        "lignes_email": lignes_email,
        "montant_total": _fcfa(commande.montant_total),
        "motif_libelle": commande.get_motif_display() if commande.motif else "",
        "parametres": parametres,
        "date_limite": date_limite,
        # Seul le code de suivi va dans l'URL, jamais l'email (donnée personnelle).
        "lien_suivi": f"{settings.FRONTEND_URL.rstrip('/')}{settings.FRONTEND_ROUTE_SUIVI}"
        f"?{urlencode({'code': commande.code_suivi})}",
        "lien_site": settings.FRONTEND_URL,
    }


def _html_vers_texte(html: str) -> str:
    """Version texte de l'email, déduite automatiquement du HTML.

    Envoyée avec le HTML : certaines messageries (ou réglages) n'affichent que
    le texte, et un email sans version texte est plus souvent classé en spam.
    Un seul gabarit à maintenir par email.
    """
    texte = re.sub(r"(?is)<head.*?</head>|<div[^>]*display:none.*?</div>", "", html)
    texte = re.sub(r"\s+", " ", texte)  # en HTML, les retours à la ligne du gabarit ne comptent pas
    texte = re.sub(r'(?i)<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>', r"\2 : \1", texte)
    texte = re.sub(r"(?i)</td>\s*</tr>", "</tr>", texte)
    texte = re.sub(r"(?i)</td>\s*<td[^>]*>", " : ", texte)  # cellules d'une même ligne
    texte = re.sub(r"(?i)</p>|</table>", "\n\n", texte)
    texte = re.sub(r"(?i)<br\s*/?>|</tr>|</td>", "\n", texte)
    texte = unescape(strip_tags(texte))
    lignes = [" ".join(ligne.split()) for ligne in texte.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lignes)).strip() + "\n"


def notifier_changement_statut(commande_id: int, action: str | None = None) -> None:
    """Envoie à l'acheteur l'email qui correspond à l'action qui vient d'avoir lieu.

    Appelée après validation de la transaction (on_commit). Ne lève jamais
    d'exception : un email raté ne doit pas faire échouer la requête. Les logs
    ne contiennent que l'id de la commande, jamais l'adresse email.
    """
    try:
        commande = Commande.objects.prefetch_related("lignes").get(pk=commande_id)
        if action is None:
            dernier = commande.evenements.order_by("-date", "-pk").first()
            action = dernier.action if dernier else None
        if action not in EMAILS:
            return
        gabarit, sujet = EMAILS[action]
        objet = f"[{commande.code_suivi}] {sujet}"
        corps_html = render_to_string(f"emails/{gabarit}.html", {**_contexte_email(commande), "objet": objet})
        corps = _html_vers_texte(corps_html)
    except Exception as exc:
        logger.error("Email non préparé (commande id=%s, %s)", commande_id, type(exc).__name__)
        return

    for essai in range(1, ESSAIS_EMAIL + 1):
        try:
            send_mail(objet, corps, None, [commande.email], html_message=corps_html)
            return
        except Exception as exc:  # SMTP indisponible, adresse refusée...
            if essai == ESSAIS_EMAIL:
                # Pas de exc_info : le message SMTP peut contenir l'adresse email.
                logger.error(
                    "Email non envoyé après %s essais (commande id=%s, %s)",
                    ESSAIS_EMAIL,
                    commande_id,
                    type(exc).__name__,
                )
            else:
                time.sleep(essai)
