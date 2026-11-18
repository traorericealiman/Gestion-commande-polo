"""Interface Django /admin/ : consultation de secours pour l'administrateur.
Le traitement quotidien des commandes se fait dans le front React (API /gestion/)."""

from django.contrib import admin

from .models import Capture, Commande, Evenement, LigneCommande, Paiement


class LigneInline(admin.TabularInline):
    model = LigneCommande
    extra = 0
    can_delete = False


class PaiementInline(admin.StackedInline):
    model = Paiement
    can_delete = False


class EvenementInline(admin.TabularInline):
    model = Evenement
    extra = 0
    can_delete = False
    readonly_fields = ("action", "statut_avant", "statut_apres", "auteur", "motif", "commentaire", "date")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Commande)
class CommandeAdmin(admin.ModelAdmin):
    list_display = ("code_suivi", "nom", "prenoms", "email", "montant_total", "statut", "date_creation")
    list_filter = ("statut",)
    search_fields = ("code_suivi", "nom", "prenoms", "email")
    # Le statut ne se modifie jamais à la main : passer par l'API (historique).
    readonly_fields = (
        "code_suivi",
        "statut",
        "montant_total",
        "date_creation",
        "date_decision",
        "date_remise",
    )
    inlines = [LigneInline, PaiementInline, EvenementInline]

    def has_delete_permission(self, request, obj=None):
        return False  # aucune suppression de commande (traçabilité)


@admin.register(Capture)
class CaptureAdmin(admin.ModelAdmin):
    list_display = ("commande", "type_mime", "taille_octets", "empreinte", "date_envoi")
    search_fields = ("empreinte", "commande__code_suivi")

    def has_delete_permission(self, request, obj=None):
        return False
