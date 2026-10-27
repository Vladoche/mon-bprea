# Validation — fiabilisation et accélération du cycle de tests

Date : 27 octobre 2026. Branche `chore/ci-fiabilisation-et-acceleration`, créée depuis `origin/main` `f984cae010c946f4fd548963a0a9dfccbbed1ced` (fusion de la PR #19). Aucune fusion ni publication autorisée par cette recette.

## Référence et méthode

Sources : [PR #19](https://github.com/Vladoche/mon-bprea/pull/19), sécurité [40378077830](https://github.com/Vladoche/mon-bprea/actions/runs/40378077830) / [40381098640](https://github.com/Vladoche/mon-bprea/actions/runs/40381098640), Qualité [40378077857](https://github.com/Vladoche/mon-bprea/actions/runs/40378077857) / [40381098647](https://github.com/Vladoche/mon-bprea/actions/runs/40381098647). Journaux des jobs effectivement exécutés, pas estimation à partir du YAML.

Les durées par étape ci-dessous utilisent l’écart entre les débuts d’étapes horodatés (arrondi au dixième). Les durées internes Vitest/Playwright sont distinguées. Les totaux de jobs vont du premier au dernier événement de leurs journaux. Le temps CI observé est l’enveloppe entre le premier job et la fin du dernier, sans additionner des jobs concurrents ; le délai initial avant attribution d’un runner n’est pas mesuré. Le premier run Qualité comporte un démarrage E2E tardif : cette enveloppe inclut cette attente/réexécution éventuelle et n’est pas une mesure CPU comparable.

| Coût avant | Référence 1 | Référence 2 | Risque observé |
| --- | ---: | ---: | --- |
| Préparation sécurité : checkout, Node, npm, jusqu’au démarrage stack | 7,1 s | 5,7 s | Faible ; cache npm existant |
| Démarrage stack locale | 73,5 s | 64,7 s | Téléchargements Docker / disponibilité registres |
| Chargement environnement local | 1,2 s | 1,5 s | Clés masquées, aucun projet distant |
| pgTAP (350 assertions) | 18,7 s | 18,0 s | Trois refus ECR « Data limit exceeded », repli registre réussi |
| Auth réel (11 groupes) | 152,3 s | 153,3 s | Expiration réelle incompressible, marge d’horloge |
| Attente expiration seule | 151,1 s | 151,9 s | JWT 120 s + tolérance PostgREST 30 s + marge 2 s |
| Backend Drill (22 groupes) | 0,7 s | 1,0 s | Comptes et sessions propres au processus |
| Backend personnel (26 groupes) | 1,1 s | 1,4 s | Nettoyage ciblé indispensable |
| Installation Chromium, job sécurité | 668,2 s | 20,8 s | APT/mirroir Azure, écart de plus de 10 min |
| Chromium Supabase (24 parcours), étape | 122,9 s | 143,5 s | Réseau local interrompu volontairement, Auth, transactions |
| Arrêt stack et fin job sécurité | 2,6 s | 2,9 s | Arrêt `always()` conservé |
| Total job sécurité | 1048,4 s | 413,0 s | Coût critique essentiellement APT puis attente Auth |
| Installation Chromium, job E2E classique | 16,4 s | 15,9 s | Même APT superflu possible |
| Playwright classique (53 parcours), étape | 72,3 s | 54,2 s | Concurrence 2 workers en CI, captures/rendu |
| Vitest (322 tests), durée interne | 2,93 s | 3,75 s | Aucun intérêt à diminuer la couverture |
| Enveloppe CI observée | ~1110 s | ~413 s | Première référence avec démarrage Qualité tardif |

Le chiffre initial « 669 secondes » est confirmé à l’arrondi/seconde d’étape près : le journal de la référence 1 donne 668,2 s entre les commandes Chromium. APT annonce à lui seul **10 min 45 s pour 21,1 Mo**, avec un paquet ignoré puis repris. Les bibliothèques audio, GTK/ATK, Cairo, CUPS, DRM/GBM, GLib, Pango et X11 sont déjà présentes. Le lot APT ajoute notamment des polices et met à jour NSS/Xvfb ; ce n’est pas le téléchargement Chromium (environ 7 s) qui explique cet extrême.

Les deux runners de sécurité déclarent **Ubuntu 26.04.1**, image `20261012.163.1`. L’inventaire courant de `ubuntu-latest` n’est pas une preuve sur ces runners historiques. Sources de méthode : [images GitHub](https://github.com/actions/runner-images), [CI Playwright](https://playwright.dev/docs/ci). La version 1.64.1 verrouillée installe Chromium/Headless Shell **156.0.8078.4, révision 1248**, FFmpeg 1013. Aucun passage au Chrome système, `channel`, cache de binaire ou changement de version.

## Changements

### Chromium

`scripts/install-chromium.mjs` appelle directement la CLI issue de `npm ci` : `install chromium`, sans APT systématique. Il lance ensuite le Chromium par défaut, ouvre une page, exécute un clic/JavaScript, vérifie des caractères français et produit une capture en mémoire. Les 53 + 24 parcours restent la validation réelle complète du navigateur.

Un échec Linux qui indique des bibliothèques manquantes déclenche **une fois** la commande officielle `install-deps chromium`, puis le même essai réel. Une erreur de rendu/assertion/téléchargement n’est pas transformée en réussite. Le repli peut retrouver le coût réseau APT ; le but est de ne le payer que si nécessaire. La procédure complète manuelle reste documentée. Aucun délai ou retry Playwright ajouté pour dissimuler un problème d’environnement.

### Attente Auth chevauchée

`scripts/test-supabase.mjs` est **inchangé** : invitations, récupérations, session signée, attente réelle jusqu’à `max(exp + 30 s, OTP) + 2 s`, refus OTP puis HTTP 401/PGRST303. Aucun changement à `auth.users`, à l’horloge réelle, à PostgREST, au TTL ni à Auth/RLS.

`scripts/test-supabase-ci.mjs` lance Auth à côté d’une seule chaîne séquentielle : backend Drill, backend personnel, préparation Chromium, 24 E2E Supabase. pgTAP reste avant ces deux branches. Le navigateur garde un worker et zéro retry. Les durées ne s’additionnent plus : le coût vaut environ le maximum des deux branches. Les labels et mesures restent distincts dans le journal et le résumé Actions, même quand leurs sorties s’entrelacent.

Cette indépendance est vérifiable dans les fixtures : préfixes/adresses avec `randomUUID()`, clients sans persistance ni auto-refresh côté Node, lecture SMTP filtrée par destinataire, aucune purge de boîte, requêtes pédagogiques filtrées par UUID, nettoyages limités aux UUID créés dans chaque processus. Le `signOut` global du navigateur ne concerne que son propre compte fictif. Aucun compte ni stack ne traverse les runners. Les limites Auth locales restent inchangées ; les répétitions CI devront confirmer l’absence de 429.

`Promise.allSettled` rejoint les deux branches avant de rendre un échec. Chaque suite garde son `finally` et ses codes ; un échec du backend empêche seulement ses descendants dépendants, jamais l’attente/nettoyage Auth. L’arrêt du workflow reste `if: always()`. Sept tests d’orchestration prouvent le chevauchement, la jonction dans les deux sens et la propagation d’échecs à chaque niveau ; ils ne constituent aucune preuve RLS.

### Audit des attentes navigateur

| Attente | Décision et état observable |
| --- | --- |
| Identité Auth vérifiée | Helper commun : `auth.getState()`, statut `authenticated` et UUID exact ; même module versionné que la page, aucune session exposée |
| Identité hors ligne fiable | Même helper, statut `offline` et UUID exact ; un `retry()` demandé s’exécute une seule fois avant le sondage, pas à chaque poll |
| Cache personnel chargé | `settingsCacheReady` : mode personnel, propriétaire du scope, `view.error === null` ; utilisé hors ligne et A → B → A |
| Transaction IndexedDB terminée | Lectures dupliquées Drill/cours/botanique/ITK remplacées par `personalRecords`, résolution sur `transaction.oncomplete`, abort/error rejetés ; un cache absent n’est pas créé par le helper |
| Opération en attente persistée | `waitForPersistedOperation` : transaction terminée, propriétaire et champs exacts ; garde les assertions existantes de payload, propriété et identifiants |
| Synchronisation confirmée | Helpers de statut applicatif existants conservés ; assertions de contenu et SELECT PostgreSQL sous JWT étudiant maintenus |
| Retour réseau | Suppression de la route d’interruption puis événement `online`/action explicite existante ; assertion sur état et contenu, aucun délai fixe ni mock réel ajouté |
| Changement de compte | Attente explicite du nouvel UUID, puis cache du même propriétaire ; assertions de données absentes et retour au cache A inchangées |

Un échec local a révélé une attente fragile dans le test synthétique ITK : après perte d’acquittement, le test attendait le retry automatique dans le timeout de poll de 5 s. Il attend maintenant la preuve persistée de l’échec réseau puis avance son horloge synthétique jusqu’au `retryAt` enregistré, pour conserver **le retry automatique** et éviter une course entre backoff et poll. Les payloads strictement identiques et l’unicité serveur restent exigés. Cette modification d’horloge est limitée à la suite HTTP synthétique ; aucun changement de logique applicative ni de temps dans les tests Auth réels.

## Vérifications et limites

Node local 24.22.0, `npm ci` exécuté. Docker absent : pgTAP et Supabase réels **non exécutés localement**. Ils doivent être validés dans les runs CI ci-dessous. Aucun résultat mock n’est assimilé à une preuve RLS.

- `npm test` : **329/329**, 35 fichiers (322 préexistants + 7 orchestration), 1,61 s sur l’exécution finale locale.
- SDK navigateur reconstruit : aucun diff de `assets/vendor/supabase.js`.
- Installation légère locale : lancement réel **156.0.8078.4** réussi ; cache Windows préexistant, donc durée non comparable à un runner Linux froid.
- Première suite locale complète : 52/53, échec de l’attente de retry décrit ci-dessus ; ne constitue pas une validation complète.
- Retry automatique et changement de compte ciblés, `--repeat-each=3 --workers=2` : **6/6**, 8,8 s.
- Suite classique complète finale : **53/53**, 28,1 s (8 workers locaux ; ne pas comparer directement aux 2 workers CI).
- Inspection visuelle des captures synthétiques ITK/apparence 1280 et 390 px, clair/sombre : dialogue, focus clavier et contrôles lisibles, aucune régression observée. Les captures restent ignorées sous `.tmp/settings-visual/`, sans session réelle.

### Mesures après

Première mesure : commit `fd10102`, [Qualité 40457986450](https://github.com/Vladoche/mon-bprea/actions/runs/40457986450) et [Sécurité 40457986511](https://github.com/Vladoche/mon-bprea/actions/runs/40457986511). Trois jobs réussis ; 328 tests Vitest à ce stade, 53 E2E classiques, 350 assertions pgTAP, 11 groupes Auth/profils, 22 Drill, 26 personnels et 24 parcours Supabase réels. Aucun repli APT ni refus de débit Auth constaté ; arrêt de stack réussi.

| Mesure après | Exécution 1 |
| --- | ---: |
| Préparation sécurité jusqu’à stack | 10,0 s |
| Démarrage stack | 68,8 s |
| Chargement environnement | 1,6 s |
| pgTAP | 18,0 s |
| Auth réel, expiration et nettoyage compris | 153,26 s |
| Backend Drill | 1,48 s |
| Backend personnel | 1,52 s |
| Chromium Supabase : préparation et validation réelle | 12,35 s |
| Chromium Supabase : 24 E2E | 152,23 s |
| Phase concurrente après pgTAP | 167,6 s |
| Total sécurité | 269,9 s |
| Chromium classique : préparation et validation réelle | 11,6 s |
| 53 E2E classiques, étape | 70,8 s |
| Vitest, durée interne | 2,72 s |
| Enveloppe totale CI observée | 270,5 s |

Auth se termine à 05:58:49 UTC pendant que Chromium tourne encore, jusqu’à 05:59:03 UTC : le chevauchement est réellement observé. L’attente des JWT n’a pas été raccourcie. Cette première mesure enlève environ 143 s au job sécurité par rapport au run rapide de référence (~35 %), malgré un navigateur réel un peu plus lent. Une deuxième exécution est nécessaire avant de conclure sur la répétabilité ; les checks du dernier commit seront vérifiés après finalisation du document.

### Périmètre préservé

Aucun test supprimé ou ignoré ; aucune modification des migrations, RPC, RLS, grants, logique métier, configuration Auth publique, paramètres de la stack, DEV/PROD hébergés, protections GitHub ou confidentialité. `assets/auth-config.json` reste désactivé. Aucun déploiement, auto-merge ou début du lot 6.4. Commandes rapides et recette complète : [TESTS.md](../TESTS.md).
