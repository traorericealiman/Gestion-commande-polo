from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase

from apps.core.validators import empreinte_sha256, valider_capture


class CaptureTests(SimpleTestCase):
    def test_png_accepte(self):
        valider_capture(SimpleUploadedFile("a.png", b"\x89PNG\r\n\x1a\n" + b"0" * 10))

    def test_pdf_accepte(self):
        valider_capture(SimpleUploadedFile("a.pdf", b"%PDF-1.7 ..."))

    def test_faux_png_refuse(self):
        # Un exécutable renommé en .png est refusé : on lit le contenu réel.
        with self.assertRaises(ValidationError):
            valider_capture(SimpleUploadedFile("a.png", b"MZ\x90\x00 ...", content_type="image/png"))

    def test_trop_lourd_refuse(self):
        with self.assertRaises(ValidationError):
            valider_capture(SimpleUploadedFile("a.png", b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024)))

    def test_empreinte_identique_pour_meme_contenu(self):
        a = SimpleUploadedFile("a.png", b"meme contenu")
        b = SimpleUploadedFile("b.png", b"meme contenu")
        self.assertEqual(empreinte_sha256(a), empreinte_sha256(b))
