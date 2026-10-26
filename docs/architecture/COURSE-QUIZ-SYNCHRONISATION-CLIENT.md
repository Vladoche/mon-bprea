# Cours et QCM — synchronisation personnelle (lot 6.3.2)

Le client consomme exclusivement `course_states`, `quiz_attempts`, `personal_save_course` et `personal_record_quiz` du [contrat backend 6.3.1](PERSONAL-DATA-BACKEND.md). Il reste statique et conserve les calculs de `getUnitExamStats()`. Les [preuves exécutées](../validations/VALIDATION-LOT6-3-2.md) distinguent tests applicatifs et PostgreSQL/Auth réels.

## Modules et sources

| Module | Responsabilité |
| --- | --- |
| `course-quiz-model.js` | Validation, intentions, révisions, dépendances, confirmations, réconciliation et projection au format statistique existant |
| `course-quiz-store.js` | Cache personnel IndexedDB et contrat du document |
| `personal-idb.js` | Mécanisme transactionnel partagé avec le Drill ; aucune dépendance frontend ajoutée |
| `course-quiz-import.js` | Analyse prudente de la source historique, manifeste et import volontaire |
| `course-quiz-transport.js` | Session vérifiée, JWT fixé, RPC et scans paginés |
| `course-quiz-service.js` | Identité active, choix de source, abonnements, reprise et erreurs |
| `sync-runtime.js` | Classification d’erreurs et backoff partagés avec le Drill |
| `course-quiz-ui.js`, `app.js`, `section-hubs.js`, `exam-preparation.js` | Messages accessibles, import, conflits et parcours pédagogiques |

Le visiteur conserve la clé `bprea-demo-progress-v1`, son format, ses archives et ses fonctionnalités. Un compte utilise uniquement son espace personnel. Aucune lecture visiteur ne remplit implicitement un espace personnel. L’identité incertaine masque les données privées ; une identité locale reconnue par le service Auth permet la consultation et l’écriture du cache fiable pendant une panne, sans autorisation d’envoyer.

Le service expose une vue `{progress,error,warnings}` ; l’adaptateur reconstruit les champs `done`, `score`, `legacyQuizScore` et `quizAttempts` attendus par `exam-stats.js`. Les tentatives distantes et locales sont réunies par UUID, jamais par score/date. Les pages ne lisent pas directement un record IndexedDB arbitraire.

L’accueil, les UC, les cours, les QCM et leurs résultats utilisent cette source. Le bandeau de préparation utilise la vue Drill personnelle existante pour le compte ; s’il ne peut vérifier cette source, il indique son indisponibilité. Les QCM personnels ne sont jamais associés au Drill visiteur. Le Tableau de bord reste consacré aux premières réponses du Drill ; ses formules et son périmètre ne sont pas changés.

## Persistance atomique

La base `mon-bprea-course-quiz-personal-v1` contient un store `accounts`. La clé de compte est `JSON.stringify([environment, origineSupabase, UUIDAuth])`, selon la même validation de portée que le Drill. Les projets, environnements et comptes restent indépendants.

Le document versionné conserve les cours, tentatives par UUID, lignes distantes, opérations, conflits, manifestes d’import et date de dernière réconciliation. Une mutation relit et valide ce record dans une transaction IndexedDB `readwrite`, puis persiste données et opérations ensemble. Le résultat n’est annoncé enregistré qu’après `transaction.oncomplete`. Une exception ou un échec du `put` annule la transaction entière. La fermeture, le rechargement et la déconnexion n’effacent aucune opération.

Les opérations conservent leur UUID, type cours/tentative, intention, payload RPC figé, dépendances, état, nombre d’échecs, échéance de retry et diagnostic. Les écritures de plusieurs onglets sont sérialisées par IndexedDB. BroadcastChannel annonce seulement la portée à relire, sans contenu privé ni token. Un cache illisible ou d’une version inconnue bloque l’écriture sans réinitialisation.

## Cours réversibles et conflits

Une nouvelle intention conserve un UUID et un payload complet figé dans la transaction de création, avant tout envoi. La première création utilise la révision attendue 0. Les suivantes utilisent une révision serveur connue ou, en présence d’une intention précédente, sa révision attendue augmentée de un et une dépendance explicite. Le retry ne change ni UUID, ni base, ni contenu.

Les mutations locales successives d’un cours forment une chaîne. Une intention dépendante ne part pas comme une opération indépendante avec la même base. Après confirmation vérifiée, le client exige que la révision obtenue corresponde exactement à sa base déjà persistée. Si le prédécesseur est en conflit, ses dépendants sont conservés et suspendus. « Conserver mon choix » crée une nouvelle intention sur la base actualisée avec un nouvel UUID. « Garder la version du compte » résout le conflit sans nouvelle mutation distante ; les anciennes intentions restent archivées.

La ligne serveur et sa révision font autorité lors d’un conflit ; l’intention locale incompatible reste dans une archive consultable. Une réponse d’UUID/payload/propriétaire/base incohérente n’acquitte jamais l’opération. `done:false` est une intention explicite : aucun OR des états terminés et aucune priorité donnée à l’horloge de l’appareil. Un score parfait ancien n’est pas une nouvelle action de complétion.

Les singletons backend conservent seulement leur dernier reçu : une opération déjà acceptée puis remplacée peut devenir conflictuelle après perte de son acquittement. Le client ne réapplique pas automatiquement cette ancienne intention et conserve les informations nécessaires à une résolution volontaire.

## Tentatives et scores

Chaque correction effective crée un UUID durable et une tentative immuable contenant uniquement cours, score, total et date réelle de validation. Deux corrections avec valeurs identiques gardent deux UUID. Un retry exact ne crée aucun doublon. Une collision d’UUID détectée localement est refusée en annulant la transaction, sans nouvelle archive ; un conflit distant avec un contenu différent conserve l’opération d’origine dans une archive.

Le meilleur score absolu ne diminue pas. La base ancienne `legacy_score/legacy_total` reste distincte des tentatives. Un ancien score sans date n’engendre ni tentative, ni date inventée, ni snapshot de questions ou réponses individuelles. Le moteur statistique existant garde ses dénominateurs et ses avertissements d’historique partiel.

Un nouveau QCM parfait peut créer une intention de cours terminé, séparée de l’insertion de tentative. Ces deux opérations sont persistées ensemble localement, mais restent indépendantes dans PostgreSQL. La confirmation de la tentative ne confirme pas le cours ; en cas de CAS conflictuel, la tentative acceptée reste comptée une fois et le cours demande une décision.

## Import volontaire et provenance

Le bouton d’import ouvre une prévisualisation : cours terminés, tentatives exploitables, scores anciens et données conservées hors import. Elle rappelle que l’historique vient de cet appareil et peut appartenir à une autre personne. Annuler ne crée pas d’opérations. Confirmer est indispensable ; une connexion n’importe rien.

Avant tout envoi, une seule transaction IndexedDB conserve l’instantané brut de la clé visiteur, sa provenance et la correspondance entre positions source et UUID attribués. Deux entrées de même contenu restent deux positions distinctes. Reprendre le même manifeste réutilise les UUID et ne réinsère pas un nouvel historique. La clé d’origine n’est jamais modifiée par l’import.

La provenance est une identité locale de sauvegarde, pas une empreinte des scores ou des dates et pas une empreinte matérielle de l’appareil. Un premier import exige une passe distante complète réussie au moment de la confirmation. Si le compte possède déjà des tentatives sans manifeste local établissant la provenance commune, l’import de nouvelles tentatives est refusé : une copie sur un deuxième appareil n’est pas fusionnée par supposition. Un instantané changé ou une provenance incompatible s’arrête aussi avec une explication. Aucune interface de fusion approximative de sauvegardes indépendantes n’est ajoutée. La reprise certaine d’un manifeste inchangé reste possible hors ligne ; un premier import attend la connexion.

`progressArchive`, `quizAttemptsArchive`, `quizScoreArchive`, `legacyQuizScore`, propriétés inconnues et valeurs non interprétables restent dans l’instantané brut. Seuls les champs connus et validés alimentent les RPC. Les anciennes dates de précision supérieure à six décimales sont signalées et conservées sans arrondi ni envoi, pour ne pas promettre un retry identique après une conversion de précision PostgreSQL non établie. Les dates créées par le site ont trois décimales. Une archive brute ne devient pas une preuve pédagogique. Les états personnels préexistants incompatibles ne sont pas écrasés par l’import ; leur résolution reste explicite.

## Réseau, session et réconciliation

Chaque accès distant appelle le service Auth partagé pour vérifier l’UUID attendu et capture un JWT fixé à la requête. Les générations et AbortController invalident le travail après déconnexion/changement de compte/sortie de page ; une réponse tardive d’A ne peut s’appliquer à B. Les tokens ne sont jamais copiés dans le cache pédagogique.

Les lectures utilisent un filtre `user_id` en complément de RLS. Les cours sont parcourus par `lesson_id`. Les tentatives utilisent l’ordre ascendant `(created_at,attempt_id)` et le filtre lexicographique contractuel, par pages bornées poursuivies jusqu’à une page vide. Une erreur de page invalide la passe entière ; aucune absence partielle ne remplace un historique fiable. Les confirmations et la réconciliation sont transactionnelles.

Les scans complets reprennent au chargement, à l’actualisation, au retour réseau/Auth et périodiquement au retour sur la page. Ils réunissent les tentatives par UUID et les cours par identité/révision, en conservant les opérations non confirmées. `created_at` n’est pas un journal transactionnel : des passes complètes suivantes retrouvent les insertions devenues visibles tardivement. Aucune garantie d’instantané global n’est revendiquée.

Le backoff partagé est borné à 60 secondes (1, 2, 4, 8, 16, 32, 60). Une erreur permanente suspend l’opération ; un retry générique ne modifie jamais son payload. Une session expirée suspend les envois et demande la vérification du même compte. Le retour Auth `offline → authenticated` relance une lecture/reprise même sans événement navigateur `online`.

Les messages distinguent stockage local, en attente, en cours, synchronisé, panne, conflit et erreur de sauvegarde. Une simple écriture IndexedDB n’est jamais annoncée comme une réussite Supabase. Sans cache fiable et sans réseau, la vue indique son indisponibilité au lieu d’afficher des statistiques nulles.

## Limites et lot 6.4

Le cache n’est pas chiffré et reste accessible à une personne contrôlant le profil navigateur, à une extension ou à un XSS. La déconnexion masque les vues et conserve l’historique/outbox. Aucun service worker n’est ajouté : les modules et pages doivent être disponibles pour travailler pendant une panne API. Les résultats déclarés par le navigateur ne sont pas des examens certifiés.

Le lot 6.4 devra couvrir explicitement export, suppression autorisée, durée de conservation et diagnostic des caches, outboxes, conflits et instantanés importés, en plus d’Auth/profils/Drill/backend/sauvegardes. Les scopes par UUID donnent les racines techniques, sans constituer une procédure RGPD validée. Aucune purge automatique n’est introduite.

Le défaut `assets/auth-config.json` reste désactivé. Aucune migration/RLS/RPC ni configuration hébergée n’est modifiée. Les essais réels utilisent exclusivement la stack locale éphémère et les comptes fictifs gardés par `tests/helpers/auth-local.js`. DEV et PROD ne sont pas des cibles de recette de ce lot. L’ouverture aux étudiants attend les lots 6.4 et 6.5.
