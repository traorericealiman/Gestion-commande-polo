"""Logique métier des commandes.

Les vues restent minces : elles valident l'entrée (serializers) puis
appellent les fonctions de ce module.
"""

import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from apps.catalogue.services import quantite_restante
from apps.core.exceptions import TransitionInterdite

from .models import Commande, Evenement
from .statuts import TRANSITIONS, Acteur, Action

logger = logging.getLogger(__name__)


class StockInsuffisant(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Stock insuffisant pour au moins une ligne de cette commande."
    default_code = "stock_insuffisant"


def generer_code_suivi(commande: Commande) -> str:
    """Code lisible et unique, ex. POLO-2026-0042 (basé sur l'id en base)."""
    return f"POLO-{commande.date_creation:%Y}-{commande.pk:04d}"


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

    transaction.on_commit(lambda: notifier_changement_statut(commande.pk))
    return commande


def notifier_changement_statut(commande_id: int) -> None:
    """Envoie l'email correspondant au nouveau statut (cahier §7).

    À IMPLÉMENTER (équipe back-end) : choisir le gabarit selon le statut,
    remplacer les variables {code}, {prénom}, {motif}..., mettre le code de
    suivi dans l'objet, réessayer 3 fois en cas d'échec.
    """
    logger.info("Notification email à implémenter (commande id=%s)", commande_id)
