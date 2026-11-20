"""Tests de POST /api/v1/suivi/ (suivre sa commande)."""

from django.urls import reverse

from apps.catalogue.models import ParametresVente
from apps.commandes.statuts import MotifRefus, Statut

from .fabriques import creer_commande
from .test_api import BaseAPITest


class SuiviTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.commande = creer_commande(email="acheteur@test.ci")

    def suivre(self, code=None, email="acheteur@test.ci"):
        return self.client.post(
            reverse("suivi"), {"code_suivi": code or self.commande.code_suivi, "email": email}, format="json"
        )

    def passer_au_statut(self, statut, **champs):
        # Raccourci de test : en production, un statut ne change que via appliquer_transition.
        type(self.commande).objects.filter(pk=self.commande.pk).update(statut=statut, **champs)

    def test_bon_couple_code_email(self):
        reponse = self.suivre()

        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertEqual(reponse.data["code_suivi"], self.commande.code_suivi)
        self.assertEqual(reponse.data["statut"], Statut.EN_ATTENTE)
        self.assertEqual(reponse.data["statut_libelle"], "En attente de vérification")
        self.assertEqual(reponse.data["montant_total"], 8000)
        self.assertEqual(len(reponse.data["lignes"]), 1)
        self.assertEqual(reponse.data["lignes"][0]["prix_ligne"], 8000)
        self.assertIsNone(reponse.data["retrait"])
        self.assertFalse(reponse.data["peut_renvoyer_capture"])
        self.assertEqual(reponse.data["motif_libelle"], "")

    def test_insensible_a_la_casse_et_aux_espaces(self):
        reponse = self.suivre(code=f"  {self.commande.code_suivi.lower()} ", email="ACHETEUR@Test.ci")
        self.assertEqual(reponse.status_code, 200, reponse.data)

    def test_mauvais_email_et_code_inconnu_meme_reponse(self):
        mauvais_email = self.suivre(email="autre@test.ci")
        code_inconnu = self.suivre(code="POLO-2026-9999")

        self.assertEqual(mauvais_email.status_code, 404)
        self.assertEqual(code_inconnu.status_code, 404)
        self.assertEqual(mauvais_email.data, code_inconnu.data)
        self.assertEqual(mauvais_email.data["code"], "not_found")

    def test_email_d_une_autre_commande_refuse(self):
        autre = creer_commande(email="autre@test.ci")
        self.assertEqual(self.suivre(code=autre.code_suivi).status_code, 404)

    def test_champs_obligatoires(self):
        reponse = self.client.post(reverse("suivi"), {}, format="json")
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(set(reponse.data["erreurs"]), {"code_suivi", "email"})

    def test_retrait_visible_seulement_quand_polo_disponible(self):
        parametres = ParametresVente.charger()
        parametres.lieu_retrait = "Bureau du BDE"
        parametres.horaires_retrait = "Lundi au vendredi, 12 h - 14 h"
        parametres.contact_retrait = "0102030405"
        parametres.save()

        self.passer_au_statut(Statut.VALIDEE)
        self.assertIsNone(self.suivre().data["retrait"])

        self.passer_au_statut(Statut.POLO_DISPONIBLE)
        self.assertEqual(
            self.suivre().data["retrait"],
            {"lieu": "Bureau du BDE", "horaires": "Lundi au vendredi, 12 h - 14 h", "contact": "0102030405"},
        )

    def test_a_corriger_peut_renvoyer_capture(self):
        self.passer_au_statut(
            Statut.A_CORRIGER,
            motif=MotifRefus.CAPTURE_ILLISIBLE,
            commentaire="Capture floue, merci de renvoyer.",
        )
        reponse = self.suivre()

        self.assertTrue(reponse.data["peut_renvoyer_capture"])
        self.assertEqual(reponse.data["statut_libelle"], "À corriger")
        self.assertEqual(reponse.data["motif_libelle"], "Capture illisible")
        self.assertEqual(reponse.data["commentaire"], "Capture floue, merci de renvoyer.")

    def test_refusee_affiche_le_motif(self):
        self.passer_au_statut(Statut.REFUSEE, motif=MotifRefus.MONTANT_INSUFFISANT)
        reponse = self.suivre()

        self.assertEqual(reponse.data["motif"], MotifRefus.MONTANT_INSUFFISANT)
        self.assertEqual(reponse.data["motif_libelle"], "Montant insuffisant")
        self.assertFalse(reponse.data["peut_renvoyer_capture"])

    def test_aucune_donnee_interne_exposee(self):
        self.passer_au_statut(Statut.EN_ATTENTE, note_interne="Vérifier avec Wave")
        reponse = self.suivre()

        for champ in ("note_interne", "email", "nom", "id", "paiement"):
            self.assertNotIn(champ, reponse.data)
