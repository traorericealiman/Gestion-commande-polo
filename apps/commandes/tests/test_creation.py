"""Tests de POST /api/v1/commandes/ (passer une commande)."""

import json
import re
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone

from apps.catalogue.models import ParametresVente, Stock, Tarif
from apps.commandes.models import Commande
from apps.commandes.statuts import Action, Statut

from .fabriques import creer_commande, fichier_png
from .test_api import BaseAPITest

LIGNE_LICENCE = {"modele": "LICENCE", "version": "BRODE", "manches": "COURTES", "taille": "M", "quantite": 2}
LIGNE_MASTER = {"modele": "MASTER", "version": "SIMPLE", "manches": "LONGUES", "taille": "L", "quantite": 1}


def donnees(lignes=None, **surcharges):
    d = {
        "nom": "Kouassi",
        "prenoms": "Jean",
        "email": "Jean.Kouassi@Test.ci",
        "email_confirmation": "jean.kouassi@test.ci",
        "lignes": json.dumps(lignes if lignes is not None else [LIGNE_LICENCE, LIGNE_MASTER]),
        "moyen_paiement": "WAVE",
        "numero_envoi": "0700000000",
        "reference_transaction": "TX-123",
        "capture": fichier_png(),
        "confirmation": True,
    }
    d.update(surcharges)
    return d


class CreationCommandeTests(BaseAPITest):
    def envoyer(self, **kwargs):
        return self.client.post(reverse("commande-creation"), donnees(**kwargs), format="multipart")

    # --- Cas nominal ---------------------------------------------------------

    def test_commande_a_plusieurs_lignes(self):
        reponse = self.envoyer()

        self.assertEqual(reponse.status_code, 201, reponse.data)
        # LICENCE BRODE COURTES = 8000 × 2, MASTER SIMPLE LONGUES = 8000 × 1
        self.assertEqual(reponse.data["montant_total"], 24000)
        self.assertEqual(reponse.data["statut"], Statut.EN_ATTENTE)
        self.assertRegex(reponse.data["code_suivi"], r"^POLO-\d{4}-\d{4,}$")
        self.assertEqual(set(reponse.data), {"code_suivi", "statut", "montant_total"})

    def test_tout_est_enregistre_en_base(self):
        reponse = self.envoyer()
        commande = Commande.objects.get(code_suivi=reponse.data["code_suivi"])

        self.assertEqual(commande.email, "jean.kouassi@test.ci")
        self.assertEqual(commande.lignes.count(), 2)
        self.assertEqual(
            sorted((lg.modele, lg.quantite, lg.prix_unitaire) for lg in commande.lignes.all()),
            [("LICENCE", 2, 8000), ("MASTER", 1, 8000)],
        )
        self.assertEqual(commande.paiement.moyen, "WAVE")
        self.assertEqual(commande.paiement.reference_transaction, "TX-123")

        capture = commande.capture_actuelle
        self.assertEqual(capture.type_mime, "image/png")
        self.assertRegex(capture.empreinte, r"^[0-9a-f]{64}$")
        self.assertTrue(capture.fichier.name.startswith(f"captures/{commande.pk}/{capture.empreinte[:16]}"))

        evenement = commande.evenements.get()
        self.assertEqual(evenement.action, Action.SOUMETTRE)
        self.assertEqual(evenement.statut_apres, Statut.EN_ATTENTE)
        self.assertIsNone(evenement.auteur)

    def test_prix_envoye_par_le_client_ignore(self):
        ligne = {**LIGNE_LICENCE, "quantite": 1, "prix_unitaire": 1}
        reponse = self.envoyer(lignes=[ligne], montant_total=1)

        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertEqual(reponse.data["montant_total"], 8000)

    def test_prix_vient_du_tarif_en_vigueur(self):
        Tarif.objects.filter(modele="LICENCE", version="BRODE", manches="COURTES").update(prix=9500)
        reponse = self.envoyer(lignes=[{**LIGNE_LICENCE, "quantite": 1}])
        self.assertEqual(reponse.data["montant_total"], 9500)

    def test_reference_transaction_facultative(self):
        d = donnees()
        del d["reference_transaction"]
        reponse = self.client.post(reverse("commande-creation"), d, format="multipart")
        self.assertEqual(reponse.status_code, 201, reponse.data)

    def test_accuse_de_reception_declenche_apres_enregistrement(self):
        with self.captureOnCommitCallbacks() as rappels:
            reponse = self.envoyer()
        self.assertEqual(reponse.status_code, 201)
        self.assertEqual(len(rappels), 1)

    def test_codes_de_suivi_differents(self):
        codes = {self.envoyer().data["code_suivi"] for _ in range(2)}
        self.assertEqual(len(codes), 2)

    def test_capture_deja_utilisee_ne_bloque_pas(self):
        # Le cahier demande d'alerter la trésorière (fiche), pas de refuser l'envoi.
        self.assertEqual(self.envoyer().status_code, 201)
        self.assertEqual(self.envoyer().status_code, 201)

    # --- Règles de vente -----------------------------------------------------

    def test_ventes_fermees(self):
        parametres = ParametresVente.charger()
        parametres.date_cloture = timezone.now() - timedelta(days=1)
        parametres.save()

        reponse = self.envoyer()

        self.assertEqual(reponse.status_code, 403)
        self.assertEqual(reponse.data["code"], "ventes_fermees")
        self.assertFalse(Commande.objects.exists())

    def test_ventes_pas_encore_ouvertes(self):
        parametres = ParametresVente.charger()
        parametres.date_ouverture = timezone.now() + timedelta(days=1)
        parametres.save()
        self.assertEqual(self.envoyer().status_code, 403)

    def test_quantite_maximum_par_ligne(self):
        reponse = self.envoyer(lignes=[{**LIGNE_LICENCE, "quantite": 6}])

        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(reponse.data["code"], "validation")
        self.assertIn("lignes", reponse.data["erreurs"])

    def test_lignes_identiques_additionnees(self):
        ligne = {**LIGNE_LICENCE, "quantite": 3}
        reponse = self.envoyer(lignes=[ligne, ligne])

        self.assertEqual(reponse.status_code, 400)
        self.assertIn("lignes", reponse.data["erreurs"])

    def test_taille_epuisee(self):
        Stock.objects.create(modele="LICENCE", version="BRODE", manches="COURTES", taille="M", quantite_max=1)
        creer_commande(statut=Statut.VALIDEE)  # consomme le seul polo disponible

        reponse = self.envoyer(lignes=[{**LIGNE_LICENCE, "quantite": 1}])

        self.assertEqual(reponse.status_code, 400)
        self.assertTrue(any(re.search("épuisée", m) for m in reponse.data["erreurs"]["lignes"]))
        self.assertEqual(Commande.objects.count(), 1)

    def test_commande_en_attente_ne_consomme_pas_le_stock(self):
        Stock.objects.create(modele="LICENCE", version="BRODE", manches="COURTES", taille="M", quantite_max=1)
        creer_commande(statut=Statut.EN_ATTENTE)

        reponse = self.envoyer(lignes=[{**LIGNE_LICENCE, "quantite": 1}])
        self.assertEqual(reponse.status_code, 201, reponse.data)

    def test_tarif_manquant_renvoie_400(self):
        Tarif.objects.filter(modele="MASTER", version="SIMPLE", manches="LONGUES").delete()
        reponse = self.envoyer()

        self.assertEqual(reponse.status_code, 400)
        self.assertFalse(Commande.objects.exists())

    # --- Validation du formulaire --------------------------------------------

    def test_faux_png_refuse(self):
        faux = SimpleUploadedFile("capture.png", b"MZ\x90\x00 executable", content_type="image/png")
        reponse = self.envoyer(capture=faux)

        self.assertEqual(reponse.status_code, 400)
        self.assertIn("capture", reponse.data["erreurs"])
        self.assertFalse(Commande.objects.exists())

    def test_emails_differents(self):
        reponse = self.envoyer(email_confirmation="autre@test.ci")
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("email_confirmation", reponse.data["erreurs"])

    def test_case_de_confirmation_obligatoire(self):
        reponse = self.envoyer(confirmation=False)
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("confirmation", reponse.data["erreurs"])

    def test_au_moins_un_polo(self):
        reponse = self.envoyer(lignes=[])
        self.assertEqual(reponse.status_code, 400)
        self.assertIn("lignes", reponse.data["erreurs"])
