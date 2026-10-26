# Validation du lot 6.3.4 — ITK, apparence et recette transversale

Date : 26 octobre 2026. Le [contrat client](../architecture/ITK-APPEARANCE-SYNCHRONISATION-CLIENT.md) et le [bilan 6.3](BILAN-LOT6-3.md) décrivent le périmètre et les limites. Ce rapport doit être lu avec les preuves réellement exécutées ; une suite écrite ne vaut pas une validation.

## État initial

- Répertoire propre, branche initiale `feature/lot6-3-3-sync-botanique`, HEAD `89d70fad1809b3de6d40b89cf3e4dc0fea10e75b`, aucune modification non commitée à préserver.
- `AGENTS.md`, rapports 6.3.1/6.3.2/6.3.3, contrats backend et clients, Auth, thèmes et conventions de tests lus. Modules existants audités avant intégration ; primitives partagées conservées.
- `git fetch origin` réellement exécuté. Dernier `origin/main` initial : **`611daa7a9a4b5c9389e611b78134e3c50b2e7933`**.
- PR [#16](https://github.com/Vladoche/mon-bprea/pull/16), [#17](https://github.com/Vladoche/mon-bprea/pull/17) et [#18](https://github.com/Vladoche/mon-bprea/pull/18) confirmées fusionnées via GitHub. Commits de fusion respectifs `6ff540aa53a10d82b09c945b9ee5abc26e2615b0`, `b647a71609b82cdb2dfcfa415def246b4f6400cb`, `611daa7a9a4b5c9389e611b78134e3c50b2e7933`.
- Branche créée avant modification : **`feature/lot6-3-4-sync-itk-appearance`**, depuis ce dernier `origin/main`. Aucune écriture sur main, modification du ruleset, fusion ou déploiement.
- Node.js **24.22.0** ; `npm ci` et `npx playwright install chromium` exécutés avec succès.
- Changelog Supabase officiel et documentation `getUser/getSession` consultés. Aucun changement de SDK, dépendance ou API hébergée requis.

## Périmètre des fichiers

| Fichiers | Objet |
| --- | --- |
| `assets/settings-model.js`, `settings-store.js`, `settings-transport.js`, `settings-service.js` | Validation, cache personnel partagé des deux singletons, opérations CAS durables et identité |
| `assets/itk-personal-ui.js`, `app.js`, `style.css` | Formulaire conservé, suivi, restauration explicite, import et résolution |
| `assets/theme-init.js`, `appearance.js`, `appearance.css` | Initialisation classique conservée, source personnelle asynchrone, dialogue et messages |
| Suites `settings-*`, parcours transversaux | Modèle, persistance, service, transport, navigateur et PostgreSQL réel |
| Guides, README, `docs/TESTS.md`, bilan et ce rapport | Architecture, procédure et preuves |

Comparaison réellement effectuée avec `origin/main` : migrations/RPC/RLS et leurs 350 assertions de référence, profils, catalogue, moteurs pédagogiques, services antérieurs, primitives partagées, dépendances/verrou et configuration Auth publique inchangés. Le workflow conserve ses jobs et ne change que le libellé de l’étape navigateur.

## Vérifications exécutées

| Vérification | Résultat |
| --- | --- |
| `npm test` complet | **322 tests réussis, 34 fichiers**, dont les 279 antérieurs conservés ; dernière passe 1,81 s |
| `npm run test:e2e -- --workers=2` complet | **53 parcours réussis**, dont les 39 antérieurs ; dernière passe 51,6 s ; démarrage/reprise Drill, rendu provisoire de compte vide et stockage personnel refusé couverts |
| `npm run build:auth-sdk` puis comparaison | Réussi ; aucun diff du SDK verrouillé |
| Inspection visuelle | Captures synthétiques 1280/390 px clair/sombre et dialogues inspectés ; détails ci-dessous |
| Supabase local sur ce poste | Docker absent ; aucune recette PostgreSQL locale déclarée réussie |
| Préflight réel `npm run test:e2e:supabase -- --list` | Refus explicite de la configuration locale absente ; aucune cible distante substituée |
| CI | PR [#19](https://github.com/Vladoche/mon-bprea/pull/19) créée et suivie ; détails des passages réels ci-dessous, validation finale encore requise |

## Scénarios et limites à établir

Les tests exécutés couvrent ITK et apparence sur deux contextes, reprise API hors ligne et rechargement, acquittement perdu, CAS et résolution explicite, formulaire/dialogue actif et focus, imports séparés avec source inchangée, refus des anciennes données invalides, erreurs de stockage, bascules A/B et réponse tardive. Le thème classique est observé réellement avant livraison des CSS, avec une horloge contrôlée, y compris choix `auto`, transitions de saison et changements d’heure locale.

Les transactions IndexedDB sont testées avec rollback d’un `put`, réouverture, deux repositories/onglets sérialisés et BroadcastChannel. UUID/base/payload sont stables ; les intentions non envoyées sont compactées avec diagnostic, les livraisons incertaines sont chaînées et conservées. Les conflits ne bloquent pas l’autre singleton. Une source modifiée pendant le GET d’import est de nouveau vérifiée dans la transaction, avec la base distante ; aucune importation n’est créée sans décision compatible avec l’aperçu.

La première passe complète a exposé un rechargement intempestif du visiteur botanique sur `pageshow persisted`, une intention récente créée pendant la fin d’un cycle et une attente de test pré-CSS reposant sur un frame non disponible. Les corrections préservent le parcours antérieur, reprennent immédiatement la file éligible et observent le script sans attendre un rendu. Une seconde passe a révélé un retry manuel pendant une requête encore en panne : il attend maintenant ce cycle avant de remettre à zéro l’échéance, en revérifiant identité/génération. Les régressions ciblées puis les suites complètes sont vertes. Aucun test antérieur n’a été affaibli.

Les huit nouvelles recettes réelles sont incluses dans `supabase-security` : quatre ITK/apparence (deux appareils et A/B ; hors ligne/reload/acquittement perdu ; CAS concurrents/résolution ; imports séparés) et quatre transversales (historiques multi-appareils ; A/B et outbox ; panne API de tous les domaines ; conflits simultanés cours/ITK/apparence/botanique avec QCM et Drill restant synchronisables). Elles relisent les tables avec les JWT des comptes fictifs, y compris `profiles`.

## Passages CI réels et corrections de recette

Sur `671b853`, les quatre nouvelles recettes ITK/apparence ont réussi. Les premières recettes transversales étaient bloquées par un sélecteur de démarrage Drill qui ignorait la flèche du bouton. Le helper corrigé attend un démarrage proposé ou une série existante ; un test autonome vérifie démarrage, rechargement et deuxième réponse. Les sélecteurs du Dashboard suivent ceux des suites existantes. Les SELECT de recette réutilisent leurs JWT valides au lieu de reconnecter le compte à chaque lecture, sans modifier Auth, les limites de débit ou les assertions PostgreSQL.

Le [job réel de `94d3f09`](https://github.com/Vladoche/mon-bprea/actions/runs/40372324733/job/121746033378) a réussi **350 assertions pgTAP**, **11 groupes Auth/profils**, **22 groupes Drill**, **26 groupes personnels** et **23/24 parcours navigateur réels**. Les seize parcours antérieurs, les quatre nouveaux ITK/apparence et trois transversaux sont verts ; seule la navigation transversale sous panne API restait en échec. L’arrêt ciblé de la stack a réussi. Ce passage partiel n’est pas annoncé comme une réussite du job.

Sur `d1304c0`, les deux jobs Qualité ont réussi ; le job Supabase a de nouveau réussi 23/24 parcours. Son diagnostic a montré l’état Auth transitoire `loading` avant lecture du cache, avec le bouton Drill encore désactivé. La recette attend maintenant la stabilisation de l’identité réelle ; le helper attend soit un bouton activé, soit le formulaire restauré, sans attendre un bouton déjà remplacé par la série. Les contrôles du propriétaire et des données restent stricts.

Une reproduction synthétique avec le SDK verrouillé, stockage mémoire et réseau rejeté a mesuré **25,5 secondes** avant retour d’une session locale proche de son renouvellement, sans contacter de projet. La recette attend maintenant explicitement l’état Auth `offline` et le bon propriétaire à chaque nouvelle page, avant les contrôles de données ; elle ne remplace aucune réponse Auth par un mock. Les diagnostics ne publient que des statuts, compteurs et choix visuels, sans token. Une vérification de durée botanique dépendante du temps réel de CI utilise désormais une horloge figée : les assertions de focus/photo/choix et d’égalité du chrono sont conservées, et « 25 s » est vérifié explicitement.

## Inspection visuelle et contrôles de livraison

Les matrices synthétiques `.tmp/settings-visual/` couvrent personnel, formulaire modifié, hors ligne, apparence, conflit, import, visiteur et erreur de stockage à 1280/390 px, en clair/sombre. Quatre vues de dialogue visiteur supplémentaires sont sous `.tmp/appearance-visual/`. Le formulaire, le résultat et les exports restent cohérents ; les messages distinguent formulaire modifié et dernier enregistrement confirmé. Les tests vérifient l’absence de débordement global et la conservation du focus. Les captures de dialogues sont interprétées dans leur viewport : un backdrop natif ne couvre pas la partie hors viewport d’une capture de page entière.

Une première capture prise après défilement faisait apparaître artificiellement le lien d’évitement au milieu de la page entière. Les diagnostics ont confirmé son rectangle hors écran, son absence de focus et la conservation du focus de saisie ; les vues ont été reprises depuis le haut sans changer le CSS. Les captures ne contiennent que des fixtures synthétiques, sans session réelle ni preuve RLS.

`git diff --check` réussi. Recherche ciblée de motifs de clés privées/tokens dans les **33 fichiers modifiés**, et **74 liens Markdown locaux** contrôlés sans anomalie. Les captures, diagnostics, rapports et outils temporaires restent ignorés ; aucun secret ni configuration locale privée n’est ajouté à la livraison. Un lancement local à huit workers a rencontré `ERR_NO_BUFFER_SPACE`, puis un démarrage de serveur a été bloqué dans le bac à sable ; la passe finale à deux workers hors de cette restriction a réussi. Ces échecs d’environnement ne sont pas comptés comme des passes réussies.

## Environnements et exclusions

DEV `wcckbyhrtroittbfophv` a été interrogé **en lecture seule**, exclusivement avec `list_migrations` : seules `20261022000100 profiles` et `20261024083417 create_drill_sync_schema` sont retournées. **La migration 6.3.1 `20261025143831` est absente de DEV.** Aucun test hébergé des nouveaux domaines n’est déclaré réussi, aucune migration n’a été appliquée et aucune donnée hébergée n’a été écrite.

PROD `oqoqrxwfbkhtpksqimgd` n’est ni modifié ni utilisé pour les recettes. Aucun nouveau projet, changement SMTP/Auth hébergé, e-mail externe, invitation étudiante, activation sur GitHub Pages, secret publié ou suppression d’historique. `assets/auth-config.json` reste `enabled:false`, URL et clé vides. La livraison attend une revue ; aucune fusion automatique.

Les caches restent non chiffrés et conservés à la déconnexion. Sans service worker, pages/modules doivent être disponibles pendant une panne API. Seuls les huit paramètres ITK sont synchronisés, sans document calculé ; les années contractuelles restent 2026–2033. Les modes automatiques gardent leur valeur et sont interprétés localement. Les procédures RGPD, l’ouverture étudiante et l’ITK avancé restent respectivement aux lots 6.4, 6.5 et 7.
