"""Protection de la page de connexion de l'administration Django.

Le formulaire de connexion de `/admin/` n'a, de base, aucune limite d'essais.
On limite les envois du formulaire par adresse IP (même identification que
l'API, réglée par `NUM_PROXIES`), avec le taux `THROTTLE_ADMIN`.
"""

import logging

from django.contrib import admin
from django.http import HttpResponse
from rest_framework.throttling import SimpleRateThrottle

logger = logging.getLogger(__name__)


class LimiteConnexionAdmin(SimpleRateThrottle):
    scope = "admin"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def connexion_admin_limitee(request, extra_context=None):
    """Page de connexion de l'admin, avec limite d'essais sur les envois du formulaire."""
    if request.method == "POST":
        limite = LimiteConnexionAdmin()
        if not limite.allow_request(request, None):
            logger.warning("Connexion admin bloquée : trop d'essais depuis la même adresse")
            reponse = HttpResponse(
                "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
                status=429,
                content_type="text/plain; charset=utf-8",
            )
            attente = limite.wait()
            if attente:
                reponse["Retry-After"] = str(int(attente) + 1)
            return reponse
    return admin.site.login(request, extra_context)
