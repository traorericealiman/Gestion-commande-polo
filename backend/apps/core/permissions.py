"""Permissions par rôle. Les droits sont TOUJOURS vérifiés ici, côté serveur."""

from rest_framework.permissions import BasePermission


class EstTresoriereOuAdmin(BasePermission):
    """Trésorière ou administrateur actif et connecté."""

    message = "Accès réservé aux trésorières et à l'administrateur."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.est_gestionnaire)


class EstAdmin(BasePermission):
    """Administrateur uniquement (ex. : annuler une décision)."""

    message = "Action réservée à l'administrateur."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.est_admin)
