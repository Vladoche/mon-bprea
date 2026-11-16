# Changelog

Historique synthétique du code et de sa documentation, sans versionnement SemVer
du frontend. Les dates ci-dessous sont les **dates de fusion UTC**, vérifiées sur
GitHub le 16 novembre 2026. Une fusion ne prouve pas une publication : consulter
l’[état actuel](docs/developpement/ETAT-DU-PROJET.md) et le
[registre Pages](docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#registre-de-publication-pages).
La version de l’application Windows reste propre à cet outil.

## Non publié

- PR3 lot 1 — UC et lecture : chapitres et cours délimités, unités vides,
  typographie de lecture, sommaire interne, tableaux défilants et fin de cours.
  Contenus, ressources, progression et synchronisation conservés ; QCM/Drill/
  statistiques hors refonte. [PR #63](https://github.com/Vladoche/mon-bprea/pull/63)
  ouverte sur `feat/ui-2027-learning-experience`, non fusionnée.
  [Validation](docs/validations/VALIDATION-UI-2027-PR3-LOT1.md).
- Maintenance documentaire #62 fusionnée ; voir l’entrée datée ci-dessous.
- Frontend fusionné après le dernier commit publié : refonte 2027 #59–#61
  détaillée ci-dessous. Les versions Windows sont distribuées par leur workflow
  propre ; les preuves documentaires #52–#55 ne constituent pas une publication Pages.

Pour une prochaine PR significative, ajouter ici un intitulé stable et son lien
dès que le numéro est connu. À la reprise après fusion, inscrire la date réelle
et conserver le statut de publication séparément ; ne jamais exiger le futur SHA
de merge dans la PR elle-même. Une correction de ponctuation n’impose pas d’entrée.

## 2026-11-16

### Documenté — [#62](https://github.com/Vladoche/mon-bprea/pull/62), état et historique

État central du projet, changelog, registre Pages et guides synchronisés avec le
code. Fusion le 16/11 à 13:53:25 UTC, `ae1d66f8c98360928d64a395a155c52f8eb972f4`.
Cette maintenance ne publie pas le site et ne renouvelle pas les preuves PROD.

### Corrigé — [#61](https://github.com/Vladoche/mon-bprea/pull/61), PR2b/PR2c

Accueil panoramique avec visuel local, carnets et hubs harmonisés ; menus ancrés
à leurs contrôles, états actif/ouvert distincts et hover stable. URL, données et
calculs conservés. [Validation](docs/validations/VALIDATION-UI-2027-PR2B.md).

## 2026-11-15

### Modifié — [#60](https://github.com/Vladoche/mon-bprea/pull/60), accueil et hubs PR2

Refonte de l’accueil, Mes cours, S’exercer et Outils, avec progression et reprise
fiables. Anecdote réservée à Mes cours, bandeau d’examen retiré de l’accueil et
commandes détaillées cours/QCM déplacées dans Profil ; sauvegardes automatiques
conservées. [Validation](docs/validations/VALIDATION-UI-2027-PR2.md).

### Ajouté — [#59](https://github.com/Vladoche/mon-bprea/pull/59), fondations graphiques PR1

Tokens, header/footer communs, navigation, paramètres d’apparence dans Profil et
harmonisation de Contact/Confidentialité sans changement du texte approuvé.
[Validation](docs/validations/VALIDATION-UI-2027-PR1.md).

### Ajouté — [#58](https://github.com/Vladoche/mon-bprea/pull/58), Admin Windows V1.2

Préparation graphique de clôture, journal compatible et stockage Auth Windows
facultatif. **Suppression PROD bloquée** dans la distribution ; exécuteur testé
uniquement sur stack fictive locale. [Guide et limites](tools/mon-bprea-admin/README.md).

## 2026-11-14

### Ajouté — [#57](https://github.com/Vladoche/mon-bprea/pull/57), Admin Windows V1.1

Récupération assistée d’un compte confirmé sélectionné, contrôles d’identité,
lien privé et journal durable partagé avec le circuit Node.
[Guide](tools/mon-bprea-admin/README.md).

## 2026-11-12

### Ajouté — [#56](https://github.com/Vladoche/mon-bprea/pull/56), Admin Windows V1

Application autonome pour consulter les comptes Auth et inviter individuellement,
avec préflight, confirmation et conservation privée des opérations.
[Guide et distribution](tools/mon-bprea-admin/README.md).

## 2026-11-08

### Qualifié — [#55](https://github.com/Vladoche/mon-bprea/pull/55), circuit de clôture

Circuit opérateur droits/clôture, suppression native et réconciliation après
restauration qualifiés avec comptes fictifs isolés ; aucune suppression réelle
PROD. [Preuves](docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#qualification-opérationnelle-de-p0-13--8-novembre-2026).

### Qualifié — [#54](https://github.com/Vladoche/mon-bprea/pull/54), sauvegarde applicative

Premier point applicatif des dix tables restauré et vérifié en PostgreSQL isolé.
RPO satisfait à cet instant ; Auth et reprise complète hébergée restent exclus.
[Preuve datée](docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#point-de-reprise-applicatif-du-8-novembre-2026).

### Qualifié — [#53](https://github.com/Vladoche/mon-bprea/pull/53), premier compte réel

Activation de l’exploitant et persistance cours/QCM/Drill après reconnexion sur
deux navigateurs ; pas de second compte ni de récupération réelle qualifiés.
[Recette](docs/deploiement/PLAN-PREOUVERTURE-PRIVEE.md#recette-du-seul-compte-exploitant--8-novembre-2026).

### Corrigé / préparé — [#50](https://github.com/Vladoche/mon-bprea/pull/50), [#51](https://github.com/Vladoche/mon-bprea/pull/51), [#52](https://github.com/Vladoche/mon-bprea/pull/52)

Préparation du frontend Auth PROD et de la notice approuvée, verrouillage du
workflow sur lancement manuel autorisé, puis correction de la validation de
notice avant dépôt Pages. #52 consigne la première publication Auth réussie,
événement distinct tracé dans le [registre Pages](docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#registre-de-publication-pages).

### Ajouté — [#49](https://github.com/Vladoche/mon-bprea/pull/49), Auth sur invitation

Configuration d’accès privé, inscriptions publiques et anonymat fermés, et
exécuteur administratif distinct de liens individuels. Aucun quota serveur
de sept comptes déduit du plafond administratif.
[Contrat et preuves Auth](docs/architecture/AUTHENTIFICATION.md).

## 2026-11-07

### Qualifié — [#48](https://github.com/Vladoche/mon-bprea/pull/48), installation initiale PROD

Installation autorisée P puis M1–M5 et contrôles de structure, permissions et RLS,
avec archive initiale préservée. La qualification locale préalable et les limites
de reprise restent distinctes des comportements hébergés.
[Runbook et résultat](docs/architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md).
