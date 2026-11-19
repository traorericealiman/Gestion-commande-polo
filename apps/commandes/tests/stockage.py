"""Stockage temporaire des captures pour les tests (ne pollue pas private_media/)."""

import shutil
import tempfile
from unittest import mock

from django.core.files.storage import FileSystemStorage

from apps.commandes.models import Capture


class StockageTemporaireMixin:
    """Redirige les fichiers de capture vers un dossier temporaire, supprimé après le test."""

    def setUp(self):
        super().setUp()
        dossier = tempfile.mkdtemp(prefix="polo-test-")
        self.addCleanup(shutil.rmtree, dossier, ignore_errors=True)
        champ = Capture._meta.get_field("fichier")
        patcher = mock.patch.object(champ, "storage", FileSystemStorage(location=dossier))
        patcher.start()
        self.addCleanup(patcher.stop)
