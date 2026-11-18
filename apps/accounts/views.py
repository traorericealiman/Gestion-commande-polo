"""Connexion des trésorières et de l'administrateur (JWT).

- POST connexion/   {email, password} -> {access, refresh}
  Message d'erreur unique, que l'email ou le mot de passe soit faux.
  Limité à THROTTLE_LOGIN essais par minute et par adresse IP.
- POST rafraichir/  {refresh} -> {access, refresh}  (le refresh tourne)
- POST deconnexion/ {refresh} -> 204 (le refresh est mis en liste noire)
- GET  moi/         -> profil de l'utilisateur connecté
"""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import DeconnexionSerializer, MoiSerializer


@extend_schema(tags=["Authentification"], summary="Se connecter")
class ConnexionView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


@extend_schema(tags=["Authentification"], summary="Rafraîchir le jeton d'accès")
class RafraichirView(TokenRefreshView):
    pass


class DeconnexionView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Authentification"],
        summary="Se déconnecter",
        request=DeconnexionSerializer,
        responses={204: OpenApiResponse(description="Déconnecté")},
    )
    def post(self, request):
        entree = DeconnexionSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        try:
            RefreshToken(entree.validated_data["refresh"]).blacklist()
        except TokenError:
            pass  # jeton déjà invalide : l'utilisateur est de toute façon déconnecté
        return Response(status=status.HTTP_204_NO_CONTENT)


class MoiView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=["Authentification"], summary="Utilisateur connecté", responses=MoiSerializer)
    def get(self, request):
        return Response(MoiSerializer(request.user).data)
