from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.accounts import views as auth
from apps.catalogue.views import CatalogueView
from apps.commandes import views as cmd
from apps.core.admin_securite import connexion_admin_limitee
from apps.core.views import SanteView

admin.site.site_header = "Polo ESATIC : administration"
admin.site.site_title = "Polo ESATIC"

api_v1 = [
    # Technique
    path("sante/", SanteView.as_view(), name="sante"),
    # Public
    path("catalogue/", CatalogueView.as_view(), name="catalogue"),
    path("commandes/", cmd.CommandeCreationView.as_view(), name="commande-creation"),
    path("suivi/", cmd.SuiviView.as_view(), name="suivi"),
    path("suivi/capture/", cmd.RenvoiCaptureView.as_view(), name="suivi-capture"),
    # Authentification
    path("auth/connexion/", auth.ConnexionView.as_view(), name="auth-connexion"),
    path("auth/rafraichir/", auth.RafraichirView.as_view(), name="auth-rafraichir"),
    path("auth/deconnexion/", auth.DeconnexionView.as_view(), name="auth-deconnexion"),
    path("auth/moi/", auth.MoiView.as_view(), name="auth-moi"),
    path(
        "auth/mot-de-passe/oubli/", auth.DemandeReinitialisationView.as_view(), name="auth-mot-de-passe-oubli"
    ),
    path(
        "auth/mot-de-passe/reinitialiser/",
        auth.ReinitialisationView.as_view(),
        name="auth-mot-de-passe-reinitialiser",
    ),
    # Gestion (trésorières / administrateur)
    path("gestion/tableau-de-bord/", cmd.TableauDeBordView.as_view(), name="tableau-de-bord"),
    path("gestion/commandes/", cmd.CommandeListeView.as_view(), name="gestion-commandes"),
    path("gestion/commandes/export/", cmd.ExportView.as_view(), name="gestion-export"),
    path("gestion/commandes/<int:pk>/", cmd.CommandeDetailView.as_view(), name="gestion-commande"),
    path(
        "gestion/commandes/<int:pk>/capture/", cmd.CaptureTelechargementView.as_view(), name="gestion-capture"
    ),
    path("gestion/commandes/<int:pk>/valider/", cmd.vue_valider, name="gestion-valider"),
    path("gestion/commandes/<int:pk>/refuser/", cmd.vue_refuser, name="gestion-refuser"),
    path(
        "gestion/commandes/<int:pk>/demander-complement/",
        cmd.vue_demander_complement,
        name="gestion-demander-complement",
    ),
    path(
        "gestion/commandes/<int:pk>/marquer-disponible/",
        cmd.vue_marquer_disponible,
        name="gestion-marquer-disponible",
    ),
    path("gestion/commandes/<int:pk>/marquer-remis/", cmd.vue_marquer_remis, name="gestion-marquer-remis"),
    path(
        "gestion/commandes/<int:pk>/annuler-decision/",
        cmd.vue_annuler_decision,
        name="gestion-annuler-decision",
    ),
]

urlpatterns = [
    # Avant `admin.site.urls` : la connexion à l'admin passe par la limite d'essais.
    path(f"{settings.ADMIN_URL}login/", connexion_admin_limitee, name="admin-connexion"),
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/v1/", include(api_v1)),
]

if settings.API_DOCS:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    ]
