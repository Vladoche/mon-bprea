# Sauvegarde technique Supabase Free — préparation 6.5.3.B

**28 octobre 2026. EN ATTENTE D'AUTORISATION A. Aucune sauvegarde DEV réalisée.** Cible exclusive : `wcckbyhrtroittbfophv`, Mon BPREA DEV, Free, eu-west-1, PostgreSQL 17.11.0.003, relus dans la [validation](../validations/VALIDATION-LOT6-5-3B.md). PROD est exclu de toute consultation, liaison CLI, copie et restauration. Il s'agit d'une mise à niveau du **schéma applicatif**, sans changement de version du moteur PostgreSQL.

L'exploitant réserve DEV aux données fictives. Cette déclaration ne rend pas ses comptes jetables, ne prouve pas le contenu actuellement présent et n'autorise aucune perte. Aucun enregistrement Auth, profil ou pédagogique n'a été lu pour préparer ce guide. La décision sur une perte acceptable appartient à l'exploitant, au point B du [runbook](RUNBOOK-MIGRATION-DEV-6-5-3B.md).

## Protection proposée et alternatives

La documentation [Backups](https://supabase.com/docs/guides/platform/backups), relue le 28/10, recommande les exports CLI aux projets Free. Elle ne donne pas à ce projet une restauration planifiée/PITR incluse. Aucun achat, nouveau projet, abonnement, domaine ou SMTP n'est prévu. Le besoin immédiat est une copie avant intervention, conservée localement et vérifiée dans la mesure réellement possible.

| Option soumise à décision | Ce qu'elle protège | Limite et condition |
| --- | --- | --- |
| **Proposition A : copie applicative bornée** | Structure public/bprea_private, quatre tables actuelles, versions installées, ACL et sources Git correspondantes | Auth exclu. Une reconstruction autonome des comptes n'est pas assurée. Leur conservation côté source reste requise ; perte non acceptée à ce jour. |
| Reconstruction synthétique depuis Git | Schéma des deux versions observées, puis nouveaux comptes fictifs dans une stack locale neuve | Ne récupère ni anciens comptes/UUID ni progression. Seulement si l'exploitant accepte explicitement ces pertes ; aucune recréation d'un compte effacé. |
| Complément Auth séparé | Éventuellement comptes/identités et dépendances nécessaires | Intérêt, version Auth, chiffrement, couverture, récupération et accord spécifiques à établir. Un dump Auth peut contenir empreintes de mots de passe, tokens et données d'identité. **Non retenu ni autorisé ici.** |

La proposition A est proportionnée à cette migration additive et au DEV fictif déclaré, sous réserve de décision. Elle **n'est pas une sauvegarde complète du projet Supabase**, ni une garantie de restauration. L'export JSON personnel 6.4.2 reste une copie partielle ; sa réimportation n'existe pas encore et n'est pas développée dans ce lot.

## Couverture de la proposition A

| Catégorie | Capture prévue après A seulement | Sensibilité / accès | Récupération et preuve à établir |
| --- | --- | --- | --- |
| A — structure | `db dump --schema public,bprea_private --keep-comments` ; sources Git au SHA retenu ; catalogues | Métadonnées techniques ; accès DB opérateur autorisé | Tables, types, defaults, contraintes, index, fonctions, policies et ACL à comparer. Le trigger attaché à auth.users n'est **pas** dans ce dump de schémas : sa définition est dans le catalogue et la migration profils. |
| B — pédagogie | `db dump --data-only --use-copy --schema public` | Historique Drill, UUID, réponses, snapshots et dates, même fictifs déclarés : fichier restreint | Les trois tables Drill présentes ; six tables personnelles actuellement absentes, donc aucune donnée à inventer. Restauration des relations/valeurs à tester, sans afficher de contenu. |
| C — profils | Même fichier de données public | UUID, pseudo et dates ; protection identique | profils conservés avec leurs UUID, sous réserve de racines Auth correspondantes ; jamais par rapprochement d'e-mail/pseudo. |
| D — Auth | **Exclu** : aucun dump auth, aucune extraction de comptes/identités/sessions | Très sensible ; aucun secret ne doit passer dans la conversation ou Git | Pas de récupération de mots de passe/identités/sessions démontrée. Si Auth est perdu, le jeu applicatif seul ne permet pas de promettre sa remise en service. |
| E — migrations | JSON **version/nom seulement** issu de la lecture officielle, sources SQL Git exactes | Historique technique, sans copie des colonnes statements ni created_by | Deux versions observées. Ce JSON documente le point de reprise ; il ne reconstruit pas le ledger SQL à lui seul. Aucun migration repair automatique. |
| F — hors base | Relevé manuel minimisé : référence/plan/région, URLs, schémas API, restrictions Auth et intégration ; secrets exclus | Réglages non secrets en espace privé ; secrets dans leur gestionnaire habituel | Clés/signatures JWT, accès opérateur, SMTP, Storage, Edge et réglages hébergés ne sont pas récupérés par le dump. État ancien à relire avant reprise. |
| G — résidus | Inventaire des seuls fichiers produits, tailles/empreintes, emplacements et échéance | Copie privée ; pas de capture ni artifact Actions | Pas de rappel des JSON déjà remis, caches absents, sauvegardes OS, journaux ou copies internes fournisseur. Pas de seconde copie hors site sans accord distinct. |

Les schémas gérés par Supabase, extensions, Vault et objets Storage sont hors du périmètre A. Aucun rôle personnalisé n'est nécessaire aux ACL applicatives observées : propriétaires postgres et rôles gérés déjà présents sur une stack Supabase compatible. Les ACL effectives sont relevées ; **pas de roles.sql global par précaution**. Si un rôle ou une dépendance supplémentaire apparaît, arrêter et réviser le périmètre avant copie.

## CLI 2.121.0 : exclusions réellement vérifiées

Version et aides `db`, `db dump`, `db push` exécutées localement. La [référence CLI](https://supabase.com/docs/reference/cli/introduction) décrit le principe ; les fichiers officiels [pg-dump.env.ts](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/pg-dump.env.ts), [pg-dump.scripts.ts](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/command-internal/pg-dump.scripts.ts) et [effets du dump](https://github.com/supabase/cli/blob/v2.121.0/apps/cli/src/commands/db/dump/SIDE_EFFECTS.md) précisent cette version :

- Le dump de **schéma sans sélection** exclut notamment auth, storage, supabase_migrations, extensions, graphql, realtime, Vault et schémas internes/extensions. Il ne contient pas les données ni les rôles.
- Le dump de **données sans sélection** a une autre liste : **Auth et Storage peuvent être inclus**. Les tables auth.schema_migrations, storage.migrations et supabase_functions.migrations sont exclues séparément. Ne jamais lancer un `--data-only` non borné en pensant éviter Auth.
- Une sélection `--schema` explicite remplace les listes générales d'exclusion ; nos sélections public,bprea_private et public sont donc obligatoires. L'historique supabase_migrations n'est pas protégé implicitement.
- Le dump des rôles utilise `--no-role-passwords`, filtre les rôles réservés et n'est pas une copie complète des habilitations du projet. Les ACL de table, colonne, fonction, schéma et les défauts doivent être vérifiés séparément.
- La CLI transforme certains DDL, omet les event triggers et certaines instructions gérées. Un fichier SQL produit n'est pas une preuve d'équivalence au projet source.
- **Interdire `db dump --dry-run` avec des accès réels** : il imprime le script avec PGPASSWORD résolu. `--file` peut tronquer un ancien fichier ; le dossier et chaque sortie doivent être neufs. Aucun `--debug`, `--create-ticket` ou transcription de terminal.

## Prérequis privés et arrêt A

L'exploitant a choisi une racine locale **hors du dépôt** dans la conversation. Le chemin nominatif n'est pas publié ici. Sous cette racine, proposer `mon-bprea-dev-avant-migration-AAAAMMJJTHHMMSSZ`, sans écrasement ni réutilisation d'un dossier. Le choix de racine n'est pas une autorisation de sauvegarde.

La racine inspectée est un dossier ordinaire, sans lien de réanalyse observé ; ses permissions héritées incluent une lecture pour le groupe de sandbox. **Elle n'est pas validée comme dossier privé.** Prévoir un sous-dossier neuf à héritage retiré et accès limité à l'exploitant, SYSTEM et administrateurs locaux habilités, après accord. Ne modifier ni la racine ni des dossiers existants. Vérifier les ACL finales avant toute donnée.

Le chiffrement n'est pas établi : la lecture BitLocker a échoué faute d'accès CIM ; son message secondaire ne prouve pas l'absence de chiffrement. L'absence de synchronisation cloud n'est pas établie par le seul chemin. L'exploitant doit confirmer ces deux points. Si le volume n'est pas protégé, choisir d'abord un volume/conteneur chiffré existant ou une archive chiffrée avec outil officiel vérifié, secret saisi localement et clé conservée séparément. Aucun mot de passe de chiffrement inventé, aucun dump en clair provisoire dans le dépôt.

**Docker, psql et pg_dump ne sont pas disponibles sur le poste de préparation.** La CLI existe via npm ; aucun backend de dump/restauration n'a été validé. Ne pas installer/configurer automatiquement Docker, contourner par le cloud, exporter par le connecteur vers le modèle ou utiliser la CI. Préparer un ordinateur contrôlé disposant de Docker et PostgreSQL/psql 17 compatibles ; vérifier les outils et le réseau direct/Session pooler dans le panneau Connect du seul DEV. Ne pas réinitialiser le mot de passe DB pour faciliter la copie. La méthode officielle de [backup/restauration CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) doit être adaptée à ces limites.

Présenter A avec source, catégories A–G, fichiers, chemin privé exact, protections, exclusions Auth, restauration limitée, échéance et commandes ci-dessous. Demander explicitement la copie de ces seules données ; consigner date/portée/conditions en privé et seulement le statut minimisé dans Git. Sans accord, aucun dump, même de schéma. La seconde autorisation B reste indépendante.

## Commandes préparées, non exécutées

Ces commandes sont destinées au **terminal privé de l'exploitant après A**, depuis le checkout au SHA relu, avec les outils préalablement disponibles. Aucune valeur sensible n'est un argument. Vérifier qu'aucun SUPABASE_YES, profil, fichier .env ou réglage local ne change le ciblage/les confirmations. L'argument `--project-ref` a priorité sur un lien mémorisé ; ne pas utiliser `--db-url`, `--local` ou une cible implicite. Si la résolution réclame un rôle temporaire ou une modification fournisseur inattendue, arrêter ; la copie ne doit pas servir à autoriser une autre intervention.

```powershell
# $BackupRoot : chemin absolu choisi et confirmé PRIVÉ par l'exploitant.
# Ni le renseigner ici, ni imprimer son contenu ou les identifiants.
$BackupDir = Join-Path $BackupRoot ('mon-bprea-dev-avant-migration-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ'))
if (Test-Path -LiteralPath $BackupDir) { throw 'Sortie déjà présente : arrêt.' }
New-Item -ItemType Directory -Path $BackupDir -ErrorAction Stop | Out-Null
$BackupOperator = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $BackupDir /inheritance:r /grant:r "${BackupOperator}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F'
if ($LASTEXITCODE -ne 0) { throw 'Protection du dossier non confirmée.' }
Get-Acl -LiteralPath $BackupDir  # contrôle privé, avant toute copie
```

Une racine parente d'un dépôt reste distincte de ce dépôt : vérifier les chemins résolus, les jonctions et l'absence d'un dépôt Git parent englobant la sortie. Si un autre outil/synchroniseur peut la collecter, arrêter. Le chiffrement doit déjà être actif au moment de la première écriture ; appliquer seulement une ACL ne chiffre pas.

Authentification officielle déjà approuvée côté opérateur ; ne jamais afficher/coller access token ou clé administrative. La présence de SUPABASE_DB_PASSWORD évite le chemin de création d'un login temporaire décrit dans le résolveur CLI ; toute demande supplémentaire impose un arrêt. Le secret n'est ni un fichier suivi ni un argument :

```powershell
if (Test-Path Env:SUPABASE_DB_PASSWORD) { throw 'Utiliser une session privée dédiée sans variable préexistante.' }
$BackupDbSecure = Read-Host 'Mot de passe DB DEV (saisie locale masquée)' -AsSecureString
$BackupDbPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($BackupDbSecure)
try {
  $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BackupDbPointer)
  npx --yes supabase@2.121.0 db dump --linked --project-ref wcckbyhrtroittbfophv --schema 'public,bprea_private' --keep-comments --file (Join-Path $BackupDir 'application-schema.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Dump structure échoué : arrêt, aucun retry automatique.' }
  npx --yes supabase@2.121.0 db dump --linked --project-ref wcckbyhrtroittbfophv --data-only --use-copy --schema public --file (Join-Path $BackupDir 'application-data.sql')
  if ($LASTEXITCODE -ne 0) { throw 'Dump données échoué : arrêt, copie non validée.' }
} finally {
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BackupDbPointer)
  $BackupDbSecure.Dispose()
}
```

Le `--yes` placé **avant le paquet npm** concerne l'installation npx, pas l'acceptation des confirmations Supabase. Aucun secret n'est imprimé par ces instructions ; l'environnement du processus demeure une surface sensible à protéger contre d'autres processus privilégiés. Vérifier chaque chemin absent avant appel et ne pas relancer dans la même sortie. Les deux dumps sont des transactions distinctes : fixer une fenêtre sans activité d'essai/migration et relire les métadonnées avant/après. Pas de snapshot global commun garanti.

Ajouter au dossier privé, par export contrôlé des lectures de métadonnées déjà autorisées : `catalogue.json`, `privileges.json`, `versions-migrations.json` (version/nom seuls), un relevé de configuration sans secret, `restauration.md` et `manifest.json`. Archiver les seules sources versionnées nécessaires au SHA Git retenu (migrations, config.toml et templates locaux), sans .env ni cache CLI. Aucun dump d'historique complet ou de rôles ajouté automatiquement. Le chemin réel, les SHA-256 des copies et les détails de fichiers restent privés.

## Manifeste et trois niveaux de vérification

Le manifeste privé porte : UTC début/fin, référence DEV, SHA Git, version CLI/pg_dump/psql/PostgreSQL, commandes sans secret, options/schémas, fichiers attendus, tailles et SHA-256, codes de sortie, fenêtre sans activité, comparaison de catalogues, niveau atteint, résultats/erreurs minimisés, exclusions et échéance décidée. Initialiser `statut: non_verifie`, jamais `complete` par défaut. Ne pas enregistrer de connection string, e-mail, UUID de compte, contenu Auth ou pédagogique dans les logs du contrôle. Tailles/empreintes calculées vers le manifeste, pas vers un artifact public.

| Niveau | Contrôle obligatoire | Ce que le succès permet de dire |
| --- | --- | --- |
| 1 — intégrité | Sorties neuves présentes, non nulles ; sortie CLI zéro ; SQL attendu ; pas de diagnostic à la place d'un dump ; fin de chaque COPY `\\.` et fin du script `RESET ALL;` pour les données ; fin pg_dump complète pour la structure gardant ses commentaires ; empreintes et tailles établies | Fichiers présents et intègres à l'instant contrôlé, pas restaurabilité. Une table vide peut ne pas produire de ligne métier. |
| 2 — couverture | Quatre tables public, fonctions public/bprea_private, PK/FK/CHECK/index/RLS/ACL, profils/Drill et versions recensés ; absence d'Auth/Storage/Vault ; trigger Auth et rôles gérés identifiés comme dépendances ; comparer à l'inventaire daté, pas seulement compter | Copie applicative bornée documentée ; dépendances/exclusions connues. Aucun contrôle de données nominatives par le modèle. |
| 3 — restauration isolée | Exercice ci-dessous sur machine privée, erreurs SQL bloquantes, contrôle des FK et privilèges effectifs après import, vérification de données minimisée en privé | Seulement le périmètre réellement restauré. Ne prouve ni un projet Supabase complet ni le fonctionnement Auth hébergé. |

Ne jamais se contenter d'un grep de fin ou d'un code zéro : un SQL incomplet peut contenir une fin trompeuse. Une absence de table attendue bloque la couverture ; une table réellement vide ne justifie pas l'invention de données. Toute donnée réelle inattendue impose l'arrêt et un nouveau périmètre.

## Exercice de récupération isolée à préparer

1. Utiliser exclusivement la stack **mon-bprea-lot6-1-local**, PostgreSQL 17, dans un répertoire neuf privé, avec Docker disponible. Confirmer qu'aucune stack/donnée antérieure n'est réutilisée ; pas de reset ou de suppression d'un ancien volume. Aucun accès de navigateur étudiant, service SMTP externe, runner hébergé ou clé DEV dans la cible.
2. Commencer par une répétition **synthétique** : configuration/templates locaux copiés, uniquement les deux migrations observées dans une copie de travail isolée ; garder les trois fichiers versionnés du dépôt intacts. La commande officielle `npx --yes supabase@2.121.0 start --workdir <repertoire-local-controle>` doit être relue avec son aide avant usage. Elle doit amorcer Auth et le schéma des deux versions, jamais sélectionner un projet lié. Charger seulement des fixtures synthétiques locales.
3. Produire les deux dumps locaux correspondants puis restaurer dans une **autre instance neuve créée successivement**, après arrêt contrôlé de la précédente et conservation des preuves synthétiques nécessaires. Ne pas réutiliser les runners destructifs pour une copie issue de DEV. Ne pas arrêter/supprimer une stack ou un volume non créé par cet exercice.
4. Pour une copie DEV autorisée, refaire un essai distinct **privé**, avec les mêmes versions et un périmètre de restauration convenu à A. Les migrations observées reconstruisent la structure, les rôles gérés, les REVOKE/GRANT et le trigger Auth omis par le dump applicatif. Le SQL de structure sauvegardé sert à comparer ; ne pas le superposer aveuglément à des tables existantes.
5. Les données public ont besoin des **mêmes UUID Auth**. S'ils ne sont pas disponibles dans la cible isolée, s'arrêter : ni invitation recréant un UUID différent, ni fabrication d'identités humaines. Des racines Auth **strictement synthétiques locales** de mêmes UUID peuvent servir à un exercice applicatif privé explicitement borné ; elles ne démontrent aucune restauration de compte, identité ou mot de passe. Sinon, niveau 3 non atteint. Aucun SQL Auth artisanal sur un projet hébergé.
6. Avec la structure et les racines validées, importer seulement dans l'instance locale neuve, via psql 17, `--no-psqlrc --host=127.0.0.1 --port=54322 --username=postgres --dbname=postgres --no-password --single-transaction --set=ON_ERROR_STOP=1 --file=<chemin-prive/application-data.sql>`. Mot de passe local via mécanisme privé, sans URL d'identifiants. Le dump contient `SET session_replication_role = replica`, qui désactive les triggers **et les contrôles FK par trigger** pendant l'import ; ce privilège et cet effet ne sont admissibles que sur cette cible isolée. Aucun contournement à appliquer sur DEV.
7. Avant de déclarer une réussite, rétablir/vérifier le mode normal, contrôler les relations orphelines par jointures minimisées et toutes les contraintes : le fait qu'une FK soit marquée validée ne revérifie pas des lignes importées sous replica. Comparer types, defaults, contraintes, index, triggers, corps/signatures et ACL effectives. Des ACL peuvent être élargies par les **défauts de la cible** lors d'un restore de schéma : reconstruire avec les migrations et leurs REVOKE, puis vérifier chaque droit ; jamais copier un GRANT global de documentation.
8. Comparer nombres et intégrité des seules catégories autorisées, sans les publier. Pour ces deux dumps séparés, une preuve de snapshot commun n'est pas disponible. L'historique doit refléter les deux versions effectivement reconstruites ; son JSON ne se restaure pas par réparation forcée. Documenter toute limite Auth/configuration/extensions/version. Ne pas appliquer la troisième migration dans cet exercice de retour au point antérieur.

La méthode psql ci-dessus est **préparée, non exécutée** ; les commandes d'amorçage/arrêt devront être arrêtées avec l'opérateur et les aides effectives lorsque Docker sera disponible. Une restauration complète Auth n'est pas démontrée. La possession d'un dump n'autorise jamais sa restauration sur DEV/PROD.

## Conservation, incident et reprise

Proposition technique pour **cette copie avant intervention** : sept jours au maximum après sa création, avec revue anticipée après vérification de la migration et clôture du besoin de reprise. **À approuver D07/D08/D13**, sans modifier le JSON de conservation, ses durées nulles ou l'interdiction de purge automatique. En cas d'incident, prolongation motivée avec nouvelle échéance explicite ; aucune conservation indéfinie ni suppression d'une ancienne copie sans décision. Le retrait d'un fichier ne garantit pas l'effacement physique d'un SSD, des snapshots OS ou d'une synchronisation cloud.

Une cadence future peut se limiter à une copie avant toute intervention SQL et à une revue manuelle hebdomadaire pendant l'usage actif, avec rotation et essai périodique à décider. **Aucune automatisation n'est créée.** Ni copie secondaire ni dépôt de dump dans GitHub Actions, Drive, API de diagnostic ou conversation.

Avant toute remise en service d'une restauration : isoler, suspendre accès/synchronisation selon une méthode autorisée, réconcilier les décisions d'effacement postérieures et les réappliquer, contrôler Auth et tables applicatives, puis obtenir l'accord de reprise. Ne jamais ressusciter un compte effacé ou écraser des écritures plus récentes avec une copie ancienne. Source minimale de réconciliation, habilitations et durée du suivi restent D07/D08/D13 ; aucun registre nominatif perpétuel ajouté. La [politique de conservation](../rgpd/POLITIQUE-CONSERVATION-PROJET.md) et les quinze P0 restent non validés.

## Risques à soumettre à l'exploitant avant B

Auth non sauvegardé ; dépendances UUID non autonomes ; restauration locale non exécutée faute d'outils ; deux snapshots indépendants ; copies internes fournisseur inconnues ; chiffrement/synchronisation et ACL privées non encore validés ; risque de perte des fixtures **non accepté**. Choisir explicitement : attendre un essai privé concluant, revoir la couverture pour inclure Auth sous nouveau périmètre, ou accepter une protection applicative limitée et une perte précisément bornée des seules fixtures. Aucune de ces décisions n'est prise par ce guide. Sans décision, migration interdite.
