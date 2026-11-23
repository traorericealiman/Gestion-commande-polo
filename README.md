# Polos ESATIC — Front React complet

Application de commande de polos pour l'Association Étudiante d'ESATIC.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- React Router v7
- Framer Motion
- Lucide icons

## API

https://api-production-02aa0543.up.railway.app

Swagger : https://api-production-02aa0543.up.railway.app/api/docs/

## Installation

```bash
cd polo-esatic
npm install
npm run dev
```

→ http://localhost:5173

## Pages publiques

| Route | Description |
|-------|-------------|
| `/` | Accueil + tarifs + galerie polos |
| `/commander` | Formulaire multi-lignes + capture |
| `/suivi` | Suivi commande + renvoi capture |
| `/confirmation` | Code de suivi après envoi |

## Espace admin (trésorières / admin)

| Route | Description |
|-------|-------------|
| `/admin/login` | Connexion JWT |
| `/admin` | Tableau de bord (compteurs, montants, stocks) |
| `/admin/commandes` | Liste filtrable + export CSV |
| `/admin/commandes/:id` | Fiche complète + actions |

### Actions selon le statut

- Valider / Refuser (motif obligatoire)
- Demander complément
- Marquer disponible / Polos remis
- Annuler décision (admin)
- Note interne, capture, alertes doublons

## Design

Palette bleu / blanc — Navy `#0B1F4A`, Accent `#1E5EFF`. Mobile-first, français.

## Variable optionnelle

```
VITE_API_URL=https://api-production-02aa0543.up.railway.app
```
