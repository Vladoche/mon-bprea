# Validation du lot 6.4.4 — recette finale de confidentialité

**28 octobre 2026, Europe/Paris. Préparation technique ; ouverture bloquée sur les P0.** Les résultats de test n'approuvent ni bases légales, ni durées, ni responsabilités, ni conformité globale. Aucun lot 6.5 commencé.

## Base Git et préparation

Arbre initial propre sur `feature/lot6-4-3-suppression-conservation` à `ec715f7`, un seul worktree. Lecture d'`AGENTS.md`, de `docs/TESTS.md`, des huit fichiers `docs/rgpd/`, des architectures/validations export et suppression, des modules et helpers réels. `git fetch origin main` ramène **`1bddaece1ac26b21a132d0974d7692dec6e80245`**. Métadonnées GitHub et ascendance locale confirment :

| PR fusionnée | Commit de fusion |
| --- | --- |
| [#21](https://github.com/Vladoche/mon-bprea/pull/21), inventaire | `ceed63758a6810b9f56ba5eeb5981df087955bba` |
| [#22](https://github.com/Vladoche/mon-bprea/pull/22), copie | `7b0bc77fbc3c8c3b341386a5cd681763ecdbc29e` |
| [#23](https://github.com/Vladoche/mon-bprea/pull/23), retrait/clôture | `1bddaece1ac26b21a132d0974d7692dec6e80245` |

Branche créée depuis ce dernier `origin/main` : **`feature/lot6-4-4-recette-confidentialite`**. Aucun travail préexistant déplacé/effacé, aucune édition directe de `main`. La sandbox a initialement refusé l'écriture de l'index Git et l'installation npm ; les mêmes opérations autorisées ont ensuite réussi avec les permissions d'exécution adaptées. Ce refus n'est pas présenté comme un test fonctionnel réussi.

Ruleset **25489814** relu le 28/10/2026 via l'API GitHub : PR requise, refus de suppression/force-push, checks **`unit-integration`, `e2e`, `supabase-security`** ; aucun bypass annoncé. Aucune règle modifiée. Workflows et optimisations #20 conservés ; le workflow Pages ne se déclenche que sur `main` ou demande manuelle et n'est pas lancé ici.

## Périmètre et revue

| Objet relu | Conclusion technique et limitation |
| --- | --- |
| Auth/profils | Client/service partagés, UUID Auth et génération ; aucune extension des grants de profil. `user_not_found` masque l'identité et les vues. Marqueur local ne permet ni export personnel ni retrait destructif hors ligne. |
| Copie | Dix tables/colonnes propriétaires, pagination et JWT fixé, passes bornées, six champs Auth, quatre caches en lecture de portée ; données exclues/partielles explicites. Blob local et action de remise distincte, aucun envoi tiers. |
| Retrait local | Sélection/aperçu/confirmation, snapshots comparés, Web Locks, générations et messages de phase ; transaction `accounts+privacy` par base. Échecs multibases/visiteur partiels, aucune suppression serveur prétendue. |
| Anti-résurrection navigateur | Epoch et barrière v2, v1 refusée, writer antérieur/reprise distingués, anciens services coopérants invalidés. Aucune garantie contre script arbitraire de même origine ou vieux script visiteur ; appareil absent distinct. |
| Clôture serveur | `close-account/index.ts` et `closure-handler.js` : gateway `verify_jwt=true` plus `getUser`, nouvelle connexion native, capacité AES-GCM liée au JWT exact, cible serveur et confirmation fermée. Aucun UUID libre ni log de secret/contenu dans le code du service. |
| Variables/secrets du prototype | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` côté runtime ; `BPREA_CLOSURE_MODE`, origine exacte et clé de capacité générée par run dans env ignorée. Modes/endpoints internes strictement locaux ; aucune adaptation hébergée, clé admin frontend ou déploiement. |
| Appels administratifs | `deleteUser(id,false)` et `getUserById` serveur ; contrôles des dix comptes SQL sous JWT étudiant original. Défaillance/absence de compte non confirmée → aucun faux succès. Pas de nouvel accès administratif pour la copie. |
| Journalisation/traces | Aucun dossier nominatif de droits, reçu durable ou ledger serveur ajouté. Capacité temporaire distincte d'une preuve organisationnelle ; logs runtime/fournisseurs possibles non inspectés. Nouvelles recettes sans traces, vidéo ou captures automatiques de données réelles. |
| Conservation | JSON toujours non validé, durées nulles, aucune purge autorisée. Planificateur pur sans scheduler/exécuteur ; refus renforcé pour pseudo-validation textuelle/numérique. Pas de Cron ni de tâche périodique activée. |
| Dossier | Corrections factuelles des six documents d'inventaire/transparence/droits et conservation relue ; matrice exigences/preuves, procédure, notice future et portes P0/P1/P2. D01–D14 non approuvées. |

Documentation actuelle consultée : [Supabase user management/JWT résiduel](https://supabase.com/docs/guides/auth/managing-user-data), [sessions](https://supabase.com/docs/guides/auth/sessions), [changelog](https://supabase.com/changelog) après échec du format `.md` ; CNIL RGPD chapitres II–IV, accès et AIPD/listes. La page CNIL de notification a expiré dans le lecteur ; les conditions ont été vérifiées dans le texte des art. 33–34 sur CNIL. Aucune lecture de contrat ou configuration hébergée déduite de ces sources publiques.

## Scénarios A à E et données fictives

Les tests autonomes emploient `example.invalid`/`export.invalid`, des UUID synthétiques et des fixtures de questions publiques ; aucune progression étudiante réelle. Les services backend réels sont réservés à la stack gardée `mon-bprea-lot6-1-local`, avec invitations natives fictives capturées localement. Aucune activité fictive n'est introduite dans le site publié ou les données utilisateur.

| Scénario | Exécution applicable | Assertions et état |
| --- | --- | --- |
| A — copie puis retrait local | `tests/e2e/privacy-recipe.spec.js`, extension `tests/e2e-supabase/export.spec.js` | Fichier parsé, dix tables/quatre compléments, archive brute et B exclus ; cours A et barrière vérifiés, autres domaines et B préservés, serveur inchangé. Fichier déjà remis toujours lisible, avertissement visible. L-B réussi ; variante PostgreSQL soumise à CI-R. |
| B — retrait pendant copie | Même E2E et nouveau test `erasure-service.test.js` | Lecture serveur retenue, effacement autorisé, invalidation du fichier, réponse libérée sans remise. L'intégration attend aussi un transport qui ignore l'annulation jusqu'à sa réponse tardive ; A effacé, B inchangé. L-U/B réussis. |
| C — clôture après sauvegarde | `tests/e2e-supabase/closure.spec.js` étendu | Dix tables A présentes, copie téléchargée comparée aux tables, second appareil avec outbox, fermeture native, double soumission/perte d'acquittement puis reprise. Ancien JWT explicitement encore dans sa fenêtre, lectures SQL acceptées vides, erreurs SQL/FK plutôt qu'expiration de gateway pour les tentatives de recréation. B inchangé et copies locales restantes annoncées. **Exécution réelle exclusivement CI-R.** |
| D — A change vers B puis revient | Nouvel E2E et intégration d'aperçu différé ; anciennes recettes export/closure-client conservées | Aperçu/confirmation A invalidés sous B, callback périmé refusé, aucune suppression A/B, aucun fichier A remis. Aperçu tardif A→B→A non réutilisable ; nouvel aperçu cohérent en revenant. L-U/B réussis. |
| E — pannes/concurrence | Suites `erasure`, `export`, `closure`, `retention` et nouveau timeout natif | Réseau interrompu, timeout SQL 15 s puis réponse libérée, session perdue, stockage bloqué, rollback IDB, révision concurrente, double confirmation, résultat partiel et ancien onglet. Une erreur ne devient jamais « tout réussi ». L-U/B ; panne SQL réelle/cascade rollback et JWT réellement expiré restent CI-R. |

La [matrice des domaines](../rgpd/MATRICE-CONFORMITE-ET-PREUVES.md) relie Auth, Drill, Dashboard, cours/QCM, botanique, ITK, apparence, caches, files, archives et imports aux dix transitions demandées. Les garanties combinent primitive partagée, tests de domaine et scénarios transversaux ; le second appareil clôturé est exercé concrètement avec une outbox cours, sans prétendre simuler toutes les combinaisons de pannes de chaque domaine.

## Exécutions locales

Node **24.22.0**, npm **10.4.0**. `npm ci` réussi, dépendances/verrou inchangés, Chromium installé avec `npx playwright install chromium`. Python du runtime de bureau fourni via `PYTHON`, serveur et profils de tests isolés. CLI **2.121.0** exécutée ; Docker absent du PATH et de son chemin d'installation habituel. Aucun remplacement par DEV/PROD.

| Vérification | Résultat / portée |
| --- | --- |
| `npm test` | **380 tests, 42 fichiers réussis**, après 376 conservés + 4 nouveaux cas utiles (dont tests comprenant plusieurs refus). Logique JS/IDB simulée uniquement. |
| `npm run test:e2e` | **73/73 réussis en 52,4 s**, dont six nouveaux parcours autonomes. Premier passage complet avant ajout du timeout : 72/72 en 48,9 s ; les résultats finaux incluent bien le timeout natif observé en 16,9 s. |
| Tests ciblés | Nouveaux A/B/D, inventaire/URLs, refus de politique et retour local tardif réussis ; pas de retry global ni d'assertion antérieure affaiblie. |
| SDK | `npm run build:auth-sdk` puis `git diff --exit-code -- assets/vendor/supabase.js` réussis ; SDK 2.118.0 verrouillé identique. |
| Invariants Git | Aucun changement de migrations, règles RLS/grants, package/verrou, workflows ou `assets/auth-config.json`. |
| Stack locale réelle sur poste | **NON EXÉCUTÉE : Docker absent.** Les tests JavaScript/HTTP simulés ne démontrent pas RLS. |

Échecs intermédiaires conservés : le nouveau test de pseudo-validation a d'abord échoué sur `validated:'false'`, reproduisant le défaut ; correctif limité à `validated === true`, puis 17 tests ciblés réussis. La fixture de nouveaux E2E contenait d'abord un manifeste `raw` non conforme au vrai validateur : aperçu refusé correctement, fixture corrigée sans assouplissement. Le premier inventaire pointait un dossier parent vide : contrôle explicite de présence d'`index.html` et chemin corrigés avant nouvelle exécution effective des 17 pages. L'ancien callback d'effacement était bien refusé mais affiché à tort comme panne de stockage : message spécifique « confirmation n'est plus disponible » ajouté, sans changer l'autorisation. Ces essais intermédiaires ne sont pas les résultats finaux.

## Traceurs, réseau et artefact Pages

`privacy-artifact.spec.js` visite les **17 pages** en contextes vierges distincts, avec horloge au 28/10/2026 12:00 UTC et paramètres publics valides pour UC/cours/QCM/Drill. Chargement initial et attente réseau stabilisée : **aucun domaine externe sollicité, aucun cookie observable/Set-Cookie, localStorage/sessionStorage vide, aucune base IndexedDB personnelle, aucun Cache API ni service worker**. Liens tiers inventoriés sans clic : ressources, crédits botaniques et anecdote ; aucun envoi explicite de résultats à ces liens. Rapport local sans valeurs de stockage sous `.tmp/privacy-recipe/artifact-network.json`, ignoré.

Les liens synthétiques invite/recovery montrent la query dans la **première requête HTTP**, puis son retrait de l'URL avant sous-requêtes et absence de fuite du token synthétique par référent/DOM/stockage. Une query ordinaire `q` peut rester dans l'URL ; ce n'est pas un effacement de l'historique ou des logs. Les stockages après actions visiteur/personnelles sont examinés séparément par les suites métier/export/effacement, avec attribution et limites documentées ; contexte vierge sans action ne signifie pas absence de persistance après usage.

L'artefact est produit par le vrai préparateur Pages : **127 fichiers publics, 292 références versionnées**, Auth désactivée, `.nojekyll` conservé (128 fichiers en l'incluant). Ni `docs/`, `tests/`, `supabase/`, scripts/env, copie de compte ou page définitive `confidentialite.html`. Contrôle des liens/Markdown, diff et recherche ciblée de secrets effectués ; un signal dans l'ancien test de configuration est une chaîne explicitement fictive de refus, pas une clé utilisable, et aucun secret réel n'a été détecté. Cette recherche bornée n'est pas une garantie absolue. Aucune réponse réelle GitHub Pages/CDN, Supabase hébergé ou SMTP observée. Logs IP Pages documentés séparément ; plan, cookies d'infrastructure, transferts/rétention effectifs restent D05–D07/D12. Aucun bandeau ni exemption juridique générale.

## Inspection visuelle et accessibilité

Captures des suites existantes régénérées avec fixtures : compte prêt, erreur d'export, dialogue d'effacement, succès/partiel/visiteur, aux largeurs 1280/390 et en clair/sombre. Inspection effective de six vues : confirmation mobile sombre, copie prête ordinateur clair, effacement partiel ordinateur clair, export incomplet mobile sombre et nouveau message de confirmation périmée sur mobile sombre/ordinateur clair. Textes d'avertissement, choix, boutons, contraste perçu et statuts examinés. Les cadrages d'élément peuvent inclure le lien fixe d'évitement ; ce ne sont pas des captures de l'intégralité du viewport.

Les E2E contrôlent absence de débordement dans leurs variantes, annulation/Escape, Annuler focalisé dans le dialogue, retour du focus et statut focalisé, boutons indisponibles et régions accessibles. La nouvelle A vérifie le focus après retrait ; D vérifie la fermeture de l'ancien dialogue et le refus de son callback. Les changements ne modifient pas les thèmes saisonniers/horaires. Cette vérification ciblée n'est pas un audit global d'accessibilité.

## Trois jobs finaux et sécurité réelle

La réussite sur la tête finale doit être observée avant livraison, avec SHA et liens dans la description de PR :

| Job obligatoire | Preuve attendue / limite de rédaction |
| --- | --- |
| `unit-integration` | 380 tests et SDK sans diff sur le dernier commit |
| `e2e` | Tous les parcours dont six nouveaux contrôles autonomes, sur le même commit |
| `supabase-security` | **386 assertions pgTAP minimum conservées**, runners Auth/Drill/personnel réels, 26 parcours Chromium réels dont A/C renforcés, expiration JWT native et arrêt de stack réussi |

Aucune réussite CI n'est déduite ici des résultats de #23 ou de la présence des fichiers. Les preuves finales sont reportées après lecture des checks/logs du **dernier SHA** dans la description de PR ; cette méthode évite un commit supplémentaire seulement pour citer son propre résultat CI. Si un code change après ces checks, les refaire. Si la stack CI ne passe pas, C/RLS/JWT résiduel restent non validés et le lot technique n'est pas déclaré terminé.

## Limites et décision d'ouverture

Les tests isolés ne prouvent ni configuration réelle hébergée, ni habilitations humaines, contrat/région/transferts, restitution juridique complète, nécessité/dispense AIPD, ni effacement des backups/appareils absents. Les marqueurs locaux sont personnels et sans durée approuvée ; aucun ledger permanent n'est créé. Les copies déjà téléchargées ne sont pas rappelables. L'absence de service de droits hébergé et de restauration opérationnelle reste honnêtement affichée.

Le [dossier P0/P1/P2](../rgpd/DOSSIER-PREOUVERTURE.md) maintient les blocages : responsable/établissement, bases, contact, notice, conservation, prestataires/transferts, public/AIPD, accès/incident, service ou alternative de droits, configuration autorisée et information préalable. Toutes les décisions D01–D14 restent ouvertes ; leur clôture est distincte de la préparation technique 6.4.

**Aucune action hébergée** : ni DEV `wcckbyhrtroittbfophv`, ni PROD `oqoqrxwfbkhtpksqimgd`, aucune migration, écriture, fonction déployée, invitation réelle ou SMTP externe. Aucune purge/Cron, Auth publique activée, notice définitive publiée, règle GitHub modifiée, fusion, auto-merge ou déploiement Pages. Le lot est livré par branche/PR pour revue seulement.
