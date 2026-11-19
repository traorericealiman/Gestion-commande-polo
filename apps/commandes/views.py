"""Endpoints des commandes.

Tous les endpoints sont codés et testés ([FAIT]). Les vues restent minces :
la logique métier est dans services.py.
"""

import logging

from django.db.models import Case, IntegerField, Value, When
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import EstTresoriereOuAdmin

from . import serializers as s
from .filters import CommandeFilter
from .models import Commande
from .services import (
    appliquer_transition,
    capture_actuelle_ou_404,
    creer_commande,
    donnees_suivi,
    ecrire_export_csv,
    fiche_commande,
    modifier_note_interne,
    renvoyer_capture,
    tableau_de_bord,
    trouver_commande_acheteur,
)
from .statuts import Action, Statut

logger = logging.getLogger(__name__)

# ==========================================================================
# PUBLIC
# ==========================================================================


class CommandeCreationView(APIView):
    """[FAIT] Enregistre une commande au statut EN_ATTENTE.

    Toute la logique est dans services.creer_commande : ventes ouvertes,
    quantité maximum et stock par variante, prix calculés par le serveur,
    capture (empreinte SHA-256), code de suivi, historique et accusé de réception.
    """

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "commande"

    @extend_schema(
        tags=["Public"],
        summary="Passer une commande",
        request={"multipart/form-data": s.CommandeCreationSerializer},
        responses={
            201: s.CommandeCreeeSerializer,
            400: OpenApiResponse(description="Données invalides"),
            403: OpenApiResponse(description="Ventes fermées"),
        },
    )
    def post(self, request):
        entree = s.CommandeCreationSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        commande = creer_commande(entree.validated_data)
        return Response(s.CommandeCreeeSerializer(commande).data, status=status.HTTP_201_CREATED)


class SuiviView(APIView):
    """[FAIT] Renvoie l'état d'une commande à partir du code ET de l'email.
    Si le couple ne correspond pas : 404 avec un message générique."""

    permission_classes = [AllowAny]
    throttle_scope = "suivi"

    @extend_schema(
        tags=["Public"],
        summary="Suivre ma commande",
        request=s.SuiviRequeteSerializer,
        responses={200: s.SuiviSerializer, 404: OpenApiResponse(description="Commande introuvable")},
    )
    def post(self, request):
        entree = s.SuiviRequeteSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        commande = trouver_commande_acheteur(**entree.validated_data)
        return Response(s.SuiviSerializer(donnees_suivi(commande)).data)


class RenvoiCaptureView(APIView):
    """[FAIT] L'acheteur renvoie une capture quand sa commande est « À corriger ».
    Crée une nouvelle Capture puis appelle appliquer_transition(RENVOYER_CAPTURE)."""

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "commande"

    @extend_schema(
        tags=["Public"],
        summary="Renvoyer une capture de paiement",
        request={"multipart/form-data": s.RenvoiCaptureSerializer},
        responses={
            200: s.SuiviSerializer,
            404: OpenApiResponse(),
            409: OpenApiResponse(description="Commande pas à corriger"),
        },
    )
    def post(self, request):
        entree = s.RenvoiCaptureSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        commande = renvoyer_capture(**entree.validated_data)
        return Response(s.SuiviSerializer(donnees_suivi(commande)).data)


# ==========================================================================
# GESTION (trésorières / administrateur)
# ==========================================================================


class CommandesGestionMixin:
    """Queryset, filtres, recherche et tri communs à la liste et à l'export :
    le fichier exporté correspond exactement à ce que la trésorière voit."""

    permission_classes = [EstTresoriereOuAdmin]
    filterset_class = CommandeFilter
    search_fields = [
        "code_suivi",
        "nom",
        "prenoms",
        "email",
        "paiement__numero_envoi",
        "paiement__reference_transaction",
    ]
    ordering_fields = ["date_creation", "montant_total", "statut"]

    def get_queryset(self):
        return (
            Commande.objects.select_related("paiement")
            .prefetch_related("lignes")
            .annotate(
                priorite=Case(
                    When(statut=Statut.EN_ATTENTE, then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField(),
                )
            )
            .order_by("priorite", "date_creation")
        )


class CommandeListeView(CommandesGestionMixin, generics.ListAPIView):
    """[FAIT] Liste paginée, filtrable et cherchable.

    Tri par défaut : commandes en attente d'abord, puis les autres ; dans
    chaque groupe, de la plus ancienne à la plus récente. `?ordering=` le remplace.
    """

    serializer_class = s.CommandeListeSerializer

    @extend_schema(tags=["Gestion"], summary="Lister les commandes")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class CommandeDetailView(APIView):
    """[FAIT] Fiche complète d'une commande, avec alertes calculées :
    même empreinte de capture ou même référence de transaction sur une autre
    commande, stock insuffisant. Logique dans services.fiche_commande."""

    permission_classes = [EstTresoriereOuAdmin]

    @extend_schema(tags=["Gestion"], summary="Fiche d'une commande", responses=s.CommandeDetailSerializer)
    def get(self, request, pk):
        return Response(s.CommandeDetailSerializer(fiche_commande(pk, request.user)).data)

    @extend_schema(
        tags=["Gestion"],
        summary="Modifier la note interne",
        description="Seul `note_interne` est modifié ; tout autre champ envoyé est ignoré.",
        request=s.NoteInterneSerializer,
        responses=s.CommandeDetailSerializer,
    )
    def patch(self, request, pk):
        entree = s.NoteInterneSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        modifier_note_interne(pk, entree.validated_data["note_interne"])
        return Response(s.CommandeDetailSerializer(fiche_commande(pk, request.user)).data)


class CaptureTelechargementView(APIView):
    """[FAIT] Renvoie le fichier de la capture actuelle, uniquement aux gestionnaires.

    Le fichier est servi par cette vue authentifiée, jamais par une URL
    publique. Chaque consultation est journalisée (ids uniquement).
    """

    permission_classes = [EstTresoriereOuAdmin]

    @extend_schema(
        tags=["Gestion"],
        summary="Télécharger la capture de paiement",
        responses={
            (200, "application/octet-stream"): OpenApiResponse(description="Fichier JPG, PNG ou PDF"),
            404: OpenApiResponse(description="Commande ou capture introuvable"),
        },
    )
    def get(self, request, pk):
        capture = capture_actuelle_ou_404(pk)
        logger.info("Capture consultée : commande %s par utilisateur %s", pk, request.user.pk)
        extension = capture.fichier.name.rsplit(".", 1)[-1]
        commande = capture.commande
        return FileResponse(
            capture.fichier.open("rb"),
            content_type=capture.type_mime,
            filename=f"capture-{commande.code_suivi or commande.pk}.{extension}",
        )


class ActionCommandeView(APIView):
    """[FAIT] Applique une action de gestion (valider, refuser...).

    Les règles (statut de départ, rôle, motif obligatoire, stock) sont
    toutes dans services.appliquer_transition / statuts.TRANSITIONS.
    """

    permission_classes = [EstTresoriereOuAdmin]
    action_metier: str = ""

    def post(self, request, pk):
        commande = generics.get_object_or_404(Commande, pk=pk)
        entree = s.DecisionSerializer(data=request.data)
        entree.is_valid(raise_exception=True)
        appliquer_transition(
            commande,
            self.action_metier,
            auteur=request.user,
            motif=entree.validated_data.get("motif", ""),
            commentaire=entree.validated_data.get("commentaire", ""),
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


def _vue_action(action, resume, description):
    """Fabrique une vue par action, chacune documentée dans Swagger."""

    def post(self, request, pk):  # nouvelle fonction à chaque appel : schéma propre à l'action
        return ActionCommandeView.post(self, request, pk)

    post = extend_schema(
        tags=["Gestion"],
        operation_id=f"gestion_commande_{action.lower()}",
        summary=resume,
        description=description,
        request=s.DecisionSerializer,
        responses={
            204: OpenApiResponse(description="Action appliquée"),
            400: OpenApiResponse(description="Motif manquant"),
            403: OpenApiResponse(description="Rôle insuffisant"),
            404: OpenApiResponse(description="Commande introuvable"),
            409: OpenApiResponse(description="Statut incompatible ou stock insuffisant"),
        },
    )(post)
    nom = f"Action{action.title().replace('_', '')}View"
    return type(nom, (ActionCommandeView,), {"action_metier": action, "post": post}).as_view()


vue_valider = _vue_action(
    Action.VALIDER, "Valider une commande", "EN_ATTENTE → VALIDEE. Bloqué si stock insuffisant."
)
vue_refuser = _vue_action(
    Action.REFUSER, "Refuser une commande", "EN_ATTENTE → REFUSEE. `motif` obligatoire."
)
vue_demander_complement = _vue_action(
    Action.DEMANDER_COMPLEMENT, "Demander un complément", "EN_ATTENTE → A_CORRIGER. `motif` obligatoire."
)
vue_marquer_disponible = _vue_action(
    Action.MARQUER_DISPONIBLE, "Polo prêt / disponible", "VALIDEE → POLO_DISPONIBLE."
)
vue_marquer_remis = _vue_action(
    Action.MARQUER_REMIS, "Marquer les polos remis", "VALIDEE ou POLO_DISPONIBLE → REMIS."
)
vue_annuler_decision = _vue_action(
    Action.ANNULER_DECISION,
    "Annuler une décision (administrateur)",
    "VALIDEE ou POLO_DISPONIBLE → EN_ATTENTE. Administrateur uniquement, `motif` obligatoire.",
)


class TableauDeBordView(APIView):
    """[FAIT] Compteurs par statut, montants, stock par combinaison.
    Logique dans services.tableau_de_bord (agrégats SQL)."""

    permission_classes = [EstTresoriereOuAdmin]

    @extend_schema(tags=["Gestion"], summary="Tableau de bord", responses=s.TableauDeBordSerializer)
    def get(self, request):
        return Response(s.TableauDeBordSerializer(tableau_de_bord()).data)


class ExportView(CommandesGestionMixin, generics.GenericAPIView):
    """[FAIT] Export CSV de la liste filtrée (mêmes filtres, recherche et tri
    que la liste), une ligne par polo commandé. Export journalisé (ids uniquement)."""

    pagination_class = None

    @extend_schema(
        tags=["Gestion"],
        summary="Exporter les commandes (CSV)",
        description="Mêmes paramètres que la liste (`statut`, `search`, `ordering`...). "
        "Séparateur `;`, encodage UTF-8 avec BOM (s'ouvre directement dans Excel).",
        responses={(200, "text/csv"): OpenApiResponse(description="Fichier CSV, une ligne par polo")},
    )
    def get(self, request):
        commandes = self.filter_queryset(self.get_queryset())
        nom = f"commandes-{timezone.localtime():%Y%m%d-%H%M}.csv"
        reponse = HttpResponse(
            content_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{nom}"'},
        )
        nombre = ecrire_export_csv(commandes, reponse)
        logger.info("Export CSV : %s ligne(s) par utilisateur %s", nombre, request.user.pk)
        return reponse
