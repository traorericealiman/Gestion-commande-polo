"""Tests de GET /api/v1/gestion/tableau-de-bord/."""

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from apps.catalogue.models import Stock
from apps.commandes.statuts import Statut

from .fabriques import creer_commande
from .test_api import BaseAPITest


def ligne(taille="M", quantite=1, modele="LICENCE", prix=8000):
    return dict(
        modele=modele,
        version="BRODE",
        manches="COURTES",
        taille=taille,
        quantite=quantite,
        prix_unitaire=prix,
    )


class TableauDeBordTests(BaseAPITest):
    url = reverse("tableau-de-bord")

    def setUp(self):
        super().setUp()
        self.se_connecter()

    def stock(self, reponse, taille, modele="LICENCE"):
        return next(s for s in reponse.data["stocks"] if s["taille"] == taille and s["modele"] == modele)

    def test_visiteur_non_connecte_401(self):
        self.client.credentials()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_base_vide(self):
        reponse = self.client.get(self.url)

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(set(reponse.data["compteurs"]), set(Statut.values))
        self.assertTrue(all(n == 0 for n in reponse.data["compteurs"].values()))
        self.assertEqual(reponse.data["montant_encaisse"], 0)
        self.assertEqual(reponse.data["montant_en_attente"], 0)
        self.assertEqual(reponse.data["stocks"], [])

    def test_chiffres_sur_plusieurs_statuts(self):
        Stock.objects.create(
            modele="LICENCE", version="BRODE", manches="COURTES", taille="M", quantite_max=10
        )
        creer_commande(Statut.EN_ATTENTE, [ligne("M", 2)])  # 16 000 en attente
        creer_commande(Statut.EN_ATTENTE, [ligne("L", 1)])  # 8 000 en attente
        creer_commande(Statut.A_CORRIGER, [ligne("M", 1)])
        creer_commande(Statut.VALIDEE, [ligne("M", 3)])  # 24 000 encaissé
        creer_commande(Statut.POLO_DISPONIBLE, [ligne("M", 1), ligne("L", 1)])  # 16 000 encaissé
        creer_commande(Statut.REMIS, [ligne("M", 2)])  # 16 000 encaissé
        creer_commande(Statut.REFUSEE, [ligne("M", 5)])
        creer_commande(Statut.CLOTUREE, [ligne("M", 4)])

        reponse = self.client.get(self.url)
        donnees = reponse.data

        self.assertEqual(
            donnees["compteurs"],
            {
                "EN_ATTENTE": 2,
                "A_CORRIGER": 1,
                "VALIDEE": 1,
                "POLO_DISPONIBLE": 1,
                "REMIS": 1,
                "REFUSEE": 1,
                "CLOTUREE": 1,
            },
        )
        self.assertEqual(donnees["montant_encaisse"], 24000 + 16000 + 16000)
        self.assertEqual(donnees["montant_en_attente"], 16000 + 8000)

        taille_m = self.stock(reponse, "M")
        # demande : tout sauf refusées et clôturées = 2 + 1 + 3 + 1 + 2
        self.assertEqual(taille_m["demande"], 9)
        # validé : validée, disponible, remis = 3 + 1 + 2
        self.assertEqual(taille_m["valide"], 6)
        self.assertEqual(taille_m["remis"], 2)
        self.assertEqual(taille_m["restant"], 4)

        taille_l = self.stock(reponse, "L")  # pas de ligne Stock = pas de limite
        self.assertEqual((taille_l["demande"], taille_l["valide"], taille_l["remis"]), (2, 1, 0))
        self.assertIsNone(taille_l["restant"])

    def test_stock_sans_commande_apparait(self):
        Stock.objects.create(modele="MASTER", version="BRODE", manches="LONGUES", taille="XL", quantite_max=3)

        stocks = self.client.get(self.url).data["stocks"]

        self.assertEqual(
            stocks,
            [
                {
                    "modele": "MASTER",
                    "version": "BRODE",
                    "manches": "LONGUES",
                    "taille": "XL",
                    "demande": 0,
                    "valide": 0,
                    "remis": 0,
                    "restant": 3,
                }
            ],
        )

    def test_restant_jamais_negatif(self):
        Stock.objects.create(modele="LICENCE", version="BRODE", manches="COURTES", taille="M", quantite_max=1)
        creer_commande(Statut.VALIDEE, [ligne("M", 3)])  # stock baissé après validation

        self.assertEqual(self.stock(self.client.get(self.url), "M")["restant"], 0)

    def test_ordre_du_catalogue(self):
        for taille in ("XL", "S", "M"):
            creer_commande(Statut.EN_ATTENTE, [ligne(taille, 1)])

        tailles = [s["taille"] for s in self.client.get(self.url).data["stocks"]]

        self.assertEqual(tailles, ["S", "M", "XL"])

    def test_nombre_de_requetes_constant(self):
        creer_commande(Statut.EN_ATTENTE, [ligne("M", 1)])
        with CaptureQueriesContext(connection) as peu:
            self.client.get(self.url)

        for i, taille in enumerate(("S", "L", "XL", "XXL") * 3):
            creer_commande(Statut.VALIDEE, [ligne(taille, 1)], email=f"a{i}@test.ci")
        with CaptureQueriesContext(connection) as beaucoup:
            self.client.get(self.url)

        self.assertEqual(len(beaucoup), len(peu))
