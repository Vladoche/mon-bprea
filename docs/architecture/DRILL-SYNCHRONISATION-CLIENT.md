# Mode Drill — synchronisation du client (lot 6.2.2)

Le Drill connecté utilise un cache personnel et les RPC du [contrat PostgreSQL](DRILL-SYNCHRONISATION-BACKEND.md). Le mode visiteur garde intégralement `bprea-demo-drill-v1`. Aucun historique visiteur n'est importé automatiquement. Le site reste statique et la configuration publiée reste désactivée. Les preuves exécutées figurent dans [VALIDATION-LOT6-2-2.md](../validations/VALIDATION-LOT6-2-2.md).

## Frontières des modules

| Module | Responsabilité |
| --- | --- |
| `drill-engine.js`, `drill-bank.js` | Pédagogie et validations existantes, sans réseau |
| `drill-store.js` | Stockage visiteur ; mutations pures et lecteur de document réutilisés par le cache personnel |
| `drill-personal-store.js` | Transactions IndexedDB, séparation des identités, données et opérations persistées ensemble |
| `drill-sync-model.js` | Validation des lignes, réconciliation, dépendances, confirmations et archives de conflits |
| `drill-sync-transport.js` | Client Supabase partagé, JWT fixé par requête, RPC et pagination complète |
| `drill-sync-service.js` | Sélection visiteur/personnel, générations, abonnements, envois et backoff |
| `drill-sync-ui.js`, `drill.js` | États accessibles, reprise explicite des conflits et interface pédagogique existante |
| `auth-local-identity.js`, `auth-service.js` | Identité Auth vérifiée et continuité locale limitée en cas de panne |

## Persistance personnelle atomique

IndexedDB `mon-bprea-drill-personal-v1`, version 1, contient l'object store `accounts`. Sa clé est la sérialisation JSON de `[environment, origineSupabase, UUIDAuth]`. Ainsi DEV/PROD, deux projets et deux comptes ont des espaces différents, indépendamment de l'adresse e-mail.

```text
{
  version: 1, scope,
  drill: { version: 1, series: { "uc3__2026-W42": sérieLocale } },
  operations: [opération],
  remote: { series: [lignesSQL], answers: [lignesSQL], training: [lignesSQL] },
  conflicts: [archive], lastReconciledAt
}
```

Le document Drill utilise exactement les snapshots, premières réponses, `attempts`, `drafts` et `trainingDrafts` existants. Le lecteur partagé ignore les champs inconnus ; un document personnel incomplet, une version inconnue ou une file illisible bloque les écritures sans réinitialisation. Aucun effacement automatique n'est ajouté.

Chaque action personnelle relit le document dans une transaction `readwrite`, applique les règles pédagogiques, ajoute si nécessaire l'opération, puis écrit un seul record. Le succès est annoncé uniquement après `transaction.oncomplete`. Si la validation, le verrou IndexedDB ou le `put` échoue, toute la transaction est annulée : la réponse et la file ne peuvent pas être conservées séparément. Les transactions sérialisent les écritures concurrentes de plusieurs onglets. BroadcastChannel annonce seulement une clé d'espace à relire ; il n'échange ni token ni progression.

Les brouillons sont modifiés dans cette même base, mais ne créent aucune opération réseau. Le cache visiteur reste en localStorage avec ses compatibilités et limites historiques ; il n'est ni déplacé ni effacé.

## File durable et idempotence

```text
{
  id: UUID, type: "series" | "answer" | "training", seriesKey,
  payload: contenuOriginal, rpcPayload: null | corpsRPCFigé,
  state: "pending" | "confirmed" | "conflict" | "blocked" | "error",
  failures, retryAt, error
}
```

L'UUID est créé dans la transaction de l'action, avant tout envoi. Une première réponse répétée n'ajoute aucune opération. Deux entraînements volontaires identiques ont deux UUID distincts, même avec même choix et date ; la règle visiteur de déduplication d'un événement identique reste inchangée.

La création conserve les quatre paramètres originaux de `drill_create_series`. Une réponse conserve `p_operation_id`, `p_question_id`, `p_answer` et `p_answered_at`. Son `p_series_id` n'est ajouté qu'après confirmation de la série personnelle et vérification du snapshot ; le corps RPC complet est alors persisté avant l'appel. Tous les retries le réutilisent à l'identique, sans nouvelle date ou nouvelle sélection dans la banque.

L'ordre est série → première réponse → entraînements. Un entraînement exige une première réponse personnelle déjà confirmée dans les lignes distantes. Des requêtes simultanées d'onglets peuvent rejouer une même opération : les identités persistées et les contraintes du serveur garantissent leur idempotence.

`inserted` et `replayed` sont acquittés après contrôle du propriétaire, du type de ligne, des identifiants, du payload, du snapshot, de la correction et des timestamps. Un timeout peut suivre un commit réussi : la file reste en attente et le même corps est renvoyé. Une lecture complète peut aussi confirmer l'opération par son UUID et son contenu.

## Erreurs et reprise

| Signal | Comportement |
| --- | --- |
| Réseau, `40001`, indisponibilité serveur | Même opération conservée ; backoff 1, 2, 4, 8, 16, 32 puis 60 secondes maximum |
| JWT expiré, `PGRST303`, session changée | Envois suspendus ; reconnexion/vérification du bon compte requise |
| `42501`, `23514`, `23503`, `23505`, `23502`, `22P02`, réponse incohérente | Opération conservée en erreur, sans boucle de retry automatique ; détail non sensible affiché |
| Stockage personnel illisible, absent ou plein | Échec explicite, aucune validation fictive de réponse |

Le bouton « Réessayer la synchronisation », l'ouverture de la page, le retour réseau et le retour sur un onglet permettent la reprise. Le retry manuel ne régénère aucun UUID et ne relance pas aveuglément les opérations en erreur permanente. Une intervention reste nécessaire pour corriger une donnée refusée ; aucune modification du backend n'est effectuée pour contourner son refus.

Le retour de l'identité Auth `offline` à `authenticated` pour le même espace personnel déclenche aussi une relecture distante et la reprise, sans événement navigateur `online`. Cette transition dépend du précédent statut Auth, même si la file est passée à `pending`. Les publications `authenticated` ordinaires ne relancent pas un nouveau cycle. La [revue corrective post-fusion](../validations/VALIDATION-LOT6-2-2-REPRISE-AUTH.md) consigne la reproduction et les régressions associées.

Chaque requête PostgREST combine l'annulation de génération avec un timeout de 15 secondes. Une transaction locale sans changement ne réécrit pas le document et n'émet aucune notification, ce qui évite les boucles entre onglets au repos.

## Lecture distante et réconciliation

À l'ouverture identifiée : lecture du cache, scan distant, réconciliation transactionnelle, puis envoi des opérations possibles. Le transport lit `drill_series`, `drill_answers` et `drill_training_attempts` avec filtre personnel, ordre total par UUID (`id` ou `operation_id`) et curseur `gt`, par pages demandées de 200 lignes. Il continue jusqu'à une page vide, même si le serveur impose une taille inférieure. Une erreur sur une page invalide le scan entier ; elle n'efface pas le cache ni ne devient un historique vide.

Les lignes sont validées ensemble avant commit : propriétaire, snapshots, unicité, existence de la série et de la première réponse, validité des choix et correction. Une relation devenue visible entre deux scans peut provoquer une nouvelle lecture complète. Les dates PostgreSQL sont conservées ; les comparaisons d'opérations respectent l'instant et la précision microseconde reçue.

Le scan n'est pas un journal transactionnel. Une réponse ancienne arrivée tard ou un UUID inséré avant le curseur sera retrouvé au scan complet suivant. Une relecture est faite à l'ouverture, au retry manuel, au retour réseau, et au retour sur la page si le dernier scan date d'au moins une minute. Les validations successives ne téléchargent pas systématiquement tout l'historique.

Les réponses racines distantes font autorité ; les entraînements sont dédupliqués par UUID, ordonnés par `created_at` et UUID, puis ajoutés avec `training:true`. Les opérations encore locales restent visibles. Les brouillons ne sont pas remplacés par une absence de brouillon distant.

## Conflits conservés et visibles

Une archive persistante contient la copie locale, l'opération et la version distante utiles. Elle n'est pas supprimée après résolution.

| Conflit | Affichage et reprise |
| --- | --- |
| Deux premières réponses | La gagnante serveur est affichée. Le choix local et ses tentatives restent dans l'archive. Les entraînements dépendants sont suspendus. « Continuer avec la réponse du compte » autorise les nouvelles actions, sans renvoyer ou convertir les anciennes |
| Deux créations de série, snapshot ou date différents | Snapshot local et réponses conservés. Aucune réponse n'est rattachée automatiquement au snapshot distant. « Reprendre la série du compte » remplace la vue active par la copie distante tout en gardant l'archive locale et les opérations bloquées |
| UUID réutilisé avec un autre contenu ou une autre question/série | Opération suspendue. La ligne reçue n'est jamais rangée sous la question demandée. Intervention explicite nécessaire ; aucune conversion automatique en entraînement |

Les brouillons d'un snapshot incompatible restent dans son archive. Les opérations bloquées restent conservées et ne sont pas relancées par un retry générique. La première réponse serveur n'est jamais modifiée.

## Identité, déconnexion et cache hors ligne

Le service Auth reste unique et les profils conservent leurs protections. Avant un accès distant, `verifiedSession(UUIDAttendu)` vérifie le compte avec `getUser()`, contrôle la session du SDK et renvoie un jeton uniquement en mémoire. Le transport fixe ce JWT dans l'en-tête de chaque requête construite avec le client partagé. Une rotation de session vers B ne remplace donc pas le JWT d'une opération capturée pour A.

Un changement de compte, une déconnexion ou une sortie de page invalide la génération et annule les requêtes. Les callbacks et transactions vérifient cette génération avant d'appliquer leurs résultats. L'interface retire immédiatement les vues personnelles pendant la déconnexion ; une réponse tardive d'A ne peut pas réapparaître chez B. Au retour du cache de navigation, la page recharge pour vérifier l'identité.

Pour la continuité locale, un marqueur séparé conserve seulement l'UUID vérifié et le `session_id`, dans un espace lié à l'environnement, au projet et au chemin du site. Il ne contient ni JWT, refresh token, mot de passe ni e-mail. Si `getUser()` échoue pour une raison réseau, l'état `offline` n'est permis que si la session locale du SDK correspond à ce marqueur. Ce n'est pas une authentification distante et aucune donnée n'est envoyée avant une nouvelle vérification serveur. Un rejet explicite, une autre session ou une identité incertaine masque le cache privé. La déconnexion retire le marqueur, sans supprimer les données ni les opérations personnelles.

Ce marqueur et IndexedDB ne constituent pas une protection contre une personne contrôlant le profil du navigateur, une extension ou une faille XSS. Le cache n'est pas chiffré. Cette limite est indiquée dans le Drill. Se déconnecter masque les données à l'interface, mais préserve les réponses en attente pour la prochaine connexion du bon compte.

Les séries déjà sauvegardées sont utilisables pendant une panne API. Les pages, modules et configuration doivent toutefois être disponibles : aucun service worker ni cache applicatif hors connexion intégral n'est ajouté. Un exercice jamais chargé n'est pas promis hors ligne. Les protections JWT/RLS restent celles du serveur.

## Interface de lecture pour le lot 6.2.3

`getDrillSyncService().getState().view` fournit `{series,error,warnings}`, au même format normalisé que `readDashboardData()`, pour l'identité active seulement. Il ne faut pas aller lire arbitrairement un record IndexedDB d'un autre espace.

La conversion SQL → Drill conserve `series_key → id`, `started_at → startedAt`, les dix snapshots historiques, chaque première réponse racine et une liste `attempts` commençant par `training:false`, suivie des entraînements `training:true`. Les brouillons locaux restent séparés. Les calculs pédagogiques existants restent réutilisables.

Le Dashboard actuel consulte toujours le JSON visiteur. Une mention explicite « Données locales de cet appareil » distingue sa portée des résultats personnels synchronisés. Aucun graphique, filtre, calcul ou accès distant du Dashboard n'est ajouté au lot 6.2.2.
