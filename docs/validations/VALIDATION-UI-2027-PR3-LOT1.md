# UX/UI 2027 — PR3, lot 1 : UC et lecture

Base : PR #61 fusionnée, `fe2f7e318d7ca3fa447a6b8807c78b4197c1964a`.
Branche : `feat/ui-2027-learning-experience`. Validation du 16 novembre 2026.
[PR #63 ouverte](https://github.com/Vladoche/mon-bprea/pull/63), sans fusion ;
aucune publication Pages ou mutation PROD. Les
[checks](https://github.com/Vladoche/mon-bprea/pull/63/checks) et artefacts finaux
sont liés dans la description de la PR.

La finalisation reprend les travaux locaux préservés après interruption de la
première session avant commit. `origin/main` a depuis intégré la maintenance
documentaire #62, fusionnée le 16/11 à 13:53:25 UTC ; la branche a été avancée à
`ae1d66f8c98360928d64a395a155c52f8eb972f4`, puis les changements PR3 réappliqués.
Les changements de #62 sont documentaires : les références visuelles et mesures
avant/après #61 restent applicables au code des pages. L’état central, le
changelog, la fiche de reprise et les guides architecture/navigation sont
actualisés ensemble. La CI finale et les artefacts sont suivis dans la PR.

## Présentation et contrats préservés

`assets/learning-pages.js` regroupe le rendu des UC, les listes de chapitres et
la présentation des cours. `assets/app.js` conserve le routage, l’initialisation
des services, les abonnements et le traitement asynchrone de complétion.
`assets/learning-pages.css` est chargé uniquement par `uc.html` et `cours.html`.
Il réutilise les tokens, pictogrammes SVG et boutons communs de PR1/PR2c.
Le header, les hubs, le footer, les QCM, le Drill et les statistiques gardent
leurs interfaces et leurs styles.

Les sept unités, les quatre leçons UC 03, leurs descriptions, durées, niveaux,
corps HTML, essentiels et QCM proviennent exclusivement de `assets/content.js`,
inchangé. Aucun contenu supplémentaire n’est ajouté au site. Les données
synthétiques des tests restent dans les fixtures navigateur.

| Avant | Après |
| --- | --- |
| Introduction séparée et longues lignes de cours | En-tête compact, chapitres ouverts, cartes de cours délimitées et lien direct |
| Aucun état explicite pour les cours non terminés | « À découvrir », « Terminé » ou « Progression indisponible » selon le modèle vérifié existant |
| Ratio 0/0 pour une UC sans cours | « Contenus à venir », vrai titre, retour aux sept unités et exemple UC 03 ; aucune barre de progression |
| Texte pédagogique de 14 px | Texte de 18 px sur ordinateur, 17 px sur petit écran, interligne 1,85 et mesure maximale de 70 ch |
| Pas de sommaire interne | Navigation dérivée des vrais H2/H3, URL avec fragment et focus sur le titre |
| Complétion et QCM mêlés au corps | Synthèse distincte, contrôle de complétion, un seul CTA principal QCM et suite dans la même UC |

À 1000 px et moins, le sommaire, l’article et ses ressources, l’essentiel puis
la fin de cours suivent un flux unique. Aucun élément sticky ni flou nouveau.
Les schémas conservent leur ordre et leur sens ; les tableaux ont une région
nommée, focalisable et défilante horizontalement, sans débordement de page.
Les six unités sans cours conservent aussi leurs ressources réelles et
l’avertissement distinguant intitulés nationaux et contenus indépendants.

## Ancres et progression

Les ancres des chapitres réutilisent `chapterAnchor()` et restent compatibles
avec le fil d’Ariane. Les titres de cours conservent tout identifiant existant ;
les nouveaux identifiants dérivent de leur texte, avec suffixe en cas de
collision avec un ID déjà présent. Les textes des titres restent intacts.
Les liens sont natifs : clavier, fragment direct, rechargement et historique
du navigateur restent utilisables. Aucun suivi de position ou stockage ajouté.

La présentation UC réutilise `updateLearningOverview()` et son modèle existant,
sans nouveau calcul de progression. La case du cours utilise la même lecture
vérifiée : un booléen illisible ou une source ambiguë n’est pas annoncé comme
un cours terminé. Le contrôle est alors désactivé avec sa raison associée.
`setCourseDone()` reste l’unique action manuelle : pas de complétion au scroll.
La gestion de sauvegarde, l’époque, le changement de compte, la relecture et
la restauration du focus restent dans leur gestionnaire existant.

Les ressources sont toujours rendues par `resource-library.js`, sans changement
de catalogue, de classement, de destination ou de source. Le nombre de questions
du CTA vient de `lesson.quiz.length`. La suite filtre l’UC et suit `order` ;
le dernier cours revient à son UC, sans passage vers une autre unité.

## Vérifications

Node.js 24.22.0, `npm ci`, Chromium verrouillé 156.0.8078.4.

- `npm test` : 624 réussis, 1 ignoré ; tri pédagogique et limite d’UC compris.
- `npm run test:e2e -- --workers=2` : **161 réussis** en 3,3 minutes.
  Après amélioration du cadrage des captures, les **14 scénarios PR3** sont
  repassés en 15 secondes. Non-régression : accueil, hubs, menus, QCM, Drill,
  statistiques, calendrier, ITK, ressources, botanique, profil, apparence,
  synchronisation, export, restauration et effacement.
- Suite E2E PR3 : unités disponibles/vides, progression visiteur/personnelle,
  états inconnus, contenu intact, sommaires, collisions, ancres, QCM, ressources,
  complétion réversible et rechargement, erreur IndexedDB puis reprise, retour
  tardif de sauvegarde de A après passage à B, unité synthétique de 30 cours.
- Responsive : 320, 390, 768, 1024 et 1440 px, pour UC 03, UC vide et les
  quatre cours, en taille normale puis avec racine typographique à 200 %.
  L’ordre mobile et le défilement clavier limité aux tableaux sont contrôlés.
- Accessibilité : H1 unique, titres réels conservés, fil d’Ariane, noms de liens,
  clavier et focus aux ancres, raison du contrôle désactivé, contraste des textes
  dans les huit palettes (minimum **4,71:1**), case de complétion (**3,06:1**)
  et focus (**6,49:1**), mouvement réduit,
  contraste forcé et rendu sans filtre. Les états ont tous un libellé textuel.
- SDK reconstruit identique ; notice approuvée reproductible ; diff des contenus,
  services, Auth et styles partagés vide. `git diff --check` vérifié.

Finalisation après intégration documentaire #62 : `npm test` rejoué, **624
réussis, 1 ignoré** ; **14 E2E PR3 réussis** en 15,7 s. Le scénario de galerie
complété a ensuite réussi en 6 s, avec sombre mobile obtenu par le bouton
d’apparence et compléments texte à 200 %/contraste forcé désormais joints en CI.
La capture mobile sombre manuelle de la première session présentait une palette
incohérente ; elle a été remplacée par ce rendu reproductible, vérifié visuellement.
Aucun code applicatif n’a changé depuis les 161 E2E complets de la première
session ; la CI réexécute la suite générale sur la tête finale. SDK et notice
de nouveau vérifiés, guides et liens locaux concernés relus.

Les simulations HTTP utilisent des comptes fictifs `.invalid` et le véritable
client/service navigateur avec IndexedDB. Elles ne constituent pas une preuve
RLS ou une recette DEV/PROD. La sécurité réelle est un check CI distinct,
exclusivement sur stack éphémère.

## Captures et performance

Les six images avant refonte sont versionnées dans
`tests/fixtures/ui-2027-pr3-lot1/`, avec leur provenance. La suite PR3 produit
les nouvelles captures et `revue-lecture.html` dans `test-results/` : UC 03 et
UC vide ordinateur/mobile, cours complet avant/après, début/milieu/fin, sommaire,
tableau, schéma, essentiel, complétion, progression et sombre. Le scénario
d’erreur joint `course-save-error.png`. Aucun snapshot n’est approuvé automatiquement.
La galerie inclut aussi la lecture mobile sombre, le texte à 200 % sans
filtre et la complétion en contraste forcé, inspectés visuellement et régénérés
par le scénario de captures.
Point d’entrée local : `.tmp/ui-2027-pr3-lot1/review/revue-lecture.html`.
Les captures initiales d’implémentation et les mesures locales restent dans
`.tmp/ui-2027-pr3-lot1/`, conservées pour revue jusqu’à clôture du lot.

Le job E2E publie ces pièces dans l’artefact Playwright existant (14 jours).
Le job `ui-performance-lab` ajoute UC 03, UC vide, matière organique et C/N aux
mesures existantes, et conserve leurs JSON dans son artefact. La référence CI
est le SHA de base de la PR ; la campagne locale utilise le SHA #61 ci-dessus.

Méthode : cinq chargements froids alternés avant/après, 1440 × 1000,
automne/clair, CPU ×4, réseau 20 ms / 10 Mbit/s, serveur sans compression,
aucun trafic extérieur et aucun test concurrent. LCP, CLS et ses sources,
requêtes, octets CSS/JS, disponibilité du contenu et interactions sont mesurés.
`course-reading-init` mesure la dérivation du sommaire et l’adaptation des
tableaux ; les clics sommaire/complétion mesurent la présentation à deux frames.
Ces chiffres de laboratoire ne sont pas un INP de terrain.

| Page | LCP médian (ms) | CLS | Contenu disponible (ms) | Requêtes |
| --- | ---: | ---: | ---: | ---: |
| UC 03 | 1448 → 1500 | 0 → 0 | 1558 → 1634 | 78 → 80 |
| UC vide (UC 01) | 1448 → 1272 | 0 → 0 | 1516 → 1547 | 77 → 79 |
| Matière organique | 1504 → 1564 | 0 → 0 | 1560 → 1638 | 78 → 80 |
| C/N | 1444 → 1540 | 0 → 0 | 1479 → 1578 | 77 → 79 |

CSS : **67 434 → 79 876 octets** ; JavaScript : **803 228 → 808 829 octets**.
Deux requêtes supplémentaires : feuille dédiée et module de présentation.
Aucun budget diagnostique dépassé, aucune erreur JS/réseau dans les 40
chargements, aucun décalage observé à l’arrivée de la progression. Le LCP
augmente de 52 à 96 ms sur les pages avec cours et diminue sur l’UC vide.

Initialisation du sommaire et des tableaux : médianes **3,9 ms** (matière
organique) et **4,2 ms** (C/N), CPU ×4. Présentation du clic d’ancre : **24,7 ms**
pour chacun. Présentation du clic de complétion : **28,5 / 34,6 ms** après
refonte. Clic → observation du statut terminé : **37,7 → 33,9 ms** et
**40,9 → 40,9 ms**, avec le coût d’orchestration Playwright inclus ; il ne
s’agit pas d’une mesure isolée du service. Les JSON conservent les cinq valeurs
et les sources de CLS. La suite générale a réussi sur le code applicatif final.

## Limites et revue

Après arrêt des tests et simulation avec processus inactifs,
`npm run delivery:complete` a réussi : **135,22 Mo libérés**, 876 fichiers,
zéro échec ; **2 933,09 Mo conservés**. Le plafond de 500 Mo reste dépassé par
les preuves et groupes protégés/non qualifiés, sans purge supplémentaire.

Pas d’appareil physique, de lecteur d’écran ou de zoom natif revendiqué.
Le texte à 200 % est simulé par la taille racine ; la conformité WCAG complète
n’est pas certifiée. L’unité longue reste synthétique, les contenus réels
restent limités à quatre cours dans un seul chapitre. La revue esthétique
humaine et la décision de fusion restent nécessaires. Aucun changement de
contrat de stockage/synchronisation, de migration ou de réglage Auth.
