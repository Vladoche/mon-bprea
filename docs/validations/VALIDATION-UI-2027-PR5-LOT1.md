# Mon profil 2027 · validation de PR5 lot 1

Recette du 19 novembre 2026. Base `469ceebd44fee995eb5433e47e9d3f927d8044af`, issue
de [la fusion #76](https://github.com/Vladoche/mon-bprea/pull/76).

## Audit et décisions

Avant la refonte, `auth-pages.js` montait l’export et l’effacement après
l’initialisation Auth. L’export montait à son tour la restauration JSON.
Trois feuilles dédiées étaient chargées par `profil.html`. Ces montages et
leurs nettoyages ont été retirés. Le navigateur peut encore charger les
modules publics et consulter les données qu’il détient. RLS et les
privilèges Supabase continuent à régir les accès serveur.

| Section | Contenu et contrat |
| --- | --- |
| `#informations-compte` | L’UUID confirmé conditionne l’affichage de l’e-mail, de la date en français (Europe/Paris) et du pseudo. Le pseudo courant change après la réponse serveur. La valeur vide envoie `NULL`. Un échec préserve la saisie. Récupération assistée et déconnexion sont accessibles ici. |
| `#parametres` | Dialogue existant pour la saison et la luminosité. Les visiteurs peuvent mémoriser ou retirer leurs choix sur l’appareil. Les comptes utilisent le service de paramètres personnels avec les états, imports confirmés et conflits existants. |
| `#donnees-synchronisation` | État de sauvegarde des cours et QCM, commandes de relecture, import volontaire depuis l’historique de cet appareil et résolution des conflits. Les notices pédagogiques continuent à pointer directement vers cette section. |

Les champs personnels sont affectés en texte ou en valeur de champ. Les
révisions de session et la génération de rendu écartent les résultats
tardifs. Une identité hors ligne seule donne accès à la vérification de
session. À la sortie de la page, la vue privée est retirée. Sur retour depuis
BFCache, un rechargement recrée les abonnements et la vérification Auth.

Les moteurs `export-*`, `restore-*` et `erasure-*` sont conservés. Les tests
de leurs interfaces passent par `tests/helpers/maintenance-fixture.js`, qui
les injecte dans les seuls contextes Playwright concernés. Le profil public
et son artefact Pages excluent ce script de test. Les demandes individuelles de
copie et de suppression passent par le canal existant, avec la procédure
assistée décrite dans la notice. [Contact](../../contact.html) ·
[Confidentialité](../../confidentialite.html#vos-droits-et-la-cloture).

## Fichiers et contrôles

- `profil.html`, `assets/profile.css` et `assets/auth-pages.js` portent les
  sections, le formulaire et la durée de vie de la vue. `auth.css` est
  débarrassé des anciens styles du profil. `appearance.{js,css}` et
  `course-quiz-ui.js` reprennent les commandes `btn-surface` du système 2027.
- `tests/e2e/profile.spec.js` vérifie les états du compte, le pseudo Unicode
  et son format, les échecs et doubles soumissions, la sortie de session, les
  réponses tardives A → B, le retour navigateur, les ancres, le visiteur,
  deux onglets et l’absence des outils retirés. Les tests historiques de
  présentation d’export, de restauration, d’effacement et de clôture sont
  exercés sur leur page de test. Les tests de services sont conservés.
- `npm test` a réussi avec 680 tests et un ignoré. Le SDK verrouillé s’est
  reconstruit à l’identique. pgTAP a réussi avec 414 assertions et les suites
  Auth, Drill et données personnelles ont réussi leurs 12, 22 et 26 groupes
  sur la stack fictive.
- Les réglages, les conflits et les opérations des cours et QCM sont aussi
  vérifiés sur PostgreSQL et Auth réels en local. Les parcours synthétiques
  permettent de retenir les réponses et d’observer l’interface avant
  acquittement.

## Galerie et accessibilité

`profile-review/index.html` contient les comparaisons avec le même compte
fictif, à 390, 768 et 1 440 × 1 000 px. `boutons.html` compare le header,
l’ITK, la bibliothèque, la botanique, le compte et les paramètres.
Les PNG et `controles.json` sont générés par le [workflow Qualité](../../.github/workflows/quality.yml)
dans l’artefact `ui-performance-lab`. En local, ils sont sous
`.tmp/ui-2027-foundations/profile-review/`.

Les captures couvrent le profil vide et renseigné, l’enregistrement, l’erreur,
les paramètres, le visiteur, les saisons en sombre, la sauvegarde confirmée,
une opération en attente hors ligne, le conflit, l’import et le contraste
forcé. Le zoom natif Chromium à 200 % a été vérifié à 390 px CSS (780 px
physiques), sur la page et le dialogue. Les cinq largeurs de 320 à 1 440 px
passent le contrôle de débordement horizontal. Le retour de focus fonctionne
après Échap. À 200 % de taille de texte, le formulaire et les commandes gardent
leur retour à la ligne.

Les contrôles comparent rayon, bordure, dégradé, ombre, reflet et focus aux
surfaces du header. Les commandes du profil présentent un contraste calculé
de 4,73:1 à 11,37:1 au repos en automne clair et sombre. Les vues de
survol, de focus, d’appui et d’enregistrement désactivé illustrent les
transitions. La page complète à 390 px passe de 8 163 à 2 507 px de haut,
footer inclus.

## Performance de laboratoire

Médianes de trois paires alternées par version à 1 440 × 1 000 px, cache froid,
CPU ralenti ×4, latence 20 ms et débit 1,25 Mo/s. Le laboratoire sert les
sources sans compression et utilise un compte et des réponses HTTP fictifs.
Les temps d’action vont de l’événement à la deuxième image après le changement
attendu. Le temps de confirmation inclut l’acquittement HTTP fictif.

| Mesure | Avant | Après |
| --- | ---: | ---: |
| JavaScript décodé | 1 040 394 octets | 906 675 octets |
| CSS décodé | 64 923 octets | 63 966 octets |
| Requêtes | 97 | 82 |
| LCP | 1 444 ms | 344 ms |
| CLS | 0,011 | 0,012 |
| Profil avec formulaire | 2 046 ms | 1 577 ms |
| Préférences chargées | 2 136 ms | 1 671 ms |
| Ouverture du dialogue d’apparence | 69 ms | 56 ms |
| Saisie du pseudo | 43 ms | 38 ms |
| Confirmation du pseudo | 87 ms | 88 ms |

Le titre s’affiche avant la vérification Auth. La mesure du formulaire
indique séparément le moment où le compte est utilisable. La campagne n’a
levé aucun signal de dépassement des budgets du laboratoire. Les résultats
bruts sont dans `performance-profile.json`.

## Portée

La PR couvre le frontend de Profil et ses contrôles. La recette Supabase
utilise des comptes fictifs sur une stack Docker dédiée. La revue humaine
porte sur la galerie et les commandes en clair et sombre.
