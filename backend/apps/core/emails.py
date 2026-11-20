"""Outils communs aux emails envoyés par l'application."""

import re
from html import unescape

from django.utils.html import strip_tags


def html_vers_texte(html: str) -> str:
    """Version texte de l'email, déduite automatiquement du HTML.

    Envoyée avec le HTML : certaines messageries (ou réglages) n'affichent que
    le texte, et un email sans version texte est plus souvent classé en spam.
    Un seul gabarit à maintenir par email.
    """
    texte = re.sub(r"(?is)<head.*?</head>|<div[^>]*display:none.*?</div>", "", html)
    texte = re.sub(r"\s+", " ", texte)  # en HTML, les retours à la ligne du gabarit ne comptent pas
    texte = re.sub(r'(?i)<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>', r"\2 : \1", texte)
    texte = re.sub(r"(?i)</td>\s*</tr>", "</tr>", texte)
    texte = re.sub(r"(?i)</td>\s*<td[^>]*>", " : ", texte)  # cellules d'une même ligne
    texte = re.sub(r"(?i)</p>|</table>", "\n\n", texte)
    texte = re.sub(r"(?i)<br\s*/?>|</tr>|</td>", "\n", texte)
    texte = unescape(strip_tags(texte))
    lignes = [" ".join(ligne.split()) for ligne in texte.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lignes)).strip() + "\n"
