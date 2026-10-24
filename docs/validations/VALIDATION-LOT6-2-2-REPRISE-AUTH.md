# Revue corrective post-fusion — reprise Auth du Drill

Revue du **24 octobre 2026**. La [PR #13](https://github.com/Vladoche/mon-bprea/pull/13) est effectivement **fusionnée**, à 16 h 06 min 32 s Europe/Paris. `origin/main` a été récupéré ; le commit audité est **`6356d10d7da4dad05bf51921b0553d3cb17b366f`**, correspondant à cette fusion. L'arbre initial était propre. La branche `fix/lot6-2-2-reprise-auth-offline` part de ce commit et ne modifie pas directement `main`.

## Hypothèse et reproduction avant correction

**Défaut confirmé par exécution**, et non déduit de la seule condition JavaScript. Le nouveau test d'intégration utilise les vrais `createAuthService()` et `createDrillSyncService()`, les fixtures SDK simulées et IndexedDB simulé isolé. Son ordonnanceur conserve les callbacks et supprime réellement ceux qui sont annulés ; aucun événement navigateur `online` n'est utilisé.

Scénario : Auth A vérifié → panne de `getUser()` lors de `auth.retry()` → état Auth `offline` reconnu → réponse ajoutée dans IndexedDB et son outbox → tentative d'envoi dont la vérification Auth échoue à nouveau → retour Auth au même UUID après rétablissement du service.

Avant correction, `npm test -- --run tests/integration/drill-auth-recovery.test.js` a produit **1 échec et 4 succès**. Le test de reprise attendait `synced` et recevait **`offline`**, alors que l'identité Auth était de nouveau vérifiée. La réponse et l'opération étaient bien persistées ; aucun timer de synchronisation n'était encore actif. Les tests de déconnexion, changement de compte, rejet de session et réponse tardive passaient déjà.

## Cause et correction minimale

À l'entrée `offline`, `changeIdentity()` invalide la génération, annule le run et son timer. La vérification Auth ratée d'un envoi peut republier `offline`, ce qui annule aussi la reprise que l'enregistrement local avait planifiée. Le retour `authenticated` du même espace personnel ne traitait ensuite que `syncState === 'session'` ; une file restée `offline` n'était pas réveillée.

Seul `assets/drill-sync-service.js` change dans le code applicatif : mémorisation du précédent statut Auth et reprise forcée avec lecture distante sur la vraie transition **`offline → authenticated` du même espace**. La reprise existante depuis `session` est conservée. Cela couvre aussi une file passée à `pending` à la suite d'une réponse hors ligne, sans confondre état Auth et état de file.

Les republications `authenticated` des vérifications ordinaires ne déclenchent pas de nouveaux cycles : le statut Auth précédent est déjà `authenticated`. Les UUID, payloads, backoff, validations, générations et règles de réconciliation ne changent pas.

## Régressions ciblées

`tests/integration/drill-auth-recovery.test.js` couvre sept scénarios :

- Reprise du même compte sans `online`, données/outbox relues depuis une autre connexion IndexedDB, même UUID et même payload RPC, une réponse distante et aucun entraînement ajouté.
- File déjà `pending` lors du retour Auth, avec relecture forcée du compte.
- A → `anonymous` : cache masqué et outbox conservée.
- A → B : aucun affichage ou envoi de la file A chez B.
- `offline` A → session rejetée : marqueur retiré, cache masqué et aucune restauration locale indue lors d'une panne ultérieure.
- Réponse d'A retardée au-delà du passage à B : aucune confirmation ou vue privée tardive.
- Reprise d'A avant libération de son ancien run : la lecture confirme l'insertion déjà acceptée, puis l'ancien callback ne modifie ni l'état final ni la file.

Le scheduler borne explicitement le nombre de cycles et vérifie qu'aucun timer ne reste après synchronisation ou après plusieurs vérifications Auth identiques. Le test ajouté dans `tests/unit/drill-sync-transport.test.js` vérifie le header Bearer A fixé avant la requête et le rejet de sa réponse après bascule vers B.

`tests/e2e-supabase/drill-auth-recovery.spec.js` ajoute un parcours dans la vraie stack locale : panne du seul transport `/auth/v1/user`, conservation de la réponse et du payload préparé, rétablissement Auth, nouvelle vérification de l'identité, reprise automatique et contrôle de la ligne PostgreSQL unique. Il compte les événements `online` et exige zéro ; il n'appuie pas sur le retry Drill. Les réponses Auth et RPC proviennent de Supabase réel, sans mock métier.

## Résultats exécutés

| Vérification | Résultat |
| --- | --- |
| `npm ci` et Node.js 24.22.0 | Installation depuis le cache réussie |
| Suite ciblée après correction | **46 tests réussis dans 5 fichiers**, avant l'ajout de l'assertion Bearer complémentaire |
| `npm test` | **149 tests réussis dans 19 fichiers**, aucun échec |
| `npm run test:e2e` | **17 parcours Chromium autonomes réussis**, aucun échec ; serveur local et contextes isolés |
| Supabase réel sur ce poste | Docker absent ; aucune exécution locale réelle revendiquée |
| Qualité CI | [`unit-integration`](https://github.com/Vladoche/mon-bprea/actions/runs/40102273548/job/120896691981) et [`e2e`](https://github.com/Vladoche/mon-bprea/actions/runs/40102273548/job/120896692073) réussis sur le commit correctif `21d1e05739be1629590cfcdc857c18c1927d4d8f` |
| Sécurité CI éphémère | [`supabase-security`](https://github.com/Vladoche/mon-bprea/actions/runs/40102273545/job/120896691915) réussi sur le même commit : **108 assertions pgTAP**, **11 groupes Auth/profils/RLS**, **22 groupes backend Drill**, **4 parcours Chromium Supabase réels** |

Le nouveau parcours **« reprise du même compte après panne Auth sans événement online » a réussi en 1,3 s**. Il a effectivement vérifié zéro événement `online`, le même UUID et le même payload RPC persisté, une seule requête de première réponse, une unique ligne PostgreSQL et aucun entraînement créé. La correction est restée visible après synchronisation. Les quatre parcours réels ont terminé en **15,5 s** et l'arrêt de la stack éphémère a réussi. Les tests existants n'ont été ni affaiblis ni retirés.

Les tests simulés ci-dessus prouvent le comportement du client dans leurs scénarios ; les contrôles RLS et Auth réels ont été exécutés séparément en CI. Aucun HTML, CSS ou renderer n'est modifié : le nouveau parcours navigateur a vérifié les changements d'état et la correction déjà visible, sans nouvelle mise en page.

## Périmètre et limites

Aucune migration, politique RLS, RPC, configuration Supabase ou SMTP n'est modifiée. Aucun accès en écriture à DEV ou PROD, aucun envoi d'e-mail externe et aucun projet créé. Le défaut `assets/auth-config.json` reste désactivé ; aucun secret n'est ajouté. Le Dashboard distant et le ruleset restent hors périmètre. Les réponses en attente ne sont jamais supprimées.

Les limites de cache non chiffré et de disponibilité des pages hors connexion restent celles du [guide client](../architecture/DRILL-SYNCHRONISATION-CLIENT.md). Une identité réellement rejetée exige toujours une connexion valide ; cette correction ne l'autorise pas à synchroniser.

Les trois contrôles de la [PR corrective #14](https://github.com/Vladoche/mon-bprea/pull/14) ont réussi sur le commit correctif ; les preuves ajoutées au rapport sont documentaires et provoquent une nouvelle vérification automatique du head. Aucune fusion automatique ni publication n'est effectuée. Le défaut reste présent dans le commit `main` audité tant que cette correction n'y est pas intégrée ; la fusion de la PR #14 reste donc le seul préalable identifié au développement du lot 6.2.3 depuis `main`.
