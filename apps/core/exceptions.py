"""Gestion centralisée des erreurs de l'API.

Format de toutes les erreurs renvoyées au front :
    {"detail": "<message lisible>", "code": "<code_machine>", "erreurs": {...}}

`erreurs` n'est présent que pour les erreurs de validation (champ -> messages).
Une erreur inattendue ne renvoie jamais de détail technique au visiteur :
elle est journalisée côté serveur et le client reçoit un message générique.
"""

import logging

from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


class TransitionInterdite(APIException):
    """Action impossible depuis le statut actuel de la commande."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "Cette action n'est pas possible dans l'état actuel de la commande."
    default_code = "transition_interdite"


class NonImplemente(APIException):
    """Endpoint déclaré dans le contrat d'API mais pas encore codé.

    Le front voit déjà la forme exacte des requêtes / réponses dans /api/docs/.
    """

    status_code = status.HTTP_501_NOT_IMPLEMENTED
    default_detail = "Cet endpoint n'est pas encore disponible."
    default_code = "non_implemente"


class VentesFermees(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Les ventes sont actuellement fermées."
    default_code = "ventes_fermees"


def gestionnaire_exceptions(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        logger.exception("Erreur inattendue sur %s", context.get("view").__class__.__name__)
        return Response(
            {"detail": "Une erreur est survenue. Réessayez plus tard.", "code": "erreur_serveur"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, ValidationError):
        response.data = {
            "detail": "Certaines informations sont invalides.",
            "code": "validation",
            "erreurs": response.data,
        }
    elif isinstance(exc, APIException):
        codes = exc.get_codes()
        response.data = {
            "detail": response.data.get("detail", str(exc.detail))
            if isinstance(response.data, dict)
            else str(exc.detail),
            "code": codes if isinstance(codes, str) else exc.default_code,
        }
    return response
