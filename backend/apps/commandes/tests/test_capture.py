"""Tests de GET /api/v1/gestion/commandes/{id}/capture/ (télécharger la capture)."""

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from apps.commandes.services import enregistrer_capture

from .fabriques import PNG_MINIMAL, creer_commande, fichier_png
from .stockage import StockageTemporaireMixin
from .test_api import BaseAPITest

PDF_MINIMAL = b"%PDF-1.4\n" + b"0" * 64


class CaptureTelechargementTests(StockageTemporaireMixin, BaseAPITest):
    def setUp(self):
        super().setUp()
        self.commande = creer_commande()
        self.url = reverse("gestion-capture", args=[self.commande.pk])

    def test_visiteur_non_connecte_401(self):
        enregistrer_capture(self.commande, fichier_png())
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_tresoriere_recoit_le_fichier(self):
        enregistrer_capture(self.commande, fichier_png())
        self.se_connecter()

        reponse = self.client.get(self.url)

        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse["Content-Type"], "image/png")
        self.assertIn(f"capture-{self.commande.code_suivi}.png", reponse["Content-Disposition"])
        self.assertEqual(b"".join(reponse.streaming_content), PNG_MINIMAL)

    def test_la_capture_la_plus_recente_fait_foi(self):
        enregistrer_capture(self.commande, fichier_png())
        enregistrer_capture(self.commande, SimpleUploadedFile("nouvelle.pdf", PDF_MINIMAL))
        self.se_connecter()

        reponse = self.client.get(self.url)

        self.assertEqual(reponse["Content-Type"], "application/pdf")
        self.assertEqual(b"".join(reponse.streaming_content), PDF_MINIMAL)

    def test_acces_journalise_avec_des_ids_uniquement(self):
        enregistrer_capture(self.commande, fichier_png())
        self.se_connecter()

        with self.assertLogs("apps.commandes.views", level="INFO") as journal:
            b"".join(self.client.get(self.url).streaming_content)

        message = "\n".join(journal.output)
        self.assertIn(f"commande {self.commande.pk} par utilisateur {self.tresoriere.pk}", message)
        self.assertNotIn(self.tresoriere.email, message)
        self.assertNotIn(self.commande.email, message)

    def test_commande_sans_capture_404(self):
        self.se_connecter()
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_commande_inexistante_404(self):
        self.se_connecter()
        reponse = self.client.get(reverse("gestion-capture", args=[999999]))
        self.assertEqual(reponse.status_code, 404)

    def test_fichier_disparu_du_disque_404(self):
        capture = enregistrer_capture(self.commande, fichier_png())
        capture.fichier.storage.delete(capture.fichier.name)
        self.se_connecter()

        with self.assertLogs("apps.commandes.services", level="ERROR"):
            reponse = self.client.get(self.url)

        self.assertEqual(reponse.status_code, 404)
