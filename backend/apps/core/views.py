from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class SanteView(APIView):
    """Vérifie que l'API et la base répondent (pour la surveillance du site)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        tags=["Technique"],
        summary="État du service",
        responses=inline_serializer("Sante", {"statut": serializers.CharField()}),
    )
    def get(self, request):
        try:
            with connection.cursor() as curseur:
                curseur.execute("SELECT 1")
        except Exception:
            return Response({"statut": "base_indisponible"}, status=503)
        return Response({"statut": "ok"})
