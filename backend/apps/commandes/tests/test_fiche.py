"""Tests de GET / PATCH /api/v1/gestion/commandes/{id}/ (fiche d'une commande)."""

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from apps.catalogue.models import Stock
from apps.commandes.models import Commande
from apps.commandes.services import appliquer_transition, enregistrer_capture
from apps.commandes.statuts import Action, MotifRefus, Statut

from .fabriques import creer_admin, creer_commande, fichier_png
from .stockage import StockageTemporaireMixin
from .test_api import MOT_DE_PASSE, BaseAPITest

LIGNE_M = dict(modele="LICENCE", version="BRODE", manches="COURTES", taille="M", prix_unitaire=8000)


class FicheTests(StockageTemporaireMixin, BaseAPITest):
    def setUp(self):
        super().setUp()
        self.commande = creer_commande()
        self.se_connecter()

    def url(self, commande=None):
        return reverse("gestion-commande", args=[(commande or self.commande).pk])

    def codes_alertes(self, reponse):
        return [alerte["code"] for alerte in reponse.data["alertes"]]

    # --- Accès -----------------------------------------------------------

    def test_visiteur_non_connecte_401(self):
        self.client.credentials()
        self.assertEqual(self.client.get(self.url()).status_code, 401)

    def test_commande_inexistante_404(self):
        self.assertEqual(self.client.get(reverse("gestion-commande", args=[999999])).status_code, 404)

    # --- Contenu ---------------------------------------------------------

    def test_fiche_complete(self):
        enregistrer_capture(self.commande, fichier_png())
        appliquer_transition(
            self.commande, Action.DEMANDER_COMPLEMENT, auteur=self.tresoriere, motif=MotifRefus.AUTRE
        )

        reponse = self.client.get(self.url())

        self.assertEqual(reponse.status_code, 200)
        donnees = reponse.data
        self.assertEqual(donnees["code_suivi"], self.commande.code_suivi)
        self.assertEqual(donnees["statut"], Statut.A_CORRIGER)
        self.assertEqual(donnees["nombre_polos"], 1)
        self.assertEqual(len(donnees["lignes"]), 1)
        self.assertEqual(donnees["paiement"]["moyen"], "WAVE")
        self.assertEqual(donnees["capture"]["type_mime"], "image/png")
        self.assertEqual(
            donnees["capture"]["url_telechargement"], f"/api/v1/gestion/commandes/{self.commande.pk}/capture/"
        )
        self.assertEqual(donnees["motif"], MotifRefus.AUTRE)
        self.assertEqual(len(donnees["evenements"]), 1)
        self.assertEqual(donnees["evenements"][0]["auteur"], str(self.tresoriere))
        self.assertEqual(donnees["alertes"], [])

    def test_sans_capture(self):
        self.assertIsNone(self.client.get(self.url()).data["capture"])

    def test_autres_commandes_meme_email(self):
        autre = creer_commande(email="ACHETEUR@test.ci")
        creer_commande(email="quelquun@test.ci")

        reponse = self.client.get(self.url())

        self.assertEqual(reponse.data["autres_commandes_meme_email"], [autre.code_suivi])

    # --- Alertes ---------------------------------------------------------

    def test_alerte_capture_deja_utilisee(self):
        autre = creer_commande(email="autre@test.ci")
        enregistrer_capture(autre, fichier_png())
        enregistrer_capture(self.commande, fichier_png("meme-fichier-autre-nom.png"))

        reponse = self.client.get(self.url())

        self.assertEqual(self.codes_alertes(reponse), ["CAPTURE_DEJA_UTILISEE"])
        self.assertEqual(reponse.data["alertes"][0]["commandes_liees"], [autre.code_suivi])

    def test_ancienne_capture_de_la_meme_commande_ne_declenche_rien(self):
        enregistrer_capture(self.commande, fichier_png())
        enregistrer_capture(self.commande, fichier_png())
        self.assertEqual(self.codes_alertes(self.client.get(self.url())), [])

    def test_alerte_reference_deja_utilisee(self):
        autre = creer_commande(email="autre@test.ci")
        for commande in (autre, self.commande):
            commande.paiement.reference_transaction = "TX-123"
            commande.paiement.save()

        reponse = self.client.get(self.url())

        self.assertEqual(self.codes_alertes(reponse), ["REFERENCE_DEJA_UTILISEE"])
        self.assertEqual(reponse.data["alertes"][0]["commandes_liees"], [autre.code_suivi])

    def test_reference_vide_ne_declenche_rien(self):
        creer_commande(email="autre@test.ci")  # référence vide elle aussi
        self.assertEqual(self.codes_alertes(self.client.get(self.url())), [])

    def test_alerte_stock_insuffisant_en_attente(self):
        Stock.objects.create(modele="LICENCE", version="BRODE", manches="COURTES", taille="M", quantite_max=1)
        validee = creer_commande(statut=Statut.VALIDEE, email="autre@test.ci")  # consomme le seul polo

        reponse = self.client.get(self.url())

        self.assertEqual(self.codes_alertes(reponse), ["STOCK_INSUFFISANT"])
        self.assertIn("reste 0", reponse.data["alertes"][0]["message"])
        # Une commande déjà validée n'a pas d'alerte de stock.
        self.assertEqual(self.codes_alertes(self.client.get(self.url(validee))), [])

    def test_stock_additionne_les_lignes_identiques(self):
        Stock.objects.create(modele="LICENCE", version="BRODE", manches="COURTES", taille="M", quantite_max=5)
        commande = creer_commande(lignes=[{**LIGNE_M, "quantite": 3}, {**LIGNE_M, "quantite": 3}])

        reponse = self.client.get(self.url(commande))

        self.assertEqual(self.codes_alertes(reponse), ["STOCK_INSUFFISANT"])

    # --- Actions possibles -----------------------------------------------

    def test_tresoriere_ne_voit_pas_annuler_decision(self):
        commande = creer_commande(statut=Statut.VALIDEE)
        actions = self.client.get(self.url(commande)).data["actions_possibles"]
        self.assertIn(Action.MARQUER_DISPONIBLE, actions)
        self.assertNotIn(Action.ANNULER_DECISION, actions)

    def test_admin_voit_annuler_decision(self):
        admin = creer_admin(password=MOT_DE_PASSE)
        jeton = self.client.post(
            reverse("auth-connexion"), {"email": admin.email, "password": MOT_DE_PASSE}
        ).data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {jeton}")
        commande = creer_commande(statut=Statut.VALIDEE)

        actions = self.client.get(self.url(commande)).data["actions_possibles"]

        self.assertIn(Action.ANNULER_DECISION, actions)

    # --- Performances ----------------------------------------------------

    def test_nombre_de_requetes_independant_de_la_taille(self):
        """Les relations sont chargées en requêtes groupées (pas une requête par ligne)."""
        petite = creer_commande(statut=Statut.VALIDEE, email="a@test.ci")
        enregistrer_capture(petite, fichier_png())
        grosse = creer_commande(
            statut=Statut.VALIDEE,
            email="b@test.ci",
            lignes=[{**LIGNE_M, "taille": taille, "quantite": 1} for taille in ("S", "M", "L", "XL")],
        )
        for _ in range(3):
            enregistrer_capture(grosse, fichier_png())
        for action in (Action.MARQUER_DISPONIBLE, Action.MARQUER_REMIS):
            appliquer_transition(grosse, action, auteur=self.tresoriere)

        with CaptureQueriesContext(connection) as petite_requetes:
            self.client.get(self.url(petite))
        with CaptureQueriesContext(connection) as grosse_requetes:
            self.client.get(self.url(grosse))

        self.assertEqual(len(grosse_requetes), len(petite_requetes))

    # --- Note interne ----------------------------------------------------

    def test_patch_modifie_la_note_interne(self):
        reponse = self.client.patch(self.url(), {"note_interne": "Appeler l'acheteur."}, format="json")

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data["note_interne"], "Appeler l'acheteur.")
        self.commande.refresh_from_db()
        self.assertEqual(self.commande.note_interne, "Appeler l'acheteur.")

    def test_patch_ne_modifie_que_la_note_interne(self):
        self.client.patch(
            self.url(),
            {"note_interne": "ok", "statut": Statut.VALIDEE, "montant_total": 1, "email": "pirate@test.ci"},
            format="json",
        )

        commande = Commande.objects.get(pk=self.commande.pk)
        self.assertEqual(commande.statut, Statut.EN_ATTENTE)
        self.assertEqual(commande.montant_total, 8000)
        self.assertEqual(commande.email, "acheteur@test.ci")
        self.assertFalse(commande.evenements.exists())

    def test_patch_sans_note_400(self):
        self.assertEqual(self.client.patch(self.url(), {}, format="json").status_code, 400)

    def test_patch_visiteur_401(self):
        self.client.credentials()
        reponse = self.client.patch(self.url(), {"note_interne": "x"}, format="json")
        self.assertEqual(reponse.status_code, 401)
