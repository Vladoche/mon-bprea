# Validation du lot 5.2 — Reconnaissance botanique

Date : **21 octobre 2026**. Branche : `feature/reconnaissance-botanique-lot5-2`, créée après `git fetch origin` depuis `origin/main` au commit `3e67656` (fusion de la PR du lot 5.1). L’arbre de travail était propre avant les modifications. Aucun travail direct sur `main`, aucune modification de protection, aucune fusion ni publication Pages déclenchée par l’agent.

## Périmètre livré

Page `reconnaissance-plantes.html`, menu et carte Outils, fil d’Ariane, sélection pilotée par JSON, modes Découverte et Chrono configurable, quatre propositions distinctes compatibles, corrections sourcées, révision facultative et historique local indépendant. Les corrections et les onglets masqués arrêtent le décompte ; une pause manuelle et la reprise d’une page conservée en mémoire sont prises en compte. Une image indisponible peut être passée hors calcul.

La banque contient **12 taxons, 12 photographies locales, trois catégories jouables de quatre questions** (Petits fruits, Fleurs, Légumes maraîchers). Légumineuses est explicitement incomplète et désactivée. Images JPEG de côté maximal 960 px, **2 092 902 octets au total**. Les licences vérifiées individuellement sont **6 CC0, 4 CC BY-SA 3.0, 1 CC BY-SA 2.5, 1 CC BY 2.5**. Auteur, source, licence et modifications sont affichés au voisinage de la photo ; son titre original est consultable dans « Crédit complet ». Le crédit demandé par Luc Viatour est conservé.

Sources botaniques : NC State Extension et Royal Botanic Gardens, Kew ; fichiers photographiques et crédits : pages individuelles Wikimedia Commons. Le [registre des sources](../architecture/BOTANICAL-SOURCES.md) détaille les contrôles, les auteurs et les limites de chaque photographie. Toutes les images finales ont été examinées visuellement. Les explications distinguent les caractères visibles sur la photo des caractères généraux.

## Commandes réellement exécutées

Environnement local : Windows, **Node.js v24.22.0**, npm 10.4.0, Python disponible, Chromium Playwright. Installation reproductible avec `npm ci` ; vérification/installation Chromium avec `npx playwright install chromium`. Aucune nouvelle dépendance de développement ou de production.

| Vérification | Résultat final observé |
| --- | --- |
| `npm test` | **9 fichiers, 60 tests réussis**, code 0 ; dernier passage : 300 ms |
| Tests botaniques ciblés Vitest | **23 réussis** : 12 unitaires et 11 d’intégration ; inclus dans le passage complet |
| `npm run test:e2e` | **12 scénarios Chromium réussis**, code 0 ; dernier passage : 8,0 s |
| `node --check` sur les nouveaux modules et scénarios | Réussi |
| `git diff --check` | Réussi avant livraison |
| `python scripts/prepare-pages.py --version lot5-2-final --output .tmp/lot5-2-final/mon-bprea` | **78 fichiers publics, 152 références versionnées** ; code 0 |
| Contrôle du contenu de l’artefact par script Node | Page et CSS présents, imports transitifs/JSON versionnés, 12 photos présentes, `.nojekyll` présent, outils/tests/docs/npm exclus |

Les premières tentatives exécutées dans le bac à sable Windows restaient bloquées pendant l’arrêt du serveur Playwright. Les exécutions autorisées hors bac à sable se sont terminées normalement, sans changer la configuration du site ni viser la production. Des essais intermédiaires lancés pendant la constitution du catalogue (`photos: []`) ont échoué pour absence de catégorie jouable ; les validations finales utilisent la banque complète.

Un passage complet a aussi révélé une course dans le test du préfixe : une réponse tardive de la navigation préalable sur les sources (`/assets/daily-facts.json`) était recueillie dans l’audit de l’artefact. La trace réseau et la capture d’échec ont été examinées. Le contrôle de l’artefact utilise maintenant une page de navigateur distincte avec la même horloge contrôlée ; il continue de vérifier chaque réponse CSS/JS/JSON sans filtrer d’éventuelles régressions de préfixe. Le passage complet suivant a réussi avec **12/12 scénarios**.

## Risques couverts par les tests

- Sélection par catégorie, génération de dix questions lorsque la banque le permet, séries courtes, catégories impossibles et métadonnées photographiques incomplètes ; rejet des chemins d’image non sûrs.
- Quatre propositions uniques, une seule bonne réponse, absence de noms/taxons dupliqués et de répétition d’espèce dans la partie ; priorité aux relations de confusion lorsqu’elles sont définies dans les fixtures.
- Correction correcte/incorrecte, timeout distinct et photographie passée hors calcul ; chrono avec horloge simulée, pause/reprise sans addition de déclenchements d’intervalle.
- Statistiques pondérées, données vides/invalides, dédoublonnage des tentatives, révision d’une erreur même après réussite et photo alternative lorsqu’une fixture en fournit plusieurs.
- Persistance et relecture, réponses immédiatement sauvegardées, nouvelle session sans obligation de finir la précédente, clés existantes inchangées, champs/lignes inconnus conservés, JSON corrompu/schéma futur en lecture seule, stockage bloqué ou saturé.
- Parcours Découverte complet et révision, historique après rechargement, Chrono configurable avec expiration et pauses manuelle/visibilité, cycle `pagehide`/`pageshow`, image inaccessible, navigation mobile, clavier, clair/sombre et saison hiver.
- Régressions ciblées existantes : navigation à trois rubriques, Drill/première réponse/rechargement, Dashboard, calendrier/examens, ITK/export CSV, PDF, apparence et anecdote. La logique métier de ces modules n’a pas été modifiée.
- Page botanique, CSS, imports et JSON servis sous `/mon-bprea/` depuis l’artefact préparé ; photos locales, aucune dépendance à un service photo distant pour les E2E.

## Vérification visuelle réellement effectuée

Inspection avec Playwright MCP sur un serveur **local isolé** servant un artefact sous `/mon-bprea/`, sur ordinateur et à une largeur mobile de 390 px : sélection, photographie, quatre choix, correction botanique, crédits, Chrono en pause, résultats et historique. Les thèmes clair et sombre ont été examinés. Les photos gardent leurs proportions et les textes restent lisibles ; les tableaux larges sont dans un conteneur à défilement horizontal. Le contraste des propositions validées et des catégories indisponibles a été renforcé en supprimant leur opacité réduite.

Captures de contrôle conservées uniquement dans `.tmp/` (ignoré par Git) : sélection ordinateur, correction ordinateur, correction mobile sombre, Chrono mobile clair/sombre, résultats et historique mobile. Aucun profil ni stockage personnel de l’utilisateur n’a été utilisé ou effacé.

## Actions GitHub

Versions majeures officielles vérifiées : `checkout@v7`, `configure-pages@v6`, `deploy-pages@v5`, `upload-pages-artifact@v5`, `setup-node@v7`, `upload-artifact@v7`. Les manifestes JavaScript déclarent Node.js 24 ; l’envoi Pages est composite et utilise Upload Artifact v7. `include-hidden-files: true` conserve `.nojekyll` dans l’artefact préparé. Permissions, déclencheurs, cache npm, SHA de version, chemin de publication et noms requis **`unit-integration`** / **`e2e`** sont conservés. Sources et détails : [ACTIONS-NODE24.md](../architecture/ACTIONS-NODE24.md).

La [PR nº 7](https://github.com/Vladoche/mon-bprea/pull/7) a été créée en brouillon vers `main`. La [CI Qualité nº 3](https://github.com/Vladoche/mon-bprea/actions/runs/39634055188), déclenchée automatiquement par son ouverture sur le commit `d64e5c4`, a réussi dans l’environnement GitHub : **`unit-integration` : 9 fichiers, 60 tests réussis ; `e2e` : 12 scénarios réussis (14,6 s)**. Les résultats et étapes des deux jobs ont été relus, ainsi que les lignes de résultat des journaux. Cela vérifie réellement les actions de Qualité sur les runners GitHub avec Node.js 24.

Les workflows n’ont pas été déclenchés manuellement par l’agent pour valider le déploiement. La préparation locale de l’artefact ne constitue pas un déploiement réel ; les actions du workflow de publication ont été vérifiées dans leurs sources officielles mais l’agent n’a pas lancé ce workflow.

Pendant la finalisation, GitHub a signalé la fusion externe de la PR nº 7 le 21 octobre à **18 h 22 min 54 s Europe/Paris**, commit `7a2c485`. Aucune action de fusion n’a été effectuée par l’agent. Le compte rendu CI, ajouté après cette fusion, fait l’objet d’une PR de documentation distincte ; aucun code applicatif supplémentaire n’y est inclus. Le workflow existant peut se déclencher automatiquement sur une fusion vers `main` ; ce document ne revendique pas une validation du déploiement distant.

## Limites restantes

Une photographie par taxon, niveau facile uniquement, sessions de quatre questions, aucune confusion documentaire enregistrée et légumineuses encore vides. Le changement de photo en révision est implémenté et testé avec des données isolées mais ne peut pas s’appliquer à cette première photothèque. Les familles/noms et critères sont sourcés ; le prototype n’est pas une clé exhaustive de détermination sur le terrain.

Les résultats sont locaux, sans compte, synchronisation Supabase, export ou sauvegarde distante. La session active n’est pas reprise après rechargement ; les réponses validées et les métadonnées sont conservées. La fusion des écritures successives entre onglets est testée, mais `localStorage` ne garantit pas de transaction atomique entre processus. La banque n’a pas été validée par un formateur humain dans ce lot. Les tests automatiques ciblent Chromium ; aucun passage Firefox, WebKit, lecteur d’écran réel ou audit WCAG complet n’est revendiqué.

Guide d’utilisation, modèle et enrichissement : [RECONNAISSANCE-PLANTES.md](../architecture/RECONNAISSANCE-PLANTES.md).
