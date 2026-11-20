from django.contrib import admin

from .models import NumeroDepot, ParametresVente, Stock, Tarif


@admin.register(Tarif)
class TarifAdmin(admin.ModelAdmin):
    list_display = ("modele", "version", "manches", "prix")
    list_editable = ("prix",)
    list_filter = ("modele", "version", "manches")


@admin.register(Stock)
class StockAdmin(admin.ModelAdmin):
    list_display = ("modele", "version", "manches", "taille", "quantite_max")
    list_editable = ("quantite_max",)
    list_filter = ("modele", "version", "manches", "taille")


@admin.register(NumeroDepot)
class NumeroDepotAdmin(admin.ModelAdmin):
    list_display = ("moyen", "numero", "titulaire", "actif")
    list_editable = ("actif",)
    list_filter = ("moyen", "actif")


@admin.register(ParametresVente)
class ParametresVenteAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not ParametresVente.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
