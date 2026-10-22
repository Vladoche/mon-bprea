# Projet Mon BPREA

## Architecture

- Site statique hébergé sur GitHub Pages.
- Préserver les fonctionnalités existantes.
- Éviter les dépendances inutiles.
- Utiliser des données structurées JSON.
- Pour l’authentification, suivre [docs/architecture/AUTHENTIFICATION.md](docs/architecture/AUTHENTIFICATION.md) : client/service Supabase partagés, profils identifiés par UUID Auth, aucune synchronisation pédagogique avant les lots dédiés.

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
- Le défaut `assets/auth-config.json` reste désactivé ; utiliser une configuration publique locale ignorée pour préparer un artefact d’essai. Seules l’URL publique et la clé publishable peuvent être publiées, jamais une clé administrative ou des identifiants SMTP.
- Les tests JavaScript avec mocks et les E2E HTTP simulés ne valident pas RLS. Exécuter les contrôles réels uniquement dans la stack Supabase locale dédiée ; ne pas les rediriger vers un projet distant ou un compte étudiant. Consigner toute absence de CLI/Docker ou exécution impossible.
- Préserver les politiques RLS et les privilèges de colonnes de `profiles` ; ne pas considérer le masquage d’une page ou d’un bouton comme une protection. Ne jamais supprimer de progression lors d’une déconnexion.
- Garder l’inscription publique et les connexions anonymes désactivées ; invitations natives depuis un service de confiance uniquement. L’ouverture aux étudiants attend la validation du lot 6.5 et les préparatifs de confidentialité du lot 6.4.
- Demander validation avant déploiement en production.
