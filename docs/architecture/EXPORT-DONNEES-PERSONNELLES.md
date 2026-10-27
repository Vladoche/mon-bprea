# Consultation et copie des données personnelles — lot 6.4.2

Le profil propose **Mes données personnelles** : préparation d'une copie du compte après vérification serveur et consultation/téléchargement d'une sélection locale distincte. Site statique, fichier JSON construit sur l'appareil, sans nouveau prestataire, bibliothèque, RPC, migration ou privilège. Auth publique reste désactivée ; aucune ouverture ou suppression dans ce lot.

Cette fonctionnalité technique ne traite pas à elle seule toutes les demandes d'accès/copie (art. 12/15), et ne décide pas de l'applicabilité de la portabilité (art. 20). Celle-ci dépend notamment des bases et données concernées. **D01–D14 restent non validées.** Sources officielles consultées le **27/10/2026** : [CNIL, réponse au droit d'accès](https://www.cnil.fr/fr/repondre-une-demande-de-droit-dacces), [CNIL, portabilité](https://www.cnil.fr/fr/respecter-les-droits-des-personnes/professionnels-comment-repondre-une-demande-de-droit-la-portabilite), [RGPD, articles 12/15/20 sur CNIL](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3). Le projet de politique 6.4.1 n'est pas publié comme notice validée.

## Frontières et sécurité

| Module | Responsabilité |
| --- | --- |
| [export-sources.js](../../assets/export-sources.js) | Contrats des dix tables et colonnes explicites, clés locales autorisées, quatre bases et limites. |
| [export-model.js](../../assets/export-model.js) | Projection récursive par listes de champs, contrôle de propriétaire, enveloppe/dictionnaire, volume et sérialisation. Jamais de copie générique du stockage ou d'un objet session. |
| [export-transport.js](../../assets/export-transport.js) | SELECT paginés, vérification Auth et JWT fixé à chaque requête, filtres propriétaires, annulation et contrôle de progression. |
| [export-service.js](../../assets/export-service.js) | Identité/génération, passes bornées, compléments locaux, couverture et invalidation du résultat privé en mémoire. Les abonnés ne reçoivent que l'état et les catégories/comptages. |
| [personal-idb.js](../../assets/personal-idb.js), `readScopedRecord` | Un `get(scope)` dans une transaction readonly ; aucune énumération des utilisateurs, écriture, notification ou migration. Une ouverture créant une base absente est annulée et ne persiste pas de nouvelle base. |
| [export-ui.js](../../assets/export-ui.js), [export.css](../../assets/export.css) | Deux parcours, avertissement appareil partagé, choix explicites, états accessibles et téléchargement Blob temporaire. HTML fixe uniquement ; contenu local autorisé en `textContent`. |
| [auth-service.js](../../assets/auth-service.js) | Service existant : `getExportIdentity()` ajoute une projection limitée après `requireUser/getUser` serveur. `getIdentityVersion()` expose uniquement le compteur non secret de changement d'identité. `verifiedSession` partagé reste la frontière des requêtes. |

`auth-pages.js` monte la section une fois sur le profil, séparément du panneau de profil qui se recharge. Nettoyage sur pagehide et reconstruction lors du retour BFCache. Aucun export ne démarre au chargement. Aucun accès administratif dans le navigateur.

### Identité et générations

La copie de compte exige `status === authenticated` et un UUID ; ni cache, ni marqueur local, ni état `offline` ne suffisent. `getExportIdentity()` vérifie l'utilisateur auprès d'Auth au démarrage, après les passes et juste avant la remise du fichier. Chaque page SQL appelle aussi `verifiedSession(UUID)` et fixe son Bearer personnel sur la requête, sans changer les en-têtes globaux du client partagé.

L'orchestrateur capture environnement, origine projet, UUID, génération Auth et génération du travail. Un changement A→B→A, déconnexion, identité incertaine ou annulation invalide immédiatement le résultat en mémoire et les boutons, et annule les lectures PostgREST. Une réponse tardive ne republie aucun résultat. Les appels Auth déjà partis peuvent finir dans leur timeout, mais leur génération n'autorise plus de remise. Aucun `await` entre le contrôle final de génération et le clic de téléchargement effectif.

L'export n'écrit pas la progression, les outboxes ou les révisions. La vérification via le service Auth existant peut entretenir son marqueur de continuité et le SDK peut renouveler sa session : ce cycle Auth n'est pas une modification pédagogique, et ses secrets ne sont jamais sérialisés. Les lectures peuvent aussi être journalisées par l'infrastructure selon ses propres règles, non vérifiées depuis le dépôt.

Une nouvelle saisie du mot de passe n'est pas imposée par défaut : vérification serveur fraîche et session personnelle existante. Le besoin d'une réauthentification renforcée relève du contexte de risque à valider (D09/D13). Cette mesure ne protège pas contre une personne contrôlant déjà le profil navigateur et sa session valide ; les limites des caches non chiffrés et ordinateurs partagés du 6.4.1 demeurent.

## Couverture : matrice 6.4.1 appliquée

Les identifiants renvoient à l'[inventaire de référence](../rgpd/INVENTAIRE-DONNEES.md) et à la [matrice des droits](../rgpd/PREPARATION-DROITS.md). Les champs exacts et clés restent centralisés dans `export-sources.js` et l'inventaire ; aucun second schéma de stockage n'est créé.

| Sources | Lecture / propriété / couverture effective | Exclusions et limite |
| --- | --- | --- |
| A01, A05 | Auth `getUser` frais : `id,email,created_at,updated_at,email_confirmed_at,last_sign_in_at`, seulement si réellement présents et de type texte/null. `profiles` filtré par `id`, UUID/pseudo/dates. | Pas de métadonnées arbitraires, identités fournisseur, objets SDK complets, audits ni données internes non accessibles. Le manifeste Auth est toujours `limited`. |
| A02–A04, A06–A07 | Identité active utilisée comme autorisation et portée, sans exporter le stockage de session. | JWT, refresh/access tokens, PKCE, mots de passe/hash, preuves de liens, cookies, marqueur de continuité et communications Auth exclus. Jamais de dump `auth.*`. |
| D04–D06 | `drill_series`, `drill_answers`, `drill_training_attempts`, propres à l'UUID. Snapshots complets des champs connus, premières réponses et entraînements distincts. | Pas de correction ni de nouvelle tentative inventée ; les photos/contenus publics hors snapshot ne sont pas embarqués. |
| D01–D03 | Cache `mon-bprea-drill-personal-v1/accounts`, record de la portée active : projection, brouillons/trainingDrafts, opérations/payloads, `remote`, conflits/résolutions. | Source visiteur indépendante. Champs hors contrat exclus et comptés. Ni acquittement ni synchronisation déclenchés par l'export. |
| D07 | Sources Drill incluses ; formules Dashboard inchangées, aucun nouveau stockage. | Aucun historique statistique fabriqué ni statistiques supplémentaires dans le fichier. Calcul possible par le lecteur depuis les sources. |
| Q04–Q05 | `course_states` et `quiz_attempts` par UUID, y compris `done:false`, legacy/null, score zéro, tentatives différentes à score/date égaux. | Pas de choix individuels QCM classiques ni date ancienne reconstruite. |
| Q01–Q03 | Cache cours/QCM propre : états, tentatives, copies distantes, opérations/conflits, IDs de manifestes/provenance/correspondances. Sélection visiteur séparée. | `raw`, avertissements libres, archives mal formées et champs inconnus exclus. Les clés locales de provenance peuvent être sélectionnées dans la copie appareil, sans attribution au compte. |
| B04–B05 | `botanical_sessions`, `botanical_answers` : statuts, identités, dates/durées, `is_revision` pédagogique et `revision` SQL distincts. | Références d'espèce/photo seulement, pas de copie des photographies publiques. |
| B01–B03 | Cache botanique propre : sessions/réponses et intentions, dépendances, conflits, manifestes connus. Descripteurs `id,provenance` des archives de refus, sans contenu brut. Sauvegarde visiteur normalisée séparée. | Pas de session créée pour une réponse orpheline. Source future/illisible ou non attribuable signalée ; raw/refus ne sont jamais diffusés automatiquement. |
| I01–I03, P01–P05 | `itk_settings`, `appearance_preferences`, et cache partagé paramètres : valeurs, copies distantes, opérations, conflits, archives normalisées, preuves d'import connues. Choix `auto` conservés. | Huit paramètres ITK seulement ; pas de document complet, calendrier/CSV/PDF ou rendu horaire calculé. Bornes diagnostiques historiques P05 inchangées ; pas de données anciennes recréées. |
| X01 | Jour d'anecdote masquée sélectionnable dans la copie appareil. | Pas d'association à l'UUID. |
| X02–X09 | Pas d'autre stockage personnel ajouté ou lu par l'export. Catalogue de sources locales fermé : aucun balayage de localStorage. | Canaux, URL/historique OS, cache HTTP, logs fournisseurs, sauvegardes, fichiers déjà téléchargés, traces/outils et ressources publiques ne sont pas présentés comme exportés. |

Les caches ont une clé `JSON.stringify([environment, origineSupabase, UUIDAuth])`. La lecture refuse une portée interne différente et une version autre que 1 ; erreurs, blocage, corruption et volumes donnent un statut de couverture explicite, sans effacement ni réécriture. Aucune lecture des autres records `accounts` : pas de `getAll`, curseur de store ou recherche d'UUID.

### Archives et attribution

Une archive brute peut contenir des données d'un tiers ou des secrets inconnus. Le fichier du compte conserve les données métier normalisées attribuées au record, les intentions divergentes et la provenance connue, mais **pas** les textes `raw`, champs inconnus ou diagnostics libres. Les champs exclus sont comptés sans publier leur nom ou un extrait ; les manifestes et descripteurs gardent les identifiants non secrets connus. Si une projection sûre est impossible, la source entière est signalée et exclue.

Le parcours appareil ne permet pas davantage un dump brut : il restitue les champs connus des sources choisies, avec attribution `unverified`, avertissement et confirmation d'autorisation avant aperçu ou téléchargement. Les archives non attribuables restent dans leurs stockages, sans être nettoyées. Leur traitement complémentaire par une procédure de confiance reste à valider ; ce lot choisit de ne pas diffuser un fichier arbitraire potentiellement tiers même après une simple case d'interface.

## Pagination et cohérence temporelle

- Pages de **100**, poursuivies jusqu'à une page vide, même si le serveur renvoie moins de 100. Jamais d'offset ni de date pédagogique comme curseur.
- Drill : clé UUID `id` ou `operation_id`. Cours : `lesson_id`. Sessions botaniques : `session_id`. Profil et singletons : clé propriétaire.
- Tentatives QCM : `(created_at,attempt_id)` ; réponses botaniques : `(created_at,answer_id)`. Dates brutes avec microsecondes conservées et échappement des filtres ; pas de conversion en millisecondes pour construire les curseurs. L'ordre texte reste celui de PostgreSQL.
- Un identifiant répété, une ligne étrangère, une page non-tableau ou une colonne requise manquante invalide la lecture. Une erreur n'est jamais convertie en historique vide.
- Deux passes consécutives concordantes, sur les dix tables et les quatre compléments locaux, sont nécessaires. Une modification de révision, insertion tardive ou changement de cache impose une troisième passe ; si les deux dernières ne concordent pas, `unstable`, aucun fichier.

Il s'agit de convergence observée, **pas d'un snapshot transactionnel global**, ni d'une garantie d'absence de changement juste après la dernière lecture. Une transaction longtemps invisible ou une modification aller-retour peut échapper à cette observation. Le fichier et l'interface annoncent cette limite. L'export n'arrête pas les autres onglets et ne déclenche pas les services de synchronisation ; une activité de synchronisation déjà présente peut faire changer les données et conduire à recommencer.

Limites : **100 000 lignes par passe**, 1 001 pages au maximum par table (page vide comprise), **20 Mio** de données serveur par passe et de JSON final UTF-8. Chaque record local brut est aussi borné avant projection. Au-delà : erreur claire, aucun fichier tronqué. L'implémentation garde les passes et la sérialisation en mémoire, sans streaming ; le pic mémoire est supérieur à la taille du fichier, et un navigateur peu doté peut nécessiter une future procédure de confiance. L'annulation se vérifie à chaque attente ; timeout de 15 s par requête SQL, 5 s pour l'ouverture/lecture locale.

## Format JSON v1 et dictionnaire

| Champ | Sens |
| --- | --- |
| `exportFormatVersion` | `1`, contrat de fichier, distinct des versions de stockage. |
| `generatedAt`, `application` | Date UTC de construction réelle, nom Mon BPREA. Aucune date métier inventée. |
| `sourceScope` | `kind:account` avec environnement, origine Supabase, UUID ; ou `kind:device,ownership:unverified`, sans propriétaire supposé. |
| `status` | `complete_accessible` pour la sélection de sources effectivement incluse sans exclusion, ou `partial`. La copie compte est actuellement **toujours partielle au sens global**, car Auth interne/logs/backups ne sont pas accessibles. |
| `coverage` | Par source : statut, ID d'inventaire pour les tables/sources visiteur, comptage SQL ou nombre de champs exclus et raison fixe. `absent` local diffère de `unavailable/blocked/invalid/future/ownership/volume`. |
| `warnings`, `dictionary` | Limites de périmètre/cohérence et explications des champs, fournies dans le fichier. Pas d'erreur brute du fournisseur. |
| `data.identity` | Liste limitée d'informations Auth du compte, jamais session/secret. |
| `data.server` | Dix tableaux sous les noms SQL ; colonnes snake_case d'origine. |
| `data.personalLocal` | Sous-domaines `drill,courses,botanical,settings` du seul record autorisé ; formats métier camelCase conservés. Absents/exclus décrits dans `coverage`. |
| `data` du fichier appareil | Uniquement les domaines sélectionnés, sans partie serveur ni identité Auth. |

Les copies sont **des représentations liées**, pas des essais supplémentaires : même `series_id/question_id`, `operation_id`, `attempt_id`, `answer_id/questionId`, ou identifiants des manifestes. Le dictionnaire indique de ne pas additionner `remote`, projection et opération. Aucune statistique ni déduplication par score/date n'est effectuée. Les versions locales/distantes conflictuelles restent présentes séparément ; les archives ont leurs résolutions/états, sans union silencieuse.

## États, remise et demandes complémentaires

`idle → verifying → reading → validating → ready → validating → downloaded`. Annulation/identité perdue rendent immédiatement le résultat indisponible. Une page serveur en erreur donne `incomplete` et **aucun téléchargement partiel serveur** ; un nouvel essai recommence. Un cache inaccessible ou une exclusion de confidentialité peut laisser une copie serveur disponible, avec couverture partielle et bouton explicitement nommé « copie partielle ». Aucune copie ne se télécharge automatiquement à la fin de préparation ou sur erreur.

Le clic de téléchargement personnel refait une vérification Auth, sérialise/borne le JSON puis crée un Blob dans le navigateur ; nom neutre sans e-mail, UUID ou token. Rien n'est envoyé à Supabase, GitHub, SMTP ou autre service. L'URL objet est révoquée après remise (1 s), à l'invalidation et au départ de page ; le fichier préparé est retiré de la mémoire du service après remise/annulation. Un téléchargement déjà remis au navigateur ne peut pas être rappelé par une déconnexion ultérieure ; la personne protège sa copie, comme les exports ITK existants.

Pour les données internes Auth, journaux, backups, autres appareils, archives brutes et informations institutionnelles non accessibles, le responsable devra définir une procédure de confiance : identité proportionnée, analyse de droits/tiers, recherche auprès des prestataires, remise sécurisée et suivi/délais. Aucun nouveau contact, suivi juridique ou transfert direct de portabilité n'est annoncé comme opérationnel dans 6.4.2. Les spécifications de suppression et conservation restent au 6.4.3, sans mécanisme commencé ici.

## Vérification

[VALIDATION-LOT6-4-2](../validations/VALIDATION-LOT6-4-2.md) distingue unités/intégration, HTTP synthétique, téléchargements Chromium, RLS réel éphémère et limites de poste. Les scénarios de confidentialité exercent A/B/A, dernière page en échec, réponse tardive, annulation, identité refusée avant remise, quatre caches, archives et sources visiteur. Les suites antérieures et 350 assertions pgTAP restent conservées.
