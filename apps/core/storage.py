"""Stockage privé des captures de paiement (jamais servi par une URL publique)."""

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class StockagePrive(FileSystemStorage):
    def __init__(self, **kwargs):
        kwargs.setdefault("location", settings.PRIVATE_MEDIA_ROOT)
        kwargs.setdefault("base_url", None)
        super().__init__(**kwargs)

    def url(self, name):  # pragma: no cover - garde-fou
        raise NotImplementedError(
            "Les captures sont privées : passez par la vue authentifiée de téléchargement."
        )


stockage_prive = StockagePrive()
