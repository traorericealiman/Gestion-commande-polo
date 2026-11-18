"""Endpoints des commandes.

Statut de chaque endpoint :
  [FAIT]       codé et testé
  [À FAIRE]    contrat (entrée / sortie) défini, renvoie 501 pour l'instant.
               Le front peut déjà s'appuyer sur la forme décrite dans /api/docs/.
"""

from django.db.models import Case, IntegerField, Value, When
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.exceptions import NonImplemente
from apps.core.permissions import EstTresoriereOuAdmin

from . import serializers as s
from .filters import CommandeFilter
from .models import Commande
from .services import appliquer_transition
from .statuts import Action, Statut

# ==========================================================================
# PUBLIC
# ==========================================================================


class CommandeCreationView(APIView):
    """[À FAIRE] Enregistre une commande au statut EN_ATTENTE.

    Étapes attendues (dans une transaction) :
      1. refuser si les ventes sont fermées (VentesFermees) ;
      2. vérifier quantité ≤ ParametresVente.quantite_max_par_ligne et taille non épuisée ;
      3. calculer les prix avec catalogue.services.prix_unitaire (jamais depuis le client) ;
      4. créer Commande, LigneCommande(s), Paiement, Capture (empreinte SHA-256) ;
      5. générer le code de suivi (services.generer_code_suivi) ;
      6. créer l'Evenement SOUMETTRE et envoyer l'accusé de réception.
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
        raise NonImplemente()


class SuiviView(APIView):
    """[À FAIRE] Renvoie l'état d'une commande à partir du code ET de l'email.
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
        raise NonImplemente()


class RenvoiCaptureView(APIView):
    """[À FAIRE] L'acheteur renvoie une capture quand sa commande est « À corriger ».
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
        raise NonImplemente()


# ==========================================================================
# GESTION (trésorières / administrateur)
# ==========================================================================


class CommandeListeView(generics.ListAPIView):
    """[FAIT] Liste paginée, filtrable et cherchable.

    Tri par défaut : commandes en attente d'abord, puis les autres ; dans
    chaque groupe, de la plus ancienne à la plus récente. `?ordering=` le remplace.
    """

    permission_classes = [EstTresoriereOuAdmin]
    serializer_class = s.CommandeListeSerializer
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

    @extend_schema(tags=["Gestion"], summary="Lister les commandes")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class CommandeDetailView(APIView):
    """[À FAIRE] Fiche complète d'une commande, avec alertes calculées :
    même empreinte de capture ou même référence de transaction sur une autre
    commande, stock insuffisant."""

    permission_classes = [EstTresoriereOuAdmin]

    @extend_schema(tags=["Gestion"], summary="Fiche d'une commande", responses=s.CommandeDetailSerializer)
    def get(self, request, pk):
        raise NonImplemente()

    @extend_schema(
        tags=["Gestion"],
        summary="Modifier la note interne",
        request=s.NoteInterneSerializer,
        responses=s.CommandeDetailSerializer,
    )
    def patch(self, request, pk):
        raise NonImplemente()


class CaptureTelechargementView(APIView):
    """[À FAIRE] Renvoie le fichier de la capture actuelle (FileResponse),
    uniquement aux gestionnaires. Journaliser l'accès."""

    permission_classes = [EstTresoriereOuAdmin]

    @extend_schema(
        tags=["Gestion"],
        summary="Télécharger la capture de paiement",
        responses={(200, "application/octet-stream"): OpenApiResponse(description="Fichier JPG, PNG ou PDF")},
    )
    def get(self, request, pk):
        raise NonImplemente()


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
    """[À FAIRE] Compteurs par statut, montants, stock par combinaison."""

    permission_classes = [EstTresoriereOuAdmin]

    @extend_schema(tags=["Gestion"], summary="Tableau de bord", responses=s.TableauDeBordSerializer)
    def get(self, request):
        raise NonImplemente()


class ExportView(APIView):
    """[À FAIRE] Export CSV de la liste filtrée (mêmes filtres que la liste),
    une ligne par polo commandé. Journaliser l'export."""

    permission_classes = [EstTresoriereOuAdmin]

    @extend_schema(
        tags=["Gestion"],
        summary="Exporter les commandes (CSV)",
        responses={(200, "text/csv"): OpenApiResponse(description="Fichier CSV")},
    )
    def get(self, request):
        raise NonImplemente()
