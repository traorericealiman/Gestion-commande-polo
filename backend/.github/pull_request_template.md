## Ce que fait cette PR

<!-- En une ou deux phrases. -->

## Endpoint(s) concerné(s)

<!-- ex. POST /api/v1/commandes/ -->

## Vérifications

- [ ] `python manage.py test` passe
- [ ] `ruff check .` et `ruff format --check .` passent
- [ ] Migration générée et commitée si un `models.py` a changé
- [ ] `docs/openapi.yaml` régénéré si un serializer ou une route a changé, et équipe front prévenue
- [ ] Aucune donnée sensible (secret, mot de passe, email réel) dans le code ou les logs
- [ ] Le statut d'une commande ne change que via `appliquer_transition()`
