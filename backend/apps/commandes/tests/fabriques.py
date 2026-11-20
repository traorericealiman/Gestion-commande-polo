"""Fabriques de données de test réutilisables par toute l'équipe."""

from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import User
from apps.commandes.models import Commande, LigneCommande, Paiement
from apps.commandes.services import generer_code_suivi

PNG_MINIMAL = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def creer_tresoriere(email="tresoriere@test.ci", password="MotDePasse-Solide-123"):
    return User.objects.create_user(email=email, password=password, first_name="Awa")


def creer_admin(email="admin@test.ci", password="MotDePasse-Solide-123"):
    return User.objects.create_superuser(email=email, password=password)


def creer_commande(statut="EN_ATTENTE", lignes=None, email="acheteur@test.ci"):
    lignes = lignes or [
        dict(modele="LICENCE", version="BRODE", manches="COURTES", taille="M", quantite=1, prix_unitaire=8000)
    ]
    commande = Commande.objects.create(
        nom="Kouassi",
        prenoms="Jean",
        email=email,
        montant_total=sum(lg["prix_unitaire"] * lg["quantite"] for lg in lignes),
        statut=statut,
    )
    commande.code_suivi = generer_code_suivi(commande)
    commande.save(update_fields=["code_suivi"])
    for ligne in lignes:
        LigneCommande.objects.create(commande=commande, **ligne)
    Paiement.objects.create(commande=commande, moyen="WAVE", numero_envoi="0700000000")
    return commande


def fichier_png(nom="capture.png"):
    return SimpleUploadedFile(nom, PNG_MINIMAL, content_type="image/png")
