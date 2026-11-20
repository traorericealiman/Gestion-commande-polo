"""Validation des captures de paiement envoyées par les acheteurs."""

import hashlib

from django.conf import settings
from django.core.exceptions import ValidationError

# Signatures binaires (« magic bytes ») : on vérifie le contenu réel du
# fichier, pas seulement son extension ou le Content-Type envoyé par le client.
_SIGNATURES = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"%PDF-", "application/pdf"),
)


def detecter_type(fichier) -> str | None:
    position = fichier.tell()
    fichier.seek(0)
    entete = fichier.read(8)
    fichier.seek(position)
    for signature, type_mime in _SIGNATURES:
        if entete.startswith(signature):
            return type_mime
    return None


def valider_capture(fichier) -> None:
    """Lève ValidationError si la capture est trop lourde ou d'un type refusé."""
    if fichier.size > settings.CAPTURE_TAILLE_MAX_OCTETS:
        raise ValidationError("La capture ne doit pas dépasser 5 Mo.", code="capture_trop_lourde")
    if detecter_type(fichier) not in settings.CAPTURE_TYPES_AUTORISES:
        raise ValidationError(
            "Format non accepté : envoyez une image JPG, PNG ou un PDF.", code="capture_format"
        )


def empreinte_sha256(fichier) -> str:
    """Empreinte du contenu, pour détecter une même capture réutilisée (cahier §4.3)."""
    position = fichier.tell()
    fichier.seek(0)
    h = hashlib.sha256()
    for bloc in fichier.chunks():
        h.update(bloc)
    fichier.seek(position)
    return h.hexdigest()
