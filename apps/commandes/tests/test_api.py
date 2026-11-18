"""Tests des endpoints déjà codés + garde-fous de sécurité."""

from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.commandes.statuts import Statut

from .fabriques import creer_commande, creer_tresoriere

MOT_DE_PASSE = "MotDePasse-Solide-123"


class BaseAPITest(APITestCase):
    def setUp(self):
        cache.clear()  # remet à zéro les compteurs de throttling
        self.tresoriere = creer_tresoriere(password=MOT_DE_PASSE)

    def se_connecter(self):
        reponse = self.client.post(
            reverse("auth-connexion"), {"email": self.tresoriere.email, "password": MOT_DE_PASSE}
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {reponse.data['access']}")


class PublicTests(BaseAPITest):
    def test_sante(self):
        self.assertEqual(self.client.get(reverse("sante")).data, {"statut": "ok"})

    def test_catalogue_contient_les_8_tarifs(self):
        reponse = self.client.get(reverse("catalogue"))
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(len(reponse.data["tarifs"]), 8)
        self.assertTrue(reponse.data["ventes_ouvertes"])

    def test_endpoints_a_faire_renvoient_501(self):
        self.assertEqual(self.client.post(reverse("suivi"), {}).status_code, 501)


class AuthTests(BaseAPITest):
    def test_connexion_et_profil(self):
        self.se_connecter()
        reponse = self.client.get(reverse("auth-moi"))
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data["role"], "TRESORIERE")

    def test_message_generique_si_identifiants_faux(self):
        mauvais_mdp = self.client.post(
            reverse("auth-connexion"), {"email": self.tresoriere.email, "password": "faux"}
        )
        email_inconnu = self.client.post(
            reverse("auth-connexion"), {"email": "inconnu@test.ci", "password": "faux"}
        )
        self.assertEqual(mauvais_mdp.status_code, 401)
        self.assertEqual(mauvais_mdp.data, email_inconnu.data)


class GestionTests(BaseAPITest):
    def test_gestion_interdite_sans_connexion(self):
        self.assertEqual(self.client.get(reverse("gestion-commandes")).status_code, 401)

    def test_liste_en_attente_en_premier(self):
        validee = creer_commande(statut=Statut.VALIDEE)
        en_attente = creer_commande()
        self.se_connecter()
        reponse = self.client.get(reverse("gestion-commandes"))
        self.assertEqual(reponse.status_code, 200)
        codes = [c["code_suivi"] for c in reponse.data["results"]]
        self.assertEqual(codes, [en_attente.code_suivi, validee.code_suivi])

    def test_recherche_par_code(self):
        commande = creer_commande()
        creer_commande(email="autre@test.ci")
        self.se_connecter()
        reponse = self.client.get(reverse("gestion-commandes"), {"search": commande.code_suivi})
        self.assertEqual(reponse.data["count"], 1)

    def test_valider_via_api(self):
        commande = creer_commande()
        self.se_connecter()
        reponse = self.client.post(reverse("gestion-valider", args=[commande.pk]))
        self.assertEqual(reponse.status_code, 204)
        commande.refresh_from_db()
        self.assertEqual(commande.statut, Statut.VALIDEE)

    def test_refuser_sans_motif_renvoie_400(self):
        commande = creer_commande()
        self.se_connecter()
        reponse = self.client.post(reverse("gestion-refuser", args=[commande.pk]), {})
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.data["code"], "validation")

    def test_transition_interdite_renvoie_409(self):
        commande = creer_commande(statut=Statut.REFUSEE)
        self.se_connecter()
        reponse = self.client.post(reverse("gestion-valider", args=[commande.pk]))
        self.assertEqual(reponse.status_code, 409)
        self.assertEqual(reponse.data["code"], "transition_interdite")


class SchemaTests(BaseAPITest):
    def test_schema_openapi_se_genere(self):
        self.assertEqual(self.client.get(reverse("schema")).status_code, 200)
