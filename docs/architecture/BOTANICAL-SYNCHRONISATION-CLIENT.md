# Botanique — synchronisation personnelle (lot 6.3.3)

Le client utilise exclusivement les tables `botanical_sessions`, `botanical_answers` et les RPC `personal_save_botanical_session`, `personal_record_botanical_answer` du [contrat 6.3.1](PERSONAL-DATA-BACKEND.md). Aucun changement SQL, RPC, RLS ou privilège de profil. Les [preuves de validation](../validations/VALIDATION-LOT6-3-3.md) distinguent Chromium autonome et Supabase local réel.

## Audit et réutilisation

Le jeu sauvegardait déjà une session avant ses réponses, avec une identité stable `${sessionId}-qN` par question. Il conservait uniquement des métadonnées historiques, sans les choix de questions permettant une reprise de partie. Le store visiteur accepte certaines réponses orphelines que le backend interdit : une session manquante ne peut pas être reconstituée.

| Module | Rôle conservé ou ajouté |
| --- | --- |
| `botanical-engine.js` | Sélection, distracteurs, correction, révision, chronomètre et `calculateStats()` inchangés |
| `botanical-bank.json`, photos, sources | Catalogue public versionné, crédits et licences inchangés ; aucun transfert de JPEG |
| `botanical-store.js` | Format visiteur et compatibilités historiques inchangés |
| `botanical-sync-model.js` | Contrat des sessions/réponses, intentions, dépendances, confirmations et conflits |
| `botanical-personal-store.js` | Repository de domaine utilisant `personal-idb.js` et la portée validée existante |
| `botanical-import.js` | Prévisualisation et manifeste du format botanique, indépendant du format cours/QCM |
| `botanical-sync-transport.js` | JWT fixé, lectures bornées et les deux RPC contractuelles |
| `botanical-sync-service.js` | Source active, générations, cache fiable, retries, scans et abonnements |
| `botanical-sync-ui.js`, `botanical.js`, `botanical.css` | Suivi accessible, import volontaire et intégration au jeu existant |

Le lot réutilise la transaction `createScopedRepository()`, la portée `[environnement, origine Supabase, UUID Auth]`, le backoff `delayFor()` et la classification commune. Auth, marqueur de continuité et client SDK sont les singletons partagés existants. Les patrons stables des cours/QCM servent aux scans, générations, import frais et statuts ; leurs formats métier ne sont pas fusionnés. Aucune infrastructure concurrente, dépendance de production ou modification des primitives partagées.

## Sources et sauvegarde atomique

En visiteur, seule la clé `monbprea.botanical.v1` contient `{schemaVersion:1,answers:[],sessions:[]}`. La connexion ne lit pas cette clé pour remplir le compte. Chaque compte utilise IndexedDB `mon-bprea-botanical-personal-v1`, version 1, store `accounts`, avec la portée validée comme clé.

Le record conserve `version`, `scope`, `sessions`, `answers`, `remote`, `operations`, `conflicts`, `imports`, `importArchives` et `lastReconciledAt`. Les lignes SQL reçues restent distinctes des données pédagogiques projetées. Les tableaux d’opérations et archives ne sont pas purgés à la déconnexion. Les copies d’import ambiguës sont archivées avec leur source brute ; l’interface expose seulement un résumé lisible.

Chaque mutation relit le record sous transaction `readwrite`, valide sa version, applique l’intention et ajoute son opération avant un seul `put`. Le succès est rendu seulement après `transaction.oncomplete`. Un échec de validation, quota ou transaction annule l’ensemble. Une réponse ne peut donc pas exister sans son opération durable. Les transactions sérialisent les onglets ; BroadcastChannel annonce uniquement la portée à relire, jamais des réponses ou des tokens. Un record futur/corrompu est conservé sans réinitialisation.

## Création → réponses → complétion

Une création enregistre les métadonnées avec `completedAt:null`, un UUID d’opération et `expectedRevision:0`. Chaque réponse garde `id === questionId`, ses valeurs et son instant réels ; son opération dépend de la création locale lorsqu’elle existe. La RPC de réponse ne reçoit pas l’UUID technique de l’outbox : l’identité métier est le reçu idempotent.

Terminer enregistre une intention séparée et sa première date de fin réelle, même hors ligne ou après échec de stockage. Cette intention dépend de toutes les réponses locales de la session restant à confirmer et utilise la révision attendue de la session. Elle ne peut partir avant elles. Le payload, UUID et base sont persistés avant envoi et restent identiques pendant les retries. Les réponses ne changent pas la révision SQL de la session.

Le booléen JSON `revision` indique un entraînement de révision des erreurs ; la colonne SQL `revision` est un compteur de concurrence. Le modèle les conserve séparément, avec `is_revision` pour la conversion des lignes SQL. Une session partielle ou sans réponse peut être terminée. Envoyer toutes les réponses connues ne termine jamais implicitement une session.

Les dates civiles sont validées, avec UTC pour les données du jeu et prise en charge explicite des timestamps PostgreSQL avec fuseau. Les microsecondes reçues sont conservées pour comparer reçus et curseurs. Une réponse doit correspondre aux catégorie/mode/révision de sa session, être entre son début et sa fin éventuelle et respecter sa capacité. Une fin antérieure à une réponse provoque un conflit durable : aucune date n’est déplacée silencieusement. Les précisions source supérieures à six décimales restent hors import, sans arrondi supposé.

## Identités, confirmations et conflits

Une question possède une réponse initiale immuable. Un retry exact est reconnu par contenu et identité ; deux questions différentes d’une même plante restent deux tentatives. Ni les plantes, photographies, dates, scores, ni la réussite d’une révision ne servent à fusionner ou supprimer un échec ancien.

Les confirmations `{status,row}` vérifient propriétaire, session, question, identifiants, valeurs métier, dates et, pour les sessions, UUID/base/révision de l’opération correspondante. Une ligne incohérente n’acquitte rien. Ligne distante et état confirmé sont persistés dans la même transaction. Une perte HTTP après commit réutilise strictement le payload durable.

Les conflits de métadonnées, de réponse, de fin, de CAS, de dates ou de parent conservent l’opération et les versions nécessaires dans `conflicts`. Les dépendants sont bloqués, jamais rattachés à une autre session. Une ancienne complétion déjà remplacée peut revenir en conflit après perte d’acquittement ; elle ne redevient pas une nouvelle intention. Les erreurs permanentes ne bouclent pas automatiquement.

La projection conserve la version serveur lorsque la même identité est divergente. L’interface permet « Garder la version du compte » : résolution explicite, sans réécriture des historiques, nouvel identifiant de question ou disparition de l’archive. Elle emploie des libellés pédagogiques au lieu d’afficher des corps RPC.

Après cette décision, une nouvelle intention de fin peut dépendre des seuls enregistrements encore actifs : une réponse conflictuelle explicitement archivée n’est pas exigée comme confirmation fictive. Les anciennes complétions bloquées et leurs payloads restent inchangés. Réessayer une même intention conflictuelle retrouve son opération/UUID et son archive, sans en créer une nouvelle. Les statistiques d’un résultat déjà affiché se mettent à jour après réconciliation sans déplacer le focus.

## Lecture complète et statistiques

Chaque requête vérifie Auth et fixe son JWT dans son en-tête. Les lectures filtrent explicitement `user_id` en complément de RLS. Pages demandées de 100, poursuivies jusqu’à une page vide : sessions par `session_id`, réponses par `(created_at,answer_id)` avec curseur lexicographique et valeurs échappées. La collation du texte appartient à PostgreSQL ; les curseurs conservent les microsecondes.

Une erreur de page invalide toute la passe, sans remplacer un cache fiable par un historique incomplet. Les scans complets successifs réunissent les identités et les révisions jusqu’à stabilisation, dans une limite bornée ; ouverture, actualisation, retour réseau/Auth et relectures périodiques permettent de retrouver des insertions tardivement visibles. `created_at` n’est pas un journal de commits et aucun snapshot global multi-requêtes n’est promis.

`view.history` fournit le format attendu par le moteur existant. Les réponses distantes et intentions locales compatibles sont réunies par question ; une opération déjà reconnue à distance n’est pas comptée une deuxième fois. `calculateStats()` reste inchangé : correctes / (correctes + incorrectes + timeout), `skipped_image` et questions non réalisées exclus. Les catégories, statistiques par espèce, confusions et espèces à réviser utilisent exclusivement cette source active. Une réussite ultérieure ne retire pas les erreurs historiques.

## Import volontaire

Prévisualiser montre sessions/réponses exploitables et données refusées, en rappelant que la sauvegarde peut appartenir à une autre personne. Annuler ne crée aucune opération personnelle. Confirmer exige le même compte, la même source brute et sa provenance ; un premier import exige une récupération distante complète et fraîche. Une copie possédant des identités déjà présentes sans provenance commune est refusée, même si son contenu ressemble à l’historique du compte.

La provenance locale `monbprea.botanical.provenance.v1` identifie cette sauvegarde, sans empreinte matérielle. Une transaction conserve le texte brut, la provenance, les correspondances positions→identités de sessions/questions, les UUID d’opération et l’état du manifeste. Reprendre le même import conserve ces identités et n’ajoute aucune tentative. Une copie différente ou une source modifiée ne se rapproche pas automatiquement.

Une réponse orpheline, un document futur/corrompu, des sessions invalides, dates impossibles, capacités dépassées ou identifiants ambigus restent hors transfert. Les champs inconnus restent dans l’instantané brut ; seuls les champs validés sont envoyés. La clé visiteur, les données refusées et les archives restent intactes. Aucune session fictive ne rend une réponse importable.

## Identité, interactions et limites

Les changements d’identité invalident la génération et annulent les requêtes. Chaque transaction et retour tardif vérifie sa génération. A→B→A reste distinct de la première génération A. Une partie affichée est abandonnée lors du changement : aucune complétion automatique et aucune écriture de ses réponses dans le compte suivant. Ses métadonnées et résultats déjà commités restent dans leur espace.

Un rejet réel de session masque le cache. Une panne autorise la consultation et l’écriture du cache du bon compte uniquement avec les garanties du marqueur Auth partagé ; aucun envoi n’a lieu sans vérification serveur. Le retour `offline → authenticated` reprend aussi sans événement `online`. La déconnexion conserve l’historique et l’outbox.

Le suivi ordinaire est séparé du jeu : il ne remplace ni question, photo, correction, choix, chrono ni focus. La réponse est évaluée par le moteur une seule fois, puis son résultat reste disponible en mémoire après un échec de stockage. La correction reste consultable ; « Réessayer l’enregistrement » reprend la même réponse et la navigation attend sa sauvegarde durable. La fin conserve aussi son premier instant pendant les retries.

Le cache n’est pas chiffré : une personne contrôlant le profil navigateur, une extension ou un XSS peut y accéder. Aucun service worker n’est ajouté ; pages, modules et photos doivent être disponibles pour jouer pendant une panne API. Il n’existe aucune reprise de partie après fermeture, entre appareils ou depuis des snapshots jamais sauvegardés. Les résultats restent déclaratifs, sans certification d’examen.

Les procédures de confidentialité, d’export, de conservation et de suppression attendent le lot 6.4. Le lot 6.3.4 n’est pas commencé. Le défaut Auth public reste désactivé ; DEV/PROD, Auth/SMTP hébergés, protections de `main` et invitations réelles ne sont pas modifiés. Aucun déploiement ou merge automatique.
