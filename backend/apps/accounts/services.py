"""Réinitialisation du mot de passe des gestionnaires par email.

1. `demander_reinitialisation(email)` : si un compte actif correspond, envoie un
   lien `FRONTEND_URL + FRONTEND_ROUTE_REINITIALISATION ?uid=...&token=...`.
   La réponse de l'API est la même que le compte existe ou non.
2. `reinitialiser_mot_de_passe(utilisateur, mot_de_passe)` : enregistre le
   nouveau mot de passe et ferme toutes les sessions ouvertes.

Le jeton est celui de Django (`default_token_generator`) : il dépend du mot de
passe actuel et de la dernière connexion, il ne sert donc qu'une fois, et il
expire après `PASSWORD_RESET_TIMEOUT` secondes.
"""

import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.core.emails import html_vers_texte

from .models import User

logger = logging.getLogger(__name__)

OBJET_EMAIL = "Réinitialisation de votre mot de passe"


def _duree_validite() -> str:
    minutes = settings.PASSWORD_RESET_TIMEOUT // 60
    if minutes % 60 == 0:
        heures = minutes // 60
        return f"{heures} heure{'s' if heures > 1 else ''}"
    return f"{minutes} minutes"


def lien_reinitialisation(utilisateur: User) -> str:
    parametres = urlencode(
        {
            "uid": urlsafe_base64_encode(force_bytes(utilisateur.pk)),
            "token": default_token_generator.make_token(utilisateur),
        }
    )
    return f"{settings.FRONTEND_URL.rstrip('/')}{settings.FRONTEND_ROUTE_REINITIALISATION}?{parametres}"


def demander_reinitialisation(email: str) -> None:
    """Envoie le lien si un compte actif correspond. Ne dit jamais si le compte existe."""
    utilisateur = User.objects.filter(email__iexact=email.strip(), is_active=True).first()
    if utilisateur is None or not utilisateur.has_usable_password():
        return

    contexte = {
        "utilisateur": utilisateur,
        "lien": lien_reinitialisation(utilisateur),
        "duree_validite": _duree_validite(),
        "objet": OBJET_EMAIL,
    }
    try:
        corps_html = render_to_string("emails/reinitialisation_mot_de_passe.html", contexte)
        send_mail(
            OBJET_EMAIL, html_vers_texte(corps_html), None, [utilisateur.email], html_message=corps_html
        )
    except Exception as exc:  # SMTP indisponible... la personne pourra refaire une demande
        # Pas de exc_info : le message SMTP peut contenir l'adresse email.
        logger.error(
            "Email de réinitialisation non envoyé (utilisateur id=%s, %s)", utilisateur.pk, type(exc).__name__
        )
        return
    logger.info("Lien de réinitialisation envoyé (utilisateur id=%s)", utilisateur.pk)


def utilisateur_du_lien(uid: str, token: str) -> User | None:
    """Renvoie le compte si le lien est valide, sinon None."""
    try:
        pk = force_str(urlsafe_base64_decode(uid))
        utilisateur = User.objects.get(pk=pk, is_active=True)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None
    if not default_token_generator.check_token(utilisateur, token):
        return None
    return utilisateur


def reinitialiser_mot_de_passe(utilisateur: User, mot_de_passe: str) -> None:
    """Enregistre le nouveau mot de passe et déconnecte toutes les sessions."""
    utilisateur.set_password(mot_de_passe)
    utilisateur.save(update_fields=["password"])
    jetons = OutstandingToken.objects.filter(user=utilisateur).exclude(blacklistedtoken__isnull=False)
    BlacklistedToken.objects.bulk_create([BlacklistedToken(token=jeton) for jeton in jetons])
    logger.info("Mot de passe réinitialisé (utilisateur id=%s)", utilisateur.pk)
