# Projet Mon BPREA

## Architecture

- Site statique hébergé sur GitHub Pages.
- Préserver les fonctionnalités existantes.
- Éviter les dépendances inutiles.
- Utiliser des données structurées JSON.

## Pédagogie

- 10 nouveaux exercices par UC et par semaine.
- Séries précédentes non bloquantes.
- Calculer le taux de réussite sur les exercices réalisés.
- Conserver l'historique statistique.
- Aucune gamification ni badge de récompense.

## Interface

- Responsive et accessible.
- Préserver le mode sombre.
- Prévoir les thèmes saisonniers et horaires.

## Développement

- Le lot 5.1 autorise explicitement les tests automatisés unitaires, d’intégration et E2E. Maintenir une suite ciblée sur les calculs, la persistance et les parcours critiques ; ne pas ajouter des tests qui recopient l’implémentation ou seulement pour augmenter leur nombre.
- Utiliser Node.js 24 LTS et `npm ci` pour les outils de développement. Le site publié doit rester statique et fonctionner sans Node.js.
- Exécuter `npm test` puis `npm run test:e2e` avant livraison ; `npm run test:watch` sert au développement. Installer Chromium avec `npx playwright install chromium`. Documenter toute vérification impossible sans la déclarer réussie.
- Lire [docs/TESTS.md](docs/TESTS.md) pour les conventions ; utiliser une horloge contrôlée et des données isolées. Ne jamais exécuter les E2E sur la production ni effacer les données du navigateur réel de l’utilisateur.
- Préserver les URL, identifiants et clés locales. Extraire seulement la logique nécessaire à la testabilité, en la réutilisant dans l’application et les tests.
- Les contrôles CI `unit-integration` et `e2e` du workflow Qualité ne déploient pas le site. Ne pas modifier les règles de protection de `main` ni fusionner une PR sans accord.
- Conserver les guides sous `docs/architecture/`, les validations sous `docs/validations/`, et mettre à jour leurs liens lors d’un déplacement.
- Vérifier visuellement les fonctionnalités modifiées.
- Ne jamais supprimer de données utilisateur.
- Ne jamais publier de clés secrètes.
- Demander validation avant déploiement en production.
