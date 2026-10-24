# Mode Drill — contrat PostgreSQL et sécurité du lot 6.2.1

Ce lot prépare le stockage distant des séries hebdomadaires, premières réponses et entraînements. Il ne branche aucun écran sur Supabase : le Drill et le Dashboard continuent d'utiliser leurs données locales, et `assets/auth-config.json` reste désactivé. Le client de synchronisation, la file d'attente hors ligne et la gestion des conflits à l'écran appartiennent au lot 6.2.2 ; le Dashboard distant appartient au lot 6.2.3.

Les résultats réellement exécutés et l'état de l'application de la migration sur DEV sont consignés dans [VALIDATION-LOT6-2-1.md](../validations/VALIDATION-LOT6-2-1.md). La présence d'un fichier SQL ne prouve pas son installation sur un projet hébergé. L'application distante exige une vérification de la cible puis une autorisation explicite ; aucun accès à PROD n'est nécessaire au client ni aux tests locaux.

## Audit du format local avant conception du schéma

La source de référence reste [drill-store.js](../../assets/drill-store.js), avec la validation de [drill-bank.js](../../assets/drill-bank.js), les semaines et calculs de [drill-engine.js](../../assets/drill-engine.js) et les règles du [Mode Drill](MODE-DRILL.md). La clé **`bprea-demo-drill-v1`** contient ce document :

```text
{ version: 1, series: { "<unit>__<week>": <série> } }

série = {
  id, unit, week, startedAt,
  questions: [10 questions distinctes],
  answers: { "<questionId>": <première réponse> },
  drafts: { "<questionId>": "<optionId>" },
  trainingDrafts: { "<questionId>": "<optionId>" ou null }
}

première réponse = {
  answer, correct, answeredAt,
  attempts: [
    { answer, correct, answeredAt, training: false },
    { answer, correct, answeredAt, training: true }, ...
  ]
}
```

Ce bloc décrit une structure, pas un document JSON à importer. Une série réelle contient exactement dix snapshots complets. `id` vaut par exemple `uc3__2026-W43`. Les UC reconnues par [content.js](../../assets/content.js) sont `uc1` à `uc5`, `ucare1` et `ucare2` ; la banque livrée comporte douze questions UC3 seulement. Les anciennes séries non terminées restent accessibles et ne bloquent pas les suivantes.

Chaque question conserve `id`, `version`, `unit`, `chapter`, `concept`, `type`, `prompt`, `options` avec identifiants et textes, `answer`, `explanation` et `difficulty`. `reference`, `sourceLesson` et `sourceQuestionIndex` sont facultatifs. Seul `single-choice` est accepté actuellement. Une question a au moins deux options distinctes et sa bonne réponse est l'identifiant d'une option, jamais un index numérique. La version d'une question est un entier JavaScript sûr positif. Identifiants de questions et d'options : minuscules, chiffres et tirets, en commençant par une lettre ou un chiffre. Un identifiant comme `constructor` reste une donnée ordinaire ; le lecteur utilise des maps sans prototype et `hasOwn`.

Le démarrage clone les dix questions par JSON avant la première réponse. Une série déjà présente conserve son snapshot même si la banque est révisée, indisponible ou présente un ordre différent. `startedAt` est la date déclarée de début de cette série ; elle peut être postérieure de plusieurs semaines à sa semaine d'origine. `week` est une vraie semaine ISO `AAAA-Wnn` : `2020-W53` existe, `2021-W53` n'existe pas. Son année est comprise entre 0001 et 9999. Le changement de semaine du moteur est le lundi à minuit **Europe/Paris**, y compris aux changements d'heure.

La réponse racine est définitive dans le fonctionnement local. Une nouvelle validation ordinaire ne la remplace pas ; l'entraînement exige cette première réponse et ajoute une entrée `training:true`. Les statistiques principales utilisent exclusivement les réponses racines, avec le dénominateur des exercices réalisés. Les neuf questions non réalisées d'une série commencée ne deviennent pas neuf erreurs. Sans réponse, le taux est `null`.

L'ancien tableau `attempts` peut ne comporter aucun marqueur `training` : il inclut alors la première tentative et les calculs soustraient une entrée pour le nombre d'entraînements. `trainingDrafts` peut être absent dans un ancien document ; `null` marque explicitement le brouillon d'entraînement consommé. Ces compatibilités restent à traiter dans l'import du lot 6.2.2, sans effacer la source.

Il n'existe actuellement **aucun UUID d'opération** dans ce document. La déduplication locale d'entraînement utilise le choix, la date et le marqueur `training:true` ; elle ne peut pas servir d'identité de tentative distante. Deux entraînements distincts doivent garder deux UUID distincts, même avec choix et date identiques.

`readDrillState()` expose `{series, error, warnings}` sans réécrire le JSON source. Les versions racines inconnues ou documents illisibles bloquent les écritures ; les séries ou réponses partiellement invalides sont ignorées dans les calculs avec avertissement, tandis que les valeurs brutes et champs inconnus sont conservés. Le futur import ne doit ni supprimer ces archives ni transformer un refus SQL en historique vide.

Le [Dashboard](DASHBOARD.md) utilise l'adaptateur en lecture seule [dashboard-data.js](../../assets/dashboard-data.js). Sa semaine d'activité provient de **`answeredAt`**, converti en Europe/Paris, et non de `series.week`. Les dates futures restent syntaxiquement lisibles ; [dashboard-stats.js](../../assets/dashboard-stats.js) les écarte provisoirement avec avertissement. Aucune comparaison `answeredAt >= startedAt`, appartenance à la semaine ou limite d'ancienneté n'est imposée par le store actuel.

## Modèle relationnel

La migration [20261024083417_create_drill_sync_schema.sql](../../supabase/migrations/20261024083417_create_drill_sync_schema.sql) ajoute trois tables publiques, sans modifier [la migration des profils](../../supabase/migrations/20261022000100_profiles.sql). Les noms SQL utilisent `snake_case` ; les noms du document local restent inchangés.

| Table | Identité | Données et relation |
| --- | --- | --- |
| `drill_series` | `id` UUID technique attribué par le serveur | `user_id` UUID Auth, `series_key` métier générée, `unit`, `week`, `started_at`, `questions` JSONB, `schema_version`, `created_at` serveur |
| `drill_answers` | Clé primaire `(user_id, operation_id)` | `series_id`, `question_id`, `answer`, `answered_at`, `correct` calculé, `created_at` serveur ; une seule ligne par `(user_id, series_id, question_id)` |
| `drill_training_attempts` | Clé primaire `(user_id, operation_id)` | Même payload de question et réponse, résultat calculé et dates ; relation obligatoire à la première réponse par `(user_id, series_id, question_id)` |

Les deux UUID `operation_id` sont fournis par le futur client, persistés avant l'envoi et réutilisés sans modification lors d'un retry. Leur espace d'unicité est propre à chaque utilisateur et à chaque table d'opérations ; ils ne sont ni un choix, ni une date, ni un identifiant de question. Le client doit conserver aussi le type d'opération. `drill_series.id` est l'identité distante ; `series_key = unit || '__' || week` reste l'identité compatible avec l'existant.

`UNIQUE(user_id, unit, week)` empêche deux séries de même UC/semaine pour un même compte. Deux comptes peuvent chacun créer cette série. La clé unique `(user_id, id)` permet la FK composite des réponses vers une série du même propriétaire. La FK composite des entraînements vers les réponses interdit un entraînement sans première réponse ou rattaché à une autre question/série/propriétaire. Les références Auth utilisent l'UUID vérifié, jamais l'e-mail ou les métadonnées utilisateur.

Les cascades suivent les dépendances pour un éventuel traitement administratif de suppression de compte ; elles n'accordent aucun droit DELETE à l'étudiant et ne constituent pas une procédure d'effacement juridique. Aucun compte ni aucune progression existante n'est supprimé par la migration.

### Snapshot et horodatages

`questions` est le tableau ordonné complet, au schéma version 1, jamais un lien vers la banque courante. Il contient exactement dix questions distinctes de la même UC. La validation SQL contrôle les champs et types, versions, identifiants, textes, options et bonne réponse. Les réponses choisies doivent être présentes dans les options de cette copie historique. Les triggers déduisent `correct` de `answer = question.answer` ; le navigateur ne le fournit pas comme autorité.

Le backend ajoute des bornes pour les charges acceptées : snapshot d'au plus **512 Kio** dans sa représentation JSONB texte, identifiants d'au plus **200 caractères**, textes pédagogiques / options / titres de référence de **1 à 10 000 caractères bruts**, et **2 à 20 options** par question. Les textes constitués seulement des espaces et séparateurs reconnus par le `trim()` JavaScript sont refusés, y compris tabulation, retour à la ligne ou espace insécable ; leur contenu n'est pas normalisé ou tronqué dans le snapshot. La version des questions reste un entier compris entre 1 et 9 007 199 254 740 991 ; `sourceQuestionIndex`, s'il existe, est un entier entre 0 et cette même borne ; `schema_version` vaut 1.

Les UUID d'opérations doivent être non nuls et différents de l'UUID zéro. Les références acceptent le lien local décrit plus haut ou HTTP(S) avec domaine exprimé en ASCII / `localhost`, sans identifiants de connexion et avec port éventuel de 0 à 65 535 ; les littéraux IP/IPv6 et les hôtes Unicode sont hors de ce sous-ensemble initial. L'URL reste soumise à la limite globale de snapshot. Les champs JSON inconnus sont conservés. Ces bornes sont plus strictes que le store local actuel : le futur import doit signaler les données refusées et conserver leurs sources, sans les tronquer ni les effacer silencieusement.

`started_at` et `answered_at` sont des instants pédagogiques déclarés par l'appareil. Ils doivent être finis et appartenir aux années 0001 à 9999 ; aucune date future n'est rejetée uniquement parce qu'elle est future. Aucun ordre entre ces dates ni coïncidence avec la semaine ISO d'origine n'est imposé. Le moteur existant reste ainsi capable de traiter une ancienne série commencée tard ou une horloge d'appareil incorrecte. Une valeur hors ligne n'est pas une preuve de l'instant réel d'une réponse.

`created_at` est la date d'enregistrement serveur. Elle ne remplace pas `answered_at` pour les statistiques pédagogiques et ne doit pas être envoyée par le client. L'ordre qui décide d'une première réponse n'est pas fondé sur la date déclarée : seule l'insertion atomique acceptée en base fait autorité.

## RLS, privilèges et immutabilité

Les trois tables sont dans le schéma `public`, exposable par la Data API, avec **RLS activée** et privilèges explicitement retirés à `PUBLIC`, `anon` et `authenticated` avant les seuls GRANT nécessaires. Une table exposée n'est pas publique au sens d'une lecture anonyme : RLS et privilèges s'appliquent à chaque requête PostgREST, même lorsque le frontend est contourné.

| Rôle | Lecture | Insertion | Modification / suppression |
| --- | --- | --- | --- |
| `anon` | Aucune | Aucune | Aucune |
| `authenticated`, `drill_series` | Ses propres lignes | Colonnes `unit`, `week`, `started_at`, `questions` uniquement | Aucun UPDATE ni DELETE |
| `authenticated`, réponses et entraînements | Ses propres lignes | Colonnes `operation_id`, `series_id`, `question_id`, `answer`, `answered_at` uniquement | Aucun UPDATE ni DELETE |

Les politiques SELECT utilisent `(select auth.uid()) = user_id` ; les politiques INSERT imposent la même condition dans `WITH CHECK`. `auth.uid()` provient du JWT vérifié par Supabase Auth. Le client n'a pas de droit d'insertion sur `user_id`, `correct`, `created_at`, `schema_version`, l'UUID de série ou la clé générée. Les colonnes techniques sont remplies par défaut, génération SQL ou trigger. Aucun rôle, propriétaire ou résultat n'est déduit de `user_metadata`. Ces choix suivent les recommandations officielles de [RLS et identité Auth Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

Les fonctions privées `bprea_private.guard_drill_series()` et `bprea_private.guard_drill_response()` s'exécutent comme triggers `SECURITY INVOKER`, avec un `search_path` vide et des objets qualifiés. Elles contrôlent aussi les INSERT directs : validité des snapshots, identité, existence d'une série personnelle, appartenance de la question et de l'option, première réponse préalable à un entraînement, calcul de `correct` et date d'enregistrement serveur. Elles refusent les UPDATE. Les rôles clients ne disposent ni d'USAGE sur le schéma privé, ni d'EXECUTE sur ces fonctions ; leur déclenchement est attaché aux tables. Aucun nouveau `SECURITY DEFINER` ni aucune vue n'est ajouté.

L'absence d'UPDATE/DELETE interdit les réécritures de séries, de snapshots, de premières réponses et d'entraînements. Elle interdit également un upsert PostgREST fondé sur `ON CONFLICT DO UPDATE`. Le chemin recommandé pour les retries est la RPC décrite ci-dessous, qui ne fait aucun UPDATE. Les contraintes UNIQUE restent décisives même face à un INSERT direct ou à deux transactions simultanées. Les FK composites empêchent les références intercomptes indépendamment du masquage de l'interface.

Les clés uniques ont `user_id` en première colonne et couvrent les recherches de propriétaire et de série ; `drill_answers_activity_idx` indexe `(user_id, answered_at, series_id, question_id)`. `drill_training_history_idx` indexe `(user_id, series_id, question_id, created_at, operation_id)`, pour la FK vers la première réponse et l'historique d'entraînement. Les listes de questions JSONB, de taille bornée, n'exigent pas d'index GIN pour ces opérations.

## Contrat des opérations idempotentes

Les trois RPC sont publiques au sens du schéma exposé, mais **exécutables uniquement par `authenticated`**. Elles sont `VOLATILE`, `SECURITY INVOKER`, avec `search_path` vide. Elles gardent les privilèges et RLS du demandeur ; elles ne donnent aucun accès administratif. Les REVOKE explicites retirent notamment le droit EXECUTE accordé par défaut aux nouvelles fonctions ; voir le [guide des fonctions Supabase](https://supabase.com/docs/guides/database/functions). Elles retournent un objet JSONB :

```json
{
  "status": "inserted",
  "row": {
    "user_id": "10000000-0000-4000-8000-000000000001",
    "operation_id": "30000000-0000-4000-8000-000000000001",
    "series_id": "20000000-0000-4000-8000-000000000001",
    "question_id": "uc3-matiere-organique-k2",
    "answer": "a",
    "correct": false,
    "answered_at": "2026-10-20T08:00:00+00:00",
    "created_at": "2026-10-24T10:15:00+00:00"
  }
}
```

Cet exemple synthétique est une réponse de `drill_record_answer`, pas un résultat de test. La question historique K2 attend `b` ; le choix `a` est donc incorrect. La date de réponse peut précéder la date d'enregistrement de plusieurs jours, par exemple lors d'un futur import hors ligne.

| Opération / RPC | Paramètres | Identité à conserver pour retry | Résultat |
| --- | --- | --- | --- |
| Créer ou retrouver une série : `drill_create_series` | `p_unit text`, `p_week text`, `p_started_at timestamptz`, `p_questions jsonb` | Compte courant + UC + semaine, **avec le payload original complet** | `inserted` et ligne complète de `drill_series` ; `replayed` si même clé et mêmes date/snapshot ; `conflict` avec série existante si date ou snapshot diffère |
| Première réponse : `drill_record_answer` | `p_series_id uuid`, `p_question_id text`, `p_answer text`, `p_answered_at timestamptz`, `p_operation_id uuid` | UUID d'opération et les quatre autres valeurs exactement conservées | `inserted` et ligne complète de `drill_answers` ; `replayed` uniquement pour cette opération et ce payload ; sinon `conflict` avec la ligne déjà enregistrée |
| Entraînement : `drill_record_training` | Les cinq mêmes paramètres | UUID d'opération et payload original | `inserted` et ligne complète de `drill_training_attempts` ; `replayed` pour même opération/payload ; `conflict` si l'UUID est réutilisé avec des données différentes |

L'égalité des timestamps porte sur leur instant PostgreSQL : deux écritures avec des décalages de fuseau différents peuvent représenter le même instant. L'égalité JSONB ignore l'ordre des clés d'un objet, mais conserve l'ordre des éléments de tableau, donc l'ordre des questions et options. Un retry ne doit pas reconstituer son snapshot depuis une nouvelle version de banque ni remplacer sa date de réponse par la date du nouvel envoi.

Exemple synthétique de corps `POST /rest/v1/rpc/drill_record_answer` :

```json
{
  "p_series_id": "20000000-0000-4000-8000-000000000001",
  "p_question_id": "uc3-matiere-organique-k2",
  "p_answer": "a",
  "p_answered_at": "2026-10-20T08:00:00.000Z",
  "p_operation_id": "30000000-0000-4000-8000-000000000001"
}
```

Le deuxième envoi strictement identique retourne `status:"replayed"`, la même ligne et sa date serveur initiale. Envoyer ensuite `p_answer:"b"` avec un nouvel UUID pour cette même série/question retourne `status:"conflict"` et la première réponse `a`, sans l'écraser. Même un nouvel UUID portant encore `a` provoque un conflit : seule l'identité de la même opération établit un retry déjà accepté.

Exemple synthétique de corps `POST /rest/v1/rpc/drill_record_training`, après cette première réponse :

```json
{
  "p_series_id": "20000000-0000-4000-8000-000000000001",
  "p_question_id": "uc3-matiere-organique-k2",
  "p_answer": "b",
  "p_answered_at": "2026-10-20T08:05:00.000Z",
  "p_operation_id": "40000000-0000-4000-8000-000000000001"
}
```

Rejouer ce corps ne crée qu'une ligne. Changer seulement l'UUID d'opération crée une deuxième tentative légitime, même si le choix et la date sont identiques. La première réponse reste incorrecte et les deux entraînements restent séparés de son résultat principal.

Une collision d'UUID de première réponse est recherchée avant la collision de question : `conflict.row` peut donc désigner une autre question du même compte si cet UUID a été réutilisé à tort. Le client doit vérifier ses identités et relire la question ciblée au besoin, jamais fusionner la ligne retournée sous une mauvaise clé. Aucun conflit ne retourne la ligne d'un autre propriétaire.

### Concurrence et première écriture définitive

Chaque RPC fait un `INSERT ... ON CONFLICT DO NOTHING`, puis relit la ligne gagnante si l'insertion n'a pas eu lieu. Il n'y a ni UPDATE de résultat ni simple contrôle préalable en JavaScript. L'index UNIQUE arbitre les écritures concurrentes : une transaction accepte la ligne et l'autre attend cette résolution. Si la gagnante annule sa transaction, l'autre peut encore insérer ; seule une insertion validée est définitive. Cette stratégie utilise les garanties documentées de [PostgreSQL 17 sur INSERT et ON CONFLICT](https://www.postgresql.org/docs/17/sql-insert.html).

Deux créations concurrentes de la même série produisent une ligne. Même payload : une insertion et un replay ; payloads différents : une insertion et un conflit. Deux premières réponses différentes à la même série/question produisent une ligne définitive et un conflit, quelle que soit la date déclarée la plus ancienne. Deux retries simultanés du même entraînement produisent une ligne ; deux UUID différents produisent deux lignes. Le serveur ne garantit pas quel appareil gagne avant l'arrivée et la validation des transactions.

En isolation usuelle READ COMMITTED, une nouvelle commande SELECT de ces fonctions `VOLATILE` peut voir la ligne concurrente devenue visible après `DO NOTHING`, conformément aux [règles de snapshots des fonctions PostgreSQL](https://www.postgresql.org/docs/17/xfunc-volatility.html). Si aucune ligne personnelle correspondante n'est visible, le contrat renvoie `40001` / `drill_retry_transaction` : réessayer **la même opération** dans une nouvelle requête. Le lot 6.2.2 définira le backoff et la présentation des conflits ; il ne doit pas changer l'UUID d'un retry automatique.

### Résultats métier et erreurs techniques

| Signal | Sens pour le futur client |
| --- | --- |
| HTTP 200, `status:"inserted"` | Nouvelle ligne acceptée ; conserver la ligne serveur |
| HTTP 200, `status:"replayed"` | Cette opération avait déjà été acceptée ; aucun doublon |
| HTTP 200, `status:"conflict"` | Données concurrentes ou UUID réutilisé avec un autre payload ; conserver les deux informations côté client jusqu'à résolution, sans réécrire la ligne gagnante |
| SQLSTATE `42501` | Permission, propriétaire ou relation personnelle indisponible ; ne révèle pas si une série voisine existe |
| SQLSTATE `23514` | Payload fonctionnel invalide : snapshot, question, option, semaine ou CHECK de date/version |
| SQLSTATE `23503` | Référence étrangère incohérente ; les triggers peuvent refuser plus tôt une relation indisponible par `42501` |
| SQLSTATE `23505` | Doublon par INSERT direct, sans le contrat de déduplication des RPC |
| SQLSTATE `23502` / `22P02` | Champ obligatoire nul ou conversion invalide, notamment UUID/date mal formés |
| SQLSTATE `40001`, panne réseau ou erreur serveur transitoire | Rejouer le même UUID et le même payload ; une erreur de transport ne prouve pas que l'insertion a échoué |

Les états HTTP précis des erreurs SQL suivent PostgREST ; le client doit aussi examiner le champ `code`, pas seulement un texte traduit ou le statut HTTP. Les JWT expirés/falsifiés doivent être traités comme une erreur d'authentification, pas comme un conflit pédagogique. Aucun de ces scénarios n'exige une clé `service_role` dans le navigateur.

## Lecture personnelle et pagination de l'historique

La lecture utilise la Data API avec la clé publishable et le JWT utilisateur. RLS s'applique même sans filtre `user_id` ; ajouter explicitement ce filtre avec l'UUID du compte vérifié facilite le plan de requête, mais ne remplace jamais la politique. Une requête visant le compte voisin retourne zéro ligne ; un visiteur sans droits reçoit un refus. Il faut contrôler l'erreur de chaque requête avant d'assimiler une liste vide à une absence de résultats.

Pour retrouver une série avant création, filtrer `unit` et `week` plutôt que reconstruire une identité technique :

```text
GET /rest/v1/drill_series?select=*&unit=eq.uc3&week=eq.2026-W43
GET /rest/v1/drill_series?select=*&id=eq.20000000-0000-4000-8000-000000000001
GET /rest/v1/drill_answers?select=*&series_id=eq.20000000-0000-4000-8000-000000000001&order=question_id.asc
```

Les URL sont relatives à l'URL Supabase configurée. Les paramètres et valeurs doivent être encodés par le client. La lecture de la série restitue le snapshot complet conservé, sans aucun accès à la banque actuelle. La RPC de création reste l'opération atomique à employer si plusieurs appareils tentent une création après une première lecture vide.

Ne pas supposer que la première réponse HTTP contient tout l'historique. La [configuration locale](../../supabase/config.toml) limite la Data API à **1 000 lignes par réponse** ; le projet hébergé peut avoir une limite différente. Des pages explicites de 100 ou 200 lignes, un ordre total stable et un curseur composé de toutes les colonnes de tri évitent la troncature silencieuse. La pagination appartient au futur client, sans nouvelle RPC de lecture privilégiée.

| Collection | Ordre stable recommandé | Curseur de la dernière ligne |
| --- | --- | --- |
| Séries du compte | `unit ASC, week ASC` | `(unit, week)`, unique pour ce propriétaire |
| Premières réponses du compte | `answered_at ASC, series_id ASC, question_id ASC` | Les trois valeurs, avec la précision de timestamp reçue |
| Entraînements d'une série/question fixées | `created_at ASC, operation_id ASC` | `(created_at, operation_id)` |

Les requêtes SQL suivantes expriment le contrat de pagination, sous rôle utilisateur authentifié. Elles ne définissent aucune fonction à déployer et n'utilisent aucun rôle administratif :

```sql
-- Page suivant la dernière série reçue ; omettre la comparaison pour la première page.
select * from public.drill_series
where user_id = (select auth.uid())
  and (unit, week) > ('uc3', '2026-W43')
order by unit, week
limit 200;

-- Premières réponses : le curseur contient toutes les colonnes du tri.
select * from public.drill_answers
where user_id = (select auth.uid())
  and (answered_at, series_id, question_id) >
      ('2026-10-20T08:00:00Z'::timestamptz,
       '20000000-0000-4000-8000-000000000001'::uuid,
       'uc3-matiere-organique-k2')
order by answered_at, series_id, question_id
limit 200;

-- Historique d'une question ; mêmes filtres de série/question à chaque page.
select * from public.drill_training_attempts
where user_id = (select auth.uid())
  and series_id = '20000000-0000-4000-8000-000000000001'::uuid
  and question_id = 'uc3-matiere-organique-k2'
  and (created_at, operation_id) >
      ('2026-10-24T10:15:00Z'::timestamptz,
       '40000000-0000-4000-8000-000000000001'::uuid)
order by created_at, operation_id
limit 200;
```

PostgREST exprime ces comparaisons de tuples par des filtres `or`/`and`. Par exemple, pour les séries, le curseur équivaut à `unit > dernièreUC OR (unit = dernièreUC AND week > dernièreSemaine)`. Le client doit dédupliquer les lignes par identité technique et parcourir toutes les pages. S'il utilise plutôt des ranges, [Supabase précise qu'un ordre doit être fourni](https://supabase.com/docs/reference/javascript/range) ; un offset sans ordre fiable n'est pas une stratégie de récupération complète.

Ces curseurs paginent un ensemble de lignes immuables ; **ils ne constituent pas un journal de synchronisation transactionnel**. Une nouvelle série peut arriver avant un curseur d'UC/semaine et un import ancien peut apporter un `answered_at` antérieur au curseur d'activité. Même `created_at`, attribué avant le commit, ne constitue pas seul une preuve que toutes les transactions antérieures sont visibles. Le lot 6.2.2 doit donc prévoir la reprise et la réconciliation de l'historique, sans déclarer définitivement absent tout ce qui précède un curseur. Aucune file d'événements, séquence globale ou garantie de snapshot multi-requêtes n'est ajoutée ici.

## Reconstitution du format Drill et Dashboard

Le futur adaptateur pourra conserver les calculs et renderers existants :

1. Lire toutes les pages des séries personnelles, sans dépendre de la banque courante, puis les indexer par `series_key`.
2. Mapper `series_key → id`, `started_at → startedAt`, et recopier `unit`, `week` et le tableau `questions` sans en changer l'ordre ou les versions.
3. Créer `answers[question_id]` à partir de chaque première réponse avec `{answer, correct, answeredAt}`.
4. Initialiser `attempts` avec une copie de cette première réponse portant `training:false`, puis ajouter chaque tentative distante avec `training:true`, dans un ordre stable. Le renderer actuel utilise la dernière entrée pour présenter le dernier entraînement.
5. Conserver `drafts` et `trainingDrafts` locaux ; leur absence distante ne doit pas les remettre à zéro. Fournir des maps vides uniquement pour un document réellement nouveau, sans brouillons locaux à préserver.
6. Conserver à côté les identités techniques et UUID d'opérations nécessaires aux retries. Le lot 6.2.2 choisira leur emplacement versionné ; les IDs métier/questions existants ne doivent pas être remplacés par les UUID SQL.
7. Passer par les règles de validation du lecteur avant affichage et ne pas transformer une panne ou un conflit de snapshot en résultat vide.

La racine destinée à `readDrillState()` reste `{version:1,series:{...}}` ; la vue attendue par les calculs et `readDashboardData()` reste `{series,error,warnings}`. La sérialisation des dates doit conserver des ISO avec fuseau. Les statistiques utilisent toujours les réponses racines ; les tentatives supplémentaires n'augmentent ni le nombre de premières réponses ni le taux principal. Une ancienne série réalisée aujourd'hui contribue à la semaine d'activité d'aujourd'hui, via `answeredAt` en Europe/Paris, sans changer sa semaine d'origine.

Les nouveaux UUID seront attribués et persistés par la future couche d'import **avant** tout envoi. Deux anciens entraînements identiques dans le tableau doivent recevoir deux identités distinctes ; un retry de l'une de ces lignes doit retrouver son UUID initial. Aucune attribution ni migration locale n'est exécutée dans le lot 6.2.1.

## Tests et validation attendue

Les tests du lot 6.1 sont conservés. La suite SQL vérifie les tables, clés, CHECK, index, RLS, politiques, privilèges de colonnes/fonctions, triggers et comportements d'immutabilité. La suite réelle utilise deux comptes fictifs dans la stack Supabase locale éphémère : JWT personnels A/B, requêtes PostgREST et RPC, refus anonymes et JWT falsifiés, références intercomptes, correction calculée, refus d'UPDATE/DELETE et payloads invalides. Les scénarios concurrents confrontent des requêtes HTTP réellement simultanées, puis relisent les lignes, plutôt que simuler la concurrence dans une map JavaScript.

Les contrôles restent `unit-integration`, `e2e` et `supabase-security`. Le dernier conserve les seules clés locales de la stack, son nettoyage ciblé et l'absence de cible hébergée. Les guards des runners refusent tout projet DEV/PROD distant. Les tests de mocks ou de frontend autonome ne remplacent ni PostgreSQL ni les JWT réels. Les commandes, nombres de succès/échecs, liens CI et scénarios effectivement exécutés sont fournis par la [validation du lot](../validations/VALIDATION-LOT6-2-1.md), sans les déduire de la présence de ces tests.

## Limites et décisions reportées

Le snapshot fourni par un client authentifié est validé pour sa structure et sa cohérence, puis figé ; il n'est pas certifié conforme à une banque serveur de confiance. La banque JSON et ses bonnes réponses sont déjà publiques. Un client falsifié peut construire son propre snapshot valide et obtenir un résultat cohérent avec celui-ci. Le calcul serveur de `correct` empêche une modification libre du booléen ou du résultat déjà enregistré, mais ne transforme pas cet outil d'entraînement en examen inviolable.

L'immutabilité décrite est celle des opérations accordées aux étudiants. Un administrateur PostgreSQL dispose de pouvoirs distincts ; aucun mécanisme de preuve cryptographique ou d'audit administratif inviolable n'est revendiqué. De même, les dates hors ligne restent déclaratives et la confidentialité dépend aussi des sessions Auth et des protections de l'appareil, décrites dans [AUTHENTIFICATION.md](AUTHENTIFICATION.md).

Restent au lot 6.2.2 : attribution/persistance des UUID locaux, import non destructif, outbox, reconnexion, backoff, fusion multi-appareils, traitement visible des conflits, réconciliation des pages et stratégie des brouillons. Aucun champ de draft distant n'est créé ici. Le lot 6.2.3 traitera la lecture distante du Dashboard et sa recette. Les QCM classiques, la botanique, les ITK, les thèmes et les profils ne changent pas.

La migration a été appliquée sur DEV le **24 octobre 2026**, après validation locale/CI réelle, audit de l'historique, simulation ciblée et accord explicite de l'utilisateur. L'historique, les tables, RLS, privilèges, contraintes et fonctions ont ensuite été relus ; la simulation finale confirme qu'aucune migration n'est en attente. Le [rapport du lot](../validations/VALIDATION-LOT6-2-1.md) consigne ces preuves et leurs limites. Les deux comptes fictifs existants et leurs profils sont conservés. Aucun reset distant, changement de PROD, configuration SMTP/Auth, ouverture aux étudiants, fusion ou publication n'a été effectué.
