"""Cycle de vie d'une commande : SOURCE DE VÉRITÉ UNIQUE.

Toute modification de statut passe par `services.appliquer_transition()`,
qui s'appuie sur la table TRANSITIONS ci-dessous. Ne jamais faire
`commande.statut = ...` ailleurs.

    EN_ATTENTE ──valider──────────────▶ VALIDEE ──marquer_disponible──▶ POLO_DISPONIBLE
        │  │                              │  │                               │
        │  └─demander_complement─▶ A_CORRIGER  └──────marquer_remis─────────┴──▶ REMIS
        │                          │   │
        │   ◀──renvoyer_capture────┘   └─cloturer (auto, 7 j)─▶ CLOTUREE
        └──refuser──▶ REFUSEE
    VALIDEE / POLO_DISPONIBLE ──annuler_decision (admin)──▶ EN_ATTENTE

Statuts finaux : REMIS, REFUSEE, CLOTUREE.
"""

from dataclasses import dataclass

from django.db import models


class Statut(models.TextChoices):
    EN_ATTENTE = "EN_ATTENTE", "En attente de vérification"
    A_CORRIGER = "A_CORRIGER", "À corriger"
    VALIDEE = "VALIDEE", "Validée"
    POLO_DISPONIBLE = "POLO_DISPONIBLE", "Polo disponible"
    REMIS = "REMIS", "Remis"
    REFUSEE = "REFUSEE", "Refusée"
    CLOTUREE = "CLOTUREE", "Clôturée"


class Action(models.TextChoices):
    SOUMETTRE = "SOUMETTRE", "Commande envoyée"
    VALIDER = "VALIDER", "Validation"
    REFUSER = "REFUSER", "Refus"
    DEMANDER_COMPLEMENT = "DEMANDER_COMPLEMENT", "Complément demandé"
    RENVOYER_CAPTURE = "RENVOYER_CAPTURE", "Nouvelle capture envoyée"
    MARQUER_DISPONIBLE = "MARQUER_DISPONIBLE", "Polo disponible"
    MARQUER_REMIS = "MARQUER_REMIS", "Polos remis"
    ANNULER_DECISION = "ANNULER_DECISION", "Décision annulée"
    CLOTURER = "CLOTURER", "Clôture automatique"


class MotifRefus(models.TextChoices):
    CAPTURE_ILLISIBLE = "CAPTURE_ILLISIBLE", "Capture illisible"
    MONTANT_INSUFFISANT = "MONTANT_INSUFFISANT", "Montant insuffisant"
    PAIEMENT_INTROUVABLE = "PAIEMENT_INTROUVABLE", "Paiement introuvable"
    DOUBLON = "DOUBLON", "Doublon"
    AUTRE = "AUTRE", "Autre"


class Acteur(models.TextChoices):
    ACHETEUR = "ACHETEUR"
    GESTIONNAIRE = "GESTIONNAIRE"  # trésorière ou administrateur
    ADMIN = "ADMIN"
    SYSTEME = "SYSTEME"


@dataclass(frozen=True)
class Transition:
    depuis: frozenset
    vers: str
    acteur: str
    motif_obligatoire: bool = False


TRANSITIONS: dict[str, Transition] = {
    Action.VALIDER: Transition(frozenset({Statut.EN_ATTENTE}), Statut.VALIDEE, Acteur.GESTIONNAIRE),
    Action.REFUSER: Transition(
        frozenset({Statut.EN_ATTENTE}), Statut.REFUSEE, Acteur.GESTIONNAIRE, motif_obligatoire=True
    ),
    Action.DEMANDER_COMPLEMENT: Transition(
        frozenset({Statut.EN_ATTENTE}), Statut.A_CORRIGER, Acteur.GESTIONNAIRE, motif_obligatoire=True
    ),
    Action.RENVOYER_CAPTURE: Transition(frozenset({Statut.A_CORRIGER}), Statut.EN_ATTENTE, Acteur.ACHETEUR),
    Action.MARQUER_DISPONIBLE: Transition(
        frozenset({Statut.VALIDEE}), Statut.POLO_DISPONIBLE, Acteur.GESTIONNAIRE
    ),
    Action.MARQUER_REMIS: Transition(
        frozenset({Statut.VALIDEE, Statut.POLO_DISPONIBLE}), Statut.REMIS, Acteur.GESTIONNAIRE
    ),
    Action.ANNULER_DECISION: Transition(
        frozenset({Statut.VALIDEE, Statut.POLO_DISPONIBLE}),
        Statut.EN_ATTENTE,
        Acteur.ADMIN,
        motif_obligatoire=True,
    ),
    Action.CLOTURER: Transition(frozenset({Statut.A_CORRIGER}), Statut.CLOTUREE, Acteur.SYSTEME),
}

STATUTS_FINAUX = frozenset({Statut.REMIS, Statut.REFUSEE, Statut.CLOTUREE})

# Le stock est réservé à la validation (cahier RG4).
STATUTS_CONSOMMANT_STOCK = frozenset({Statut.VALIDEE, Statut.POLO_DISPONIBLE, Statut.REMIS})


def actions_possibles(statut: str) -> list[str]:
    """Actions de gestion disponibles depuis un statut (utile au front)."""
    return [
        action
        for action, t in TRANSITIONS.items()
        if statut in t.depuis and t.acteur in (Acteur.GESTIONNAIRE, Acteur.ADMIN)
    ]
