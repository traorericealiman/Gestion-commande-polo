"""Tests de POST /api/v1/suivi/capture/ (renvoyer une capture)."""

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.commandes.models import Capture, Commande
from apps.commandes.services import enregistrer_capture
from apps.commandes.statuts import Action, MotifRefus, Statut

from .fabriques import creer_commande, fichier_png
from .test_api import BaseAPITest

JPEG_MINIMAL = b"\xff\xd8\xff\xe0" + b"\x00" * 64


def fichier_jpeg(nom="nouvelle.jpg"):
    return SimpleUploadedFile(nom, JPEG_MINIMAL, content_type="image/jpeg")


class RenvoiCaptureTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.commande = creer_commande(email="acheteur@test.ci")
        self.commande.paiement.reference_transaction = "ANCIENNE-REF"
        self.commande.paiement.save()
        enregistrer_capture(self.commande, fichier_png())

    def passer_au_statut(self, statut, **champs):
        # Raccourci de test : en production, un statut ne change que via appliquer_transition.
        Commande.objects.filter(pk=self.commande.pk).update(statut=statut, **champs)

    def renvoyer(self, email="acheteur@test.ci", capture=None, **autres):
        donnees = {
            "code_suivi": self.commande.code_suivi,
            "email": email,
            "capture": capture or fichier_jpeg(),
            **autres,
        }
        return self.client.post(reverse("suivi-capture"), donnees, format="multipart")

    def test_renvoi_accepte_quand_a_corriger(self):
        self.passer_au_statut(
            Statut.A_CORRIGER, motif=MotifRefus.CAPTURE_ILLISIBLE, commentaire="Capture floue."
        )

        reponse = self.renvoyer()

        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertEqual(reponse.data["statut"], Statut.EN_ATTENTE)
        self.assertEqual(reponse.data["statut_libelle"], "En attente de vérification")
        self.assertFalse(reponse.data["peut_renvoyer_capture"])
        self.assertEqual(reponse.data["motif"], "")
        self.assertEqual(reponse.data["commentaire"], "")
        self.assertEqual(len(reponse.data["lignes"]), 1)

    def test_ancienne_capture_conservee(self):
        self.passer_au_statut(Statut.A_CORRIGER)
        ancienne = self.commande.capture_actuelle

        self.renvoyer()

        self.assertEqual(self.commande.captures.count(), 2)
        self.assertTrue(Capture.objects.filter(pk=ancienne.pk).exists())
        nouvelle = self.commande.capture_actuelle
        self.assertNotEqual(nouvelle.pk, ancienne.pk)
        self.assertEqual(nouvelle.type_mime, "image/jpeg")

    def test_historique_ecrit_sans_auteur(self):
        self.passer_au_statut(Statut.A_CORRIGER)
        self.renvoyer()

        evenement = self.commande.evenements.get()
        self.assertEqual(evenement.action, Action.RENVOYER_CAPTURE)
        self.assertEqual(evenement.statut_avant, Statut.A_CORRIGER)
        self.assertEqual(evenement.statut_apres, Statut.EN_ATTENTE)
        self.assertIsNone(evenement.auteur)

    def test_reference_mise_a_jour_si_fournie(self):
        self.passer_au_statut(Statut.A_CORRIGER)
        self.renvoyer(reference_transaction="NOUVELLE-REF")

        self.commande.paiement.refresh_from_db()
        self.assertEqual(self.commande.paiement.reference_transaction, "NOUVELLE-REF")

    def test_reference_conservee_si_absente(self):
        self.passer_au_statut(Statut.A_CORRIGER)
        self.renvoyer(reference_transaction="")

        self.commande.paiement.refresh_from_db()
        self.assertEqual(self.commande.paiement.reference_transaction, "ANCIENNE-REF")

    def test_notification_declenchee(self):
        self.passer_au_statut(Statut.A_CORRIGER)
        with self.captureOnCommitCallbacks() as rappels:
            self.renvoyer()
        self.assertEqual(len(rappels), 1)

    def test_refuse_si_pas_a_corriger(self):
        for statut in (Statut.EN_ATTENTE, Statut.VALIDEE, Statut.REFUSEE, Statut.CLOTUREE):
            with self.subTest(statut=statut):
                self.passer_au_statut(statut)
                reponse = self.renvoyer()

                self.assertEqual(reponse.status_code, 409)
                self.assertEqual(reponse.data["code"], "transition_interdite")
                self.assertEqual(self.commande.captures.count(), 1)

    def test_mauvais_email(self):
        self.passer_au_statut(Statut.A_CORRIGER)
        reponse = self.renvoyer(email="autre@test.ci")

        self.assertEqual(reponse.status_code, 404)
        self.assertEqual(self.commande.captures.count(), 1)

    def test_faux_fichier_refuse(self):
        self.passer_au_statut(Statut.A_CORRIGER)
        faux = SimpleUploadedFile("capture.png", b"MZ\x90\x00 executable", content_type="image/png")

        reponse = self.renvoyer(capture=faux)

        self.assertEqual(reponse.status_code, 400)
        self.assertIn("capture", reponse.data["erreurs"])
        self.assertEqual(self.commande.captures.count(), 1)
        self.commande.refresh_from_db()
        self.assertEqual(self.commande.statut, Statut.A_CORRIGER)
