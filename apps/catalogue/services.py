"""Règles du catalogue réutilisées par les commandes."""

from django.db.models import Sum

from .models import Stock, Tarif


class VarianteInconnue(Exception):
    pass


def prix_unitaire(modele: str, version: str, manches: str) -> int:
    """Prix en vigueur d'une variante. Le prix est TOUJOURS calculé par le
    serveur, jamais reçu du client (cahier RG8)."""
    try:
        return Tarif.objects.get(modele=modele, version=version, manches=manches).prix
    except Tarif.DoesNotExist as exc:
        raise VarianteInconnue(f"Aucun tarif pour {modele}/{version}/{manches}.") from exc


def quantite_restante(modele: str, version: str, manches: str, taille: str) -> int | None:
    """Quantité encore disponible (None = pas de limite).

    Seules les commandes validées (ou au-delà) consomment le stock (RG4).
    """
    from apps.commandes.models import LigneCommande  # import local : évite un cycle
    from apps.commandes.statuts import STATUTS_CONSOMMANT_STOCK

    stock = Stock.objects.filter(modele=modele, version=version, manches=manches, taille=taille).first()
    if stock is None:
        return None
    consomme = (
        LigneCommande.objects.filter(
            modele=modele,
            version=version,
            manches=manches,
            taille=taille,
            commande__statut__in=STATUTS_CONSOMMANT_STOCK,
        ).aggregate(total=Sum("quantite"))["total"]
        or 0
    )
    return max(stock.quantite_max - consomme, 0)
