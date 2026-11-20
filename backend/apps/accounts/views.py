"""Connexion des trésorières et de l'administrateur (JWT).

- POST connexion/   {email, password} -> {access, refresh}
  Message d'erreur unique, que l'email ou le mot de passe soit faux.
  Limité à THROTTLE_LOGIN essais par minute et par adresse IP.
- POST rafraichir/  {refresh} -> {access, refresh}  (le refresh tourne)
- POST deconnexion/ {refresh} -> 204 (le refresh est mis en liste noire)
- GET  moi/         -> profil de l'utilisateur connecté
- POST mot-de-passe/oubli/          {email} -> 204, que le compte existe ou non
- POST mot-de-passe/reinitialiser/  {uid, token, mot_de_passe} -> 204
  Le lien ne sert qu'une fois ; toutes les sessions ouvertes sont fermées.
"""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import (
    DeconnexionSerializer,
    DemandeReinitialisationSerializer,
    MoiSerializer,
    ReinitialisationSerializer,
)
from .services import demander_reinitialisation, reinitialiser_mot_de_passe


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


class DemandeReinitialisationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mot_de_passe"

    @extend_schema(
        tags=["Authentification"],
        summary="Mot de passe oublié : recevoir un lien par email",
        description=(
            "Répond toujours 204, que l'email corresponde à un compte ou non, pour ne pas révéler "
            "quels comptes existent. Le lien envoyé mène à la page de réinitialisation du front "
            "(`?uid=...&token=...`)."
        ),
        request=DemandeReinitialisationSerializer,
        responses={204: OpenApiResponse(description="Demande prise en compte")},
    )
    def post(self, request):
        entree = DemandeReinitialisationSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        demander_reinitialisation(entree.validated_data["email"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReinitialisationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "mot_de_passe"

    @extend_schema(
        tags=["Authentification"],
        summary="Choisir un nouveau mot de passe",
        description=(
            "`uid` et `token` viennent du lien reçu par email. 400 si le lien est invalide, expiré ou "
            "déjà utilisé (`erreurs.token`), ou si le mot de passe est trop faible (`erreurs.mot_de_passe`). "
            "Après succès, toutes les sessions ouvertes sont fermées : il faut se reconnecter."
        ),
        request=ReinitialisationSerializer,
        responses={204: OpenApiResponse(description="Mot de passe modifié")},
    )
    def post(self, request):
        entree = ReinitialisationSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        reinitialiser_mot_de_passe(
            entree.validated_data["utilisateur"], entree.validated_data["mot_de_passe"]
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
