# Validation du lot 6.4.1 — inventaire et transparence

Date : **27 octobre 2026**, Europe/Paris. Ce rapport atteste des travaux et exécutions identifiés, **pas d'une conformité RGPD acquise**. Les décisions juridiques et opérationnelles restent ouvertes.

## Préparation et périmètre vérifiés (A)

- Lecture d'[AGENTS.md](../../AGENTS.md), [TESTS.md](../TESTS.md), des guides Auth/synchronisation et des trois migrations. Arbre de travail initial propre sur `chore/ci-fiabilisation-et-acceleration` ; aucune modification utilisateur à déplacer ou écraser.
- `git fetch origin main`, puis branche demandée `feature/lot6-4-1-rgpd-inventaire-transparence` créée depuis `178f7c7d32ee3dc6738e7da5d760d613d2fb5fa7`. Les écritures Git ont nécessité la permission d'exécution hors bac à sable ; aucune modification directe de `main`.
- Fusions établies dans l'historique de `origin/main` : PR [#16](https://github.com/Vladoche/mon-bprea/pull/16) (`6ff540a`), [#17](https://github.com/Vladoche/mon-bprea/pull/17) (`b647a71`), [#18](https://github.com/Vladoche/mon-bprea/pull/18) (`611daa7`), [#19](https://github.com/Vladoche/mon-bprea/pull/19) (`f984cae`) et [#20](https://github.com/Vladoche/mon-bprea/pull/20) (`178f7c7`). L'API GitHub confirme aussi `merged:true` pour #20.
- Workflows examinés : [Qualité](../../.github/workflows/quality.yml) (`unit-integration`, `e2e`), [Sécurité Auth/RLS](../../.github/workflows/auth-security.yml) (`supabase-security`), [déploiement](../../.github/workflows/deploy.yml) distinct. Aucune modification de workflow, dépendance, test, règle de protection ou optimisation Chromium #20.
- Modification documentaire exclusivement : les six fichiers [RGPD](../rgpd/INVENTAIRE-DONNEES.md), ce rapport et un lien de navigation dans [README](../../README.md). Aucun changement de HTML/CSS/JS/SQL/configuration publique. Aucune implémentation de 6.4.2.

## Livrables et preuves de contenu

| Livrable | Couverture et limites explicites |
| --- | --- |
| [Inventaire](../rgpd/INVENTAIRE-DONNEES.md) | Auth/profil, trois tables Drill, six tables personnelles, clés visiteur/SDK/provenance/identité, quatre bases IndexedDB, outboxes/conflits/imports/archives, Dashboard calculé, ITK et apparence, autres mécanismes et durées fonctionnelles. Chaque famille renvoie au code. |
| [Flux et prestataires](../rgpd/FLUX-ET-PRESTATAIRES.md) | Treize fiches de flux, diagramme des chemins implémentés, prestataires connus/inconnus, accès privilégiés et traces, sources officielles et analyse terminal ; pas de région ni de contrat inventé. |
| [Registre](../rgpd/REGISTRE-TRAITEMENTS.md) | Cinq finalités, en-tête article 30 à compléter, options de bases non retenues, conservation et destinataires à établir ; projet public expurgé des informations privées du registre interne. |
| [Politique projet](../rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md) | Texte français distinguant visiteur et personnel préparé, fonctions existantes et droits futurs ; avertissement de non-publication et procédure de transformation en page validée. Aucun faux contact. |
| [Décisions et risques](../rgpd/DECISIONS-A-VALIDER.md) | Quatorze décisions non validées, douze scénarios de risque, screening des neuf critères AIPD sans conclusion prématurée. |
| [Préparation des droits](../rgpd/PREPARATION-DROITS.md) | Matrice de sources multicopies et contrats/recettes proposés 6.4.2–6.4.4 ; exclusion des secrets et données tierces, sauvegardes/appareils absents et anti-résurrection. Aucune action d'export/suppression développée ou lancée. |

**B — références officielles :** consultation web du 27/10/2026, liens et portée dans la [liste des sources](../rgpd/FLUX-ET-PRESTATAIRES.md). CNIL registre, traceurs, transparence et AIPD ; RGPD sur CNIL ; documentation GitHub Pages/confidentialité et Supabase. Limites : EUR-Lex a renvoyé une vérification antirobot, le contenu juridique a été lu sur CNIL ; page AIPD canonique en timeout mais variante officielle de query lisible ; index des sous-traitants Supabase consulté, liste détaillée liée non récupérée. Aucune configuration privée/contractuelle recherchée par contournement.

## Exécutions locales réelles

| Vérification | Résultat observé |
| --- | --- |
| Versions | Node.js `24.22.0`, npm `10.4.0`, Python `3.15.0`. |
| `npm ci` | Réussite, 50 paquets ajoutés ; verrou/dépendances non modifiés. |
| `npm test` | **35 fichiers, 329 tests réussis**, durée affichée 2,07 s. |
| `npx playwright install chromium` puis `npm run test:e2e` | **53 parcours Chromium réussis**, durée affichée 30,6 s. Contextes synthétiques et serveur local uniquement. |
| `npm run build:auth-sdk` puis `git diff --exit-code -- assets/vendor/supabase.js` | Réussite, SDK verrouillé 2.118.0 reconstruit sans diff. |
| Auth/PostgreSQL/RLS local réel | **Non exécuté sur ce poste : Docker absent** (`docker` non reconnu). Aucun projet distant utilisé en remplacement. Les mocks et E2E autonomes ne prouvent pas RLS ; la preuve réelle nouvelle est attendue du job CI dédié sur la tête de PR. |
| Contrôle des références | **120 liens locaux et 26 tableaux** dans les sept documents vérifiés ; fences et encodage UTF-8 contrôlés, références de clés/tables/fonctions relues ; `git diff --check` à zéro erreur. Recherche ciblée de JWT, clés secrètes, clés privées, tokens GitHub et e-mails personnels dans les nouveaux documents : aucune valeur détectée. Ce contrôle ciblé n'est pas une garantie absolue d'absence de tout secret. |
| Artefact Pages | `python scripts/prepare-pages.py --version audit-rgpd-6-4-1 --output .tmp/rgpd-public-review` : **115 fichiers publics, 258 références versionnées**. Vérification de l'absence de `docs/`, README, projet de politique, config locale et page racine de confidentialité ; Auth reste désactivée. |

Les traces/captures et scripts ponctuels de contrôle sont sous `.tmp/`, ignorés, sans donnée étudiante ; ils ne sont pas de nouveaux tests livrés. Le contenu pédagogique/runtime n'étant pas modifié, aucun test recopiant l'implémentation n'a été ajouté.

## Contrôle navigateur ciblé, portée et inspection visuelle

Un profil Chromium neuf a parcouru les **17 HTML racine** via le serveur de test local, défaut Auth désactivé. Une route bloquait toute origine externe. Résultats : **zéro tentative de requête externe, zéro en-tête Set-Cookie, zéro cookie, zéro erreur JavaScript**. Après navigation et choix explicite de luminosité, seule `bprea-demo-appearance-v1` est présente dans localStorage ; sessionStorage vide, aucune base IndexedDB créée, aucun service worker et aucun cache Cache API. L'absence de base dans ce parcours ne nie pas les bases personnelles préparées, puisqu'aucun compte n'a été activé et aucun exercice effectué dans cette sonde.

Cette sonde ne reproduit **ni les réponses GitHub Pages/CDN, ni un fournisseur SMTP, ni un espace Supabase connecté**, et ne prouve aucune exemption juridique. Les autres chemins fonctionnels sont couverts par les 53 tests existants et l'inspection du code. Les premières tentatives manuelles ont échoué à démarrer/joindre le serveur depuis des contextes Windows isolés ; seule l'exécution réunissant serveur et Chromium dans le même contexte a fourni les résultats ci-dessus.

Les captures d'accueil en 1280 px clair et 390 px sombre ont été inspectées ; contrôle du débordement horizontal mobile négatif. Aucun composant d'interface n'est modifié dans ce lot. Les limites générales d'accessibilité ne sont pas réévaluées comme si une nouvelle interface avait été livrée.

## Critères d'acceptation : portée de l'attestation

| Critères de la demande | Preuve / état |
| --- | --- |
| 1–3 : données, stockages distincts et flux | Inventaire et fiches F01–F13 ; faits A reliés aux sources. |
| 4–6 : prestataires, transferts inconnus et sécurité | Matrice prestataires et risques ; région/chaîne/contrats réels restent D, pas affirmés vérifiés. |
| 7–10 : finalités, bases, durées, responsable | Registre et D01–D07 : aucun choix inventé, aucune durée de politique validée annoncée. |
| 11–13 : terminal, risques, AIPD | Tableau traceurs, sonde limitée, douze risques et neuf critères ; nécessité AIPD non tranchée. |
| 14–17 : projet, statut, décisions et droits futurs | Projet marqué, non inclus dans l'artefact Pages, D01–D14 et matrice 6.4.2–6.4.4. Le dépôt public peut néanmoins exposer les Markdown, d'où avertissement maintenu. |
| 18 : aucun mécanisme prématuré | Diff exclusivement documentaire ; aucune action d'export/suppression ni migration. |
| 19 : suites existantes | 329 tests et 53 E2E locaux réussis ; aucune suppression/ignorance de test. |
| 20 : trois checks sur le dernier commit | Preuve de livraison à consigner dans la description de la PR : SHA exact, liens des jobs terminés et conclusions. Un résultat de #20 ou d'un commit précédent ne suffit pas. Voir procédure ci-dessous. |
| 21–22 : environnements inchangés et absence d'ouverture | Aucune commande ni appel sur DEV/PROD, aucun compte réel/invitation/SMTP/Auth distant ; aucune modification du défaut public désactivé ni déploiement. Il s'agit du périmètre des actions de cette session, pas d'un audit comparatif des projets hébergés. |

## Livraison GitHub et preuve CI

La branche est destinée à une PR vers `main`, **sans fusion ni auto-merge**. Le contrôle de livraison doit interroger les workflows associés au SHA de tête après le dernier push, puis chaque job :

- `unit-integration` et `e2e` du workflow Qualité ;
- `supabase-security` : stack éphémère locale, pgTAP, Auth/RLS/backend et navigateur réels, arrêt de stack inclus.

Le statut final, le SHA et les liens des jobs de cette livraison sont reportés dans la **description de la PR** après leur observation, afin de ne pas créer un nouveau commit uniquement pour citer son propre résultat CI. Les présents résultats locaux ne déclarent pas par anticipation la CI réussie. Aucune publication de site, invitation ou ouverture étudiante n'est autorisée par cette livraison documentaire.
