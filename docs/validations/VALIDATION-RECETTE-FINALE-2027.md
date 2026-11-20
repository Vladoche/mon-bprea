# Validation de la recette finale Mon BPREA 2027

**20 novembre 2026 · GO PARTIEL en préproduction · PUBLICATION NON AUTORISÉE.**
La recette locale couvre le frontend, la persistance réelle sur stack fictive,
le build Pages et le retour arrière. La revue de la notice V1.2 et les
prérequis d’exploitation restent à décider. Les résultats s’appuient sur
Chromium. Safari et le lecteur d’écran natif restent à recetter.
[Checklist détaillée](CHECKLIST-RECETTE-FINALE-2027.md) ·
[PR #79](https://github.com/Vladoche/mon-bprea/pull/79).

## Références et environnements

| Environnement | Référence et portée |
| --- | --- |
| Code `origin/main` synchronisé | `21689d3b1861c9f7a215b51e3814e392f95efbff`. PR #78 fusionnée le 19/11 à 21:15:11 UTC. L’arbre de fusion est celui de la tête `293e7645b15fc8f4e54577dcd5d1e39945352fa2`. Les quatre checks ont réussi sur la tête de #78, ainsi que sur les têtes examinées de #76 et #77. [Qualité #78](https://github.com/Vladoche/mon-bprea/actions/runs/44612240278) · [Sécurité #78](https://github.com/Vladoche/mon-bprea/actions/runs/44612240023). |
| Branche de recette | `codex/recette-finale-2027`. Code et tests qualifiés à `bacb6832f00946f4927f98c0d5a904b27b1b1ac4`. La tête de livraison ajoute le dossier et les références documentaires. [Checks actuels de la PR](https://github.com/Vladoche/mon-bprea/pull/79/checks). |
| Poste de recette | Windows, Node.js 24.22.0, Chromium Playwright 156.0.8078.4. Contextes jetables de navigateur, clavier et tactile émulé. Données publiques et synthétiques. |
| Artefacts locaux | Build de forme PROD avec clé publique fictive, plus artefacts visiteur et Auth de boucle locale, sous `/mon-bprea/`. Version candidat `bacb683…` et repli `3952fd5…`. |
| Stack Supabase isolée | Docker Desktop et CLI 2.121.0, copie des fixtures versionnées dans un projet neuf. PostgreSQL 17 et GoTrue v2.197.0, JWT 120 s et OTP 60 s pour les essais. Migrations et contrôles SQL du dépôt utilisés tels quels. |
| Site GitHub Pages actuel | `3952fd5a98705397bb341dc1fa54e0e8f92979d8`, [workflow manuel #64](https://github.com/Vladoche/mon-bprea/actions/runs/42495467393), dernier succès au relevé du 20/11. Quatre workflows GitHub actifs, Pages sur lancement manuel. Écart avec `main` de 96 commits et 298 fichiers, dont la refonte, la photothèque et le profil simplifié. |
| Supabase PROD | Preuves datées du 8 et du 18 novembre relues. Périmètre de cette campagne hébergée limité au GET sans session des pages et de la configuration publique servies par GitHub Pages. |

## Correctifs et résultats automatisés

La notice V1.1 dirigeait encore vers les opérations retirées du profil dans
#77. La V1.2 candidate oriente la copie et l’effacement vers le responsable.
Elle précise la portée locale des réglages du navigateur, les précautions
avant effacement et les conditions de la clôture assistée. Le rendu a été
régénéré et comparé exactement avec la source. Empreinte SHA-256 LF
`097bf1e94fe869940d286f78b9900d28f02e13fecc9b08680068ef2a56d2dc57`.
L’approbation reste en attente. Les [corrections](CORRECTIONS-PREPUBLICATION-2027.md)
conservent le détail par paragraphe et la [fiche d’approbation](CORRECTIONS-PREPUBLICATION-2027.md#fiche-dapprobation).

| Contrôle | Résultat et portée |
| --- | --- |
| Installation et unité/intégration | `npm ci` sous Node 24. `npm test -- --maxWorkers=2` : **680 réussis, 1 ignoré, 0 échec** au rejeu final du code candidat. L’échec de la première passe attendait l’ancien libellé du générateur. Le test vérifie désormais la sortie et le rejet de l’ancienne empreinte. |
| Chromium standard | Première passe Windows, **250 réussis**. Au rejeu local du candidat, **249 réussis et 1 échec** lié à la feuille de styles du QCM non reçue. Le contrôle de contraste a ensuite réussi **16 fois sur 16**. Le check GitHub `e2e` couvre l’ensemble de la suite à la tête de livraison. [Diagnostic](CORRECTIONS-PREPUBLICATION-2027.md#diagnostic-du-contraste-qcm). |
| SDK et notice | SDK Supabase 2.118.0 reconstruit avec diff vide. Génération et `--check` sans dépendances npm dans la fixture d’intégration. V1.1 refusée comme empreinte de la V1.2. |
| Constructeur Pages | Build à version fixe répété. Tests du préflight sans requête PROD, des cinq champs publics, des ressources manquantes, des chemins, des exclusions et du scanner de secrets connus. |
| pgTAP local | **414 assertions** dans cinq fichiers, toutes réussies. |
| Runners réels | **12 groupes Auth**, **22 Drill**, **26 données personnelles**, tous réussis. Expirations chronométrées en temps réel. |
| Chromium sur Supabase isolée | **33 réussis**, traces et vidéos désactivées. La fixture des liens manuels a observé le profil sur le Docker local de la campagne, avec le label et le port attendus. [Runners du dépôt](../TESTS.md#authentification--tests-applicatifs-et-sécurité-réelle). |
| Mesures et parité | Laboratoire local du catalogue réel et de 600 fiches, du tableau de bord et de l’ITK. [Mesures](#performance). |

Les vérifications non exécutées sont détaillées dans la checklist. Le
lecteur d’écran natif, Safari, le dialogue système d’impression et la
recette hébergée 2027 n’ont pas de résultat dans cette campagne.

## Parcours pédagogiques

- **Navigation et cours.** 19 routes sous le préfixe Pages, accès depuis les
  rubriques, liens directs et ancres, clavier/touch, historique et BFCache.
  Sept UC/UCARE, quatre cours d’UC 03, états vides, sommaires, tableaux,
  ressources, complétion et restauration de la progression.
- **QCM, Drill et tableau de bord.** Correction, score, brouillons,
  entraînements, semaine, état sans donnée et historique. Le tableau de bord
  retrouve les résultats de la même fixture, dont 9 bonnes réponses sur
  18, puis 21 sur 35 pour toutes les semaines. Le laboratoire rejoue 12 états
  identiques avant/après #78, dont données exclues, hors ligne et conflit.
- **Calendrier et ITK.** Le catalogue officiel du calendrier contient
  zéro événement. La fixture vérifie périodes inclusives, jour/mois, détail,
  exemple fictif, liens UC, Échap et focus. Les 5 scénarios ITK conservent
  les sorties de calcul, avertissements et chronologie. CSV avec BOM,
  séparateur et échappement vérifiés, PDF A4 via Chromium, huit paramètres
  de compte retrouvés.
- **Bibliothèque et botanique.** Recherche accentuée/multiterme, filtres,
  URL, retour, ressources pertinentes et cas PDF. Les 24 plantes et les
  quatre catégories sont jouables. Les scénarios couvrent Découverte,
  Chrono, durées, pauses, photo indisponible, réessai, passage hors score,
  corrections, historique, crédits et mouvement réduit.

Les sources pédagogiques, médias, clés et contrats de persistance du
candidat correspondent à `main`. Les moteurs sont vérifiés avec leurs
fixtures habituelles et les essais d’historique décrits ci-dessous.

## Authentification et données personnelles

| Contrôle | Résultat observé en stack locale |
| --- | --- |
| Accès | Inscription publique et connexion anonyme refusées. Invitation et récupération réelles valides, expirées, invalides et consommées, depuis des contextes neufs. Définition de mot de passe, sortie et reconnexion vérifiées. Le test de renouvellement a attendu l’expiration réelle, renouvelé une invitation fictive sur le même UUID, activé ce compte et relu le profil via la session du titulaire. |
| RLS et privilèges | Lecture et écriture propriétaires avec JWT étudiants. Accès A/B, rôles publics, colonnes techniques `profiles` et permissions vérifiés. Le plafond de sept comptes est testé dans le circuit opérateur. |
| Deux appareils | Après confirmation et lecture de la base avec le JWT étudiant, un deuxième contexte indépendant retrouve cours, QCM, Drill, botanique, ITK et apparence avec le même compte. Les essais comparent aussi les valeurs retournées, les identifiants et les états de confirmation. [Recette réelle](../../tests/e2e-supabase/personal-space.spec.js). |
| Isolation A/B | Séquence A → B → A réelle. Historique et outbox de A absents chez B et retrouvés au retour. Sauvegardes et lectures tardives, deux onglets et BFCache natif vérifiés par les essais navigateur. Le BFCache natif avec changement de compte utilise le transport simulé. [Profil](../../tests/e2e/profile.spec.js) · [Persistance réelle](../../tests/e2e-supabase/personal-space.spec.js). |
| Pannes et conflits | Réponse perdue après commit, coupure avant commit, reprise après rechargement, maintien de l’outbox et confirmation unique. Conflits visibles et résolution explicite, indépendants des opérations réussies. Les imports restent volontaires et leur source est préservée. |
| Profil et anciennes fonctions | E-mail, date, pseudo, apparence, état de sauvegarde, déconnexion, Contact et Confidentialité. Les commandes JSON, d’effacement et de clôture sont retirées du profil partagé. Les moteurs historiques sont toujours exercés via les fixtures dédiées. |

La relecture avec deux contextes Chromium indépendants démontre la persistance
sur la stack fictive. La durée PROD des liens, la récupération hébergée et
le renouvellement d’une invitation réelle relèvent de l’exploitation.

## Artefact, cache et repli

- Deux builds du candidat avec `--production`, même SHA et configuration
  publique fictive, ont produit les mêmes 163 entrées et les mêmes SHA-256
  par fichier. 19 HTML, 132 fichiers `assets/`, 11 PDF et `.nojekyll`.
  **342 références versionnées.** Manifeste local trié des chemins et
  empreintes, SHA-256
  `00ec7982d708486ac3e2d36b5a34ca2808bf24a3801122a735e39293586c39f2`.
  Exclusions contrôlées, dont configurations locales, sauvegardes, outils
  Admin, tests, documentation et fichiers cachés privés. Les secrets connus
  du scanner de contenu sont également testés par refus.
- Sous `/mon-bprea/`, chargement direct des 19 HTML, images, favicon,
  JSON, imports transitifs, PDF et ancres. Test du callback en forme
  PROD intégralement interceptée et activation réelle sur Auth local. Une
  requête Auth dynamique volontairement non versionnée ne change pas les
  assertions de versionnement des ressources statiques.
- **Mise à niveau depuis le SHA publié.** Deux versions servies tour à tour
  sur la même origine locale, en gardant le profil de navigateur. Cours
  coché, tentative QCM, première réponse Drill, réponse botanique et
  préférences ITK/apparence ont été créés par l’ancienne interface. Le
  candidat retrouve le cours, la tentative, les valeurs ITK et l’apparence.
  Les cinq valeurs brutes historiques restent identiques. L’ancienne page
  du profil pouvait revenir du cache. Après rechargement normal et forcé,
  les ressources statiques échantillonnées portent le SHA attendu.
- **File personnelle et repli.** Un compte fictif avait une tentative
  confirmée et une seconde en attente sur l’ancien frontend lors de la
  coupure API. Le candidat retrouve la même opération dans IndexedDB
  pendant la coupure. Après retour réseau, elle est confirmée avec le même
  identifiant. Deux tentatives distinctes sont retrouvées avec le JWT
  étudiant. Après repli les deux tentatives, la session, la notice V1.1 et
  les cinq valeurs visiteur restent accessibles. La base et les paramètres
  de la stack restent les mêmes pendant les bascules.
- **Lecture de Pages, 20 novembre.** Accueil, connexion, récupération,
  profil, callback sans preuve, contact, notice, calendrier et bibliothèque
  renvoient 200 et le SHA publié du 8 novembre. `Cache-Control: max-age=600`
  a été observé sur les neuf réponses. Les cinq champs publics Auth
  correspondent à la forme attendue. Le run #64 ne renvoie aucun artefact
  réutilisable via l’API. Le repli qualifié est un build depuis Git avec
  paramètres fictifs. [Procédure opérateur](../deploiement/PLAN-PUBLICATION-2027.md#retour-arrière-frontend).

## Accessibilité et rendu

Contrastes, titres, commandes, libellés, focus, messages, états de
chargement, dialogues et retours de focus ont été contrôlés par les suites
navigateur. Six pages critiques sous le préfixe ont été mesurées à
320, 390, 768, 1 024 et 1 440 px. Contact et Confidentialité ont été revus
sur ordinateur et mobile, y compris sombre, contraste forcé et navigation
sans JavaScript. Zoom Chromium natif 200 % et 400 % sur ces deux pages.
Les essais d’apparence couvrent saisons, luminosité, automatique et
mouvement réduit. Les [preuves de #78](VALIDATION-UI-2027-PR5-LOT2.md#galerie-thèmes-responsive-et-accessibilité)
couvrent aussi le menu du cours, le dialogue de détail et les paramètres.

## Performance

Trois passages alternés avant/après sur Chromium 156, cache froid,
1 440 × 1 000 px, CPU ×4, latence 20 ms, débit 1,25 Mo/s, banc sans
compression. Référence avant #78 `2dbe4336690a50684bc52e54b65081961e1b9482`.
Médianes arrondies en millisecondes. Les interactions sont mesurées
de l’action à la deuxième image rendue.

| Mesure | Référence → candidat |
| --- | ---: |
| Bibliothèque officielle, LCP | 1 092 → 1 072 |
| Bibliothèque officielle, menu / filtre / tri / réinitialiser | 37 → 34 / 19 → 20 / 23 → 21 / 35 → 31 |
| 600 fiches fictives, LCP | 2 172 → 2 160 |
| 600 fiches fictives, menu / filtre / tri / réinitialiser | 434 → 441 / 490 → 519 / 443 → 451 / 1 081 → 1 126 |
| Tableau de bord, LCP / filtre / actualiser | 1 396 → 1 372 / 128 → 123 / 61 → 63 |
| ITK, LCP / chronologie / dialogue | 1 252 → 1 252 / 112 → 109 / 105 → 107 |

Le catalogue officiel reste dans les budgets. Le scénario à 600 fiches
reproduit les dépassements signalés dans #78, avec un budget d’interaction
de 200 ms dépassé sur les deux versions. Les écarts du filtre et de la
réinitialisation portent sur la fixture de charge. Le R27-04 reste P2 à
revoir si le volume du catalogue augmente. Ce banc mesure des médianes
locales et ne mesure pas l’INP des participants.

## Prérequis et décision

| Statut | Prérequis et preuve |
| --- | --- |
| Validé dans son périmètre | Migration du frontend et repli local sur données fictives. Structure, RLS et persistance réelle sur stack Docker. Dernier SHA Pages vérifié en HTTP sans compte. |
| Validé à sa date | Le point de sauvegarde applicatif PROD des dix tables du **18/11 à 13:09:16 CET** a été restauré et vérifié le même jour en PostgreSQL isolé. Échéance **25/11 à 13:09:16 CET**. Périmètre limité aux données applicatives, hors Auth, sessions, Storage et données en attente locale. Reprise complète hébergée et RTO restent à démontrer. [Preuve du 18 novembre](VALIDATION-PREMIERE-INVITATION-PROD.md). |
| À recontrôler au lancement | Sauvegarde restaurable, fraîcheur et journal courant, réglages Auth et adresse de retour, variables publiques du workflow, vérification de la cible et SHA réel. Le circuit de récupération et le plafond administratif restent liés à l’outil opérateur. |
| Réserve ouverte | La preuve Admin 2.2 couvre le renouvellement local. Le relevé Auth PROD à 86 400 s et le renouvellement réel demandent une décision propre. La suppression PROD reste bloquée dans le binaire. Safari et lecteur d’écran natif restent à recetter selon les navigateurs des participants. |
| Bloquant pour la publication | Approbation explicite du texte V1.2. Revue du SHA exact et décision écrite de l’exploitant sur le lancement et sa recette hébergée. |

**Verdict technique : GO PARTIEL.** Aucun P0 observé dans le périmètre
exercé. Le P1 de cohérence du profil est corrigé dans le candidat.
La couverture navigateur et aides techniques comporte les réserves ci-dessus.
Les défauts P2 concernent les performances de la fixture de charge et la
revalidation d’un ancien HTML. L’incident isolé de chargement de feuille de
styles est documenté avec son diagnostic et ses rejeux.

**Statut d’autorisation : PUBLICATION NON AUTORISÉE.** La V1.2 attend
l’approbation. La recette ne déclenche aucune fusion, publication ni mutation
PROD. L’exploitant dispose du [plan de décision et de lancement](../deploiement/PLAN-PUBLICATION-2027.md).
