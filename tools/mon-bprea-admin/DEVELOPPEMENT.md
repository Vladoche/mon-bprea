# Admin V2 — architecture, sécurité et qualification

Le [guide utilisateur](README.md) porte les manipulations courantes. Ce document porte les mécanismes internes, leurs limites et les prérequis de toute activation future. La [validation datée](../../docs/validations/VALIDATION-ADMIN-V2.md) distingue les contrôles exécutés des capacités non qualifiées.

## Distribution et cibles

WinForms / .NET 10 LTS, SDK 10.0.404 épinglé dans `global.json`, sans dépendance applicative NuGet supplémentaire. `publish.ps1` teste puis produit un exécutable autonome x64, sans trimming, le guide, leur empreinte et un ZIP à trois fichiers. L’exécutable est non signé. Le workflow `admin-windows` distribue ces fichiers, sans déploiement Pages ni secret hébergé.

La cible normale est immuable : `oqoqrxwfbkhtpksqimgd`, son API HTTPS et le callback public existant. Aucun réglage utilisateur ne choisit une URL, un projet, un proxy ou un certificat. Le transport refuse les redirections, impose une réponse bornée et refuse les propriétés JSON répétées et les inventaires paginés/ambigus. Les réglages Auth sont relus avant une mutation : inscription et anonymat fermés, fournisseur e-mail avec confirmation.

Pour tester **le même exécutable**, l’argument développeur `--qualification-locale=UUID` sélectionne exclusivement `127.0.0.1:54321`, le callback `127.0.0.1:4173/mon-bprea/authentification.html` et le collecteur `127.0.0.1:54329`. Il utilise un autre coffre et un autre dossier, identifiés par cet UUID, avec un bandeau permanent « QUALIFICATION LOCALE · COMPTES FICTIFS ». L’argument ne peut recevoir aucune autre cible. `--qualification-theme=dark`, uniquement avec ce mode local, sert à la revue sombre sans modifier Windows. Ce mode ne fournit aucun adaptateur de suppression PROD.

Les couches sont `SimpleMainForm`/`SimpleBootstrap` (interface et ouverture), `SimpleAdminSession` (contrats et API), `AutomaticPrivateStore`/`AdminCredentialVault` (protections Windows). Les anciennes interfaces à attestations ont été retirées ; les services historiques et leurs tests restent pour la compatibilité des journaux. Le frontend public, les migrations, les grants et les politiques RLS ne sont pas modifiés par V2. `assets/auth-config.json` reste désactivé.

## Configuration et coffre Windows

Une clé saisie est vérifiée contre les endpoints administratifs du seul projet fixe, puis écrite dans une entrée générique du Gestionnaire d’identifiants Windows. Sa relecture est comparée avant de quitter la configuration. La persistance Windows est liée au SID courant, au PC et au projet ; le namespace historique PROD est conservé. Une clé existante est relue automatiquement au démarrage, sans la remettre dans un champ. Sa validité réseau est contrôlée lors des opérations. Un refus 401/403 demande son remplacement ; une panne réseau ne la supprime pas.

Aucun fichier de clé, argument secret, mot de passe maître ou export de clé n’est proposé. Les chaînes .NET ne permettent pas de garantir l’effacement physique immédiat de toutes les copies en mémoire. Un autre programme exécuté sous le même compte Windows peut accéder au coffre : la protection n’est pas un isolement contre ce compte compromis.

Le stockage normal est découvert à partir du pointeur Windows, de `SUPABASE_PROD_PRIVATE_DIR`, du dossier standard et des dossiers de l’exécuteur historique reconnus dans le profil. Le contenu, les ACL, les états et les dates valident chaque candidat avant son raccordement. Plusieurs emplacements, un pointeur périmé ou un historique manquant interdisent la création. Le parcours de diagnostic laisse l’exploitant rebrancher un support et refaire les contrôles.

Sur un candidat unique, l’ouverture prend le verrou historique et relit les enregistrements V1 et V1.1 ainsi que les reçus et payloads V2. Les contenus EFS et DPAPI existants sont vérifiés sous le profil courant. Le format Node V1 préexistait à l’exigence EFS pour les liens et protège ses fichiers par ACL. Le logiciel conserve ses octets et ses dates. L’ancrage DPAPI mémorise les empreintes d’origine et le pointeur Windows réutilise le dossier en place. Le verrou d’inspection seul est libéré par Windows en cas d’interruption. Une intention d’opération durable et son verrou conservent leurs règles de reprise.

Une nouvelle installation crée ses propres répertoires et ACL, propriétaire SID courant, accès SID courant et SYSTEM uniquement. Les chemins réseau, cloud connus, dépôts Git, volumes non NTFS, liens/jonctions, fichiers à liens multiples et permissions trop larges sont refusés. Les protections des fichiers existants sont vérifiées ; elles ne sont pas réécrites arbitrairement.

Les nouveaux liens et résultats sensibles sont chiffrés par **DPAPI CurrentUser**, avec entropie liée au projet et au namespace de qualification. Le logiciel réalise un véritable aller-retour de chiffrement/déchiffrement avant utilisation. Le journal minimal ne contient ni e-mail en clair ni lien. DPAPI remplace le besoin d’un nouveau certificat EFS et d’un PFX à gérer pour ces fichiers ; les anciennes données EFS et leurs moyens de récupération restent inchangés. La perte du profil Windows peut rendre les liens irrécupérables ; les réservations doivent rester conservées. Aucun redémarrage physique du poste ou scénario complet de restauration du profil Windows n’est déduit d’un test DPAPI.

## Verrous et journaux partagés

`operation.lock` est créé exclusivement et partagé avec l’exécuteur Node. Un verrou interrompu n’est jamais retiré automatiquement. La réservation est écrite avec ACL privées et flush disque **avant** l’appel créateur ou destructif. Un seul appel est tenté ; aucune erreur réseau ne déclenche de retry. Une intention sans résultat fiable bloque les nouvelles mutations, y compris après redémarrage.

Les fichiers `admin-v2-UUID-reserved.json`, `…-step-email-modified.json`, `…-payload.bin` et `…-complete.json` sont ajoutés sans réécrire les réservations V1/V1.1. L’enveloppe porte la version 4 et le projet. Les reçus sont liés à l’empreinte du payload chiffré ; les événements orphelins, divergents ou incomplets sont bloquants. Les nouveaux outils Node lisent ce format avant toute mutation ; les anciens binaires/scripts ne doivent plus être utilisés en parallèle. Le plafond de sept comptes est vérifié sous ce verrou, invitations comprises ; cela reste une règle administrative à un poste, pas un quota serveur contre un autre administrateur.

Un résultat de génération réussi signifie seulement « lien créé et disponible privativement ». Il ne prouve ni copie, ni transmission, ni activation. Aucun acquittement de remise obligatoire ni attestation de consentement n’est fabriqué. Le presse-papiers est modifié seulement par **Copier le lien**. Les payloads sont authentifiés et déchiffrés pour retrouver un lien ; l’UUID Auth est vérifié avant sa réutilisation. Un nouveau lien de récupération demande une action explicite distincte après un résultat connu ; une incertitude n’est jamais contournée de cette manière.

Pour une suppression, `deletions.json` reçoit avant l’appel une intention immuable : projet/source, UUID exact, empreinte cible, référence de sauvegarde, périmètre, état `pending/uncertain`, résidus et prochaine revue. Les résultats restent séparés. Une ancienne preuve de restauration ne correspond plus à l’empreinte du journal courant. Les copies conservées doivent être restaurées en isolement puis réconciliées avec **le journal courant**, jamais avec celui de leur snapshot. Toute intention de suppression continue à bloquer l’administration tant que le suivi des résidus n’est pas qualifié.

## Invitations et récupération

### Préflight de création et sauvegardes

Le circuit PROD relit les réglages Auth et l’inventaire complet sous le verrou avant tout appel de création. Le compte exploitant est rapproché de l’invitation V1 reçue et des UUID PostgreSQL. La création exige une preuve liée à une archive conforme, à la version des migrations et au journal courant. Une expiration exacte à 168 heures, une divergence de schéma ou de privilèges et un inventaire incohérent bloquent avant la réservation. La qualification locale conserve ses propres gardes et son coffre distinct.

L’assistant rattache le contexte opérateur déjà configuré après contrôle du stockage EFS, du journal courant et de la dernière génération vérifiée. Le coffre Windows réutilise ses primitives pour un accès PostgreSQL séparé. Le point de connexion qualifié est celui du projet fixe en TLS `verify-full` et session en lecture seule. L’extraction complète exige la lecture de toutes les lignes des dix tables, les catalogues et les identifiants nécessaires au contrôle des dépendances. Le chemin qualifié utilise l’accès `postgres` existant, avec ces sessions limitées aux lectures. Aucun nouveau grant, compte SQL ou changement hébergé n’est réalisé.

Les outils locaux compatibles sont recherchés en premier. L’application peut préparer PostgreSQL 17.12 depuis l’archive EDB épinglée par SHA-256 dans le profil Windows, sans service ni changement du PATH système. [Source et somme publiée](https://github.com/EnterpriseDB/edb-installers/issues/800).

Le renouvellement reprend le `pg_dump` natif de `public` et `bprea_private`, le manifeste v1, le TOC et les requêtes de catalogue et privilèges du dépôt. Un cluster neuf en boucle locale et authentifié par SCRAM restaure chaque section de cette archive. Des racines UUID minimales et fictives du point de vue d’Auth servent aux FK. Les empreintes SQL des lignes, le catalogue et les droits sont comparés. Le reçu `restore-evidence.json` devient visible après comparaison, relecture du journal, arrêt du cluster et vérification des checksums. Le répertoire privé conserve les comparaisons, l’intervalle RPO dépassé et la date de revue. L’indisponibilité d’une preuve, un journal d’effacements nécessitant réconciliation et tout changement de la référence hébergée demandent un diagnostic avant reprise.

L’exécution à l’ouverture et le contrôle toutes les trente minutes pendant l’utilisation évitent un service Windows permanent. Alerte à partir de 132 heures, tentative à partir de 144 heures, rattrapage au prochain lancement si le poste était arrêté. Les générations restent soumises à la revue et à la durée de conservation du [guide d’exploitation](../../docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#sauvegarde-hebdomadaire-et-rpo). Le programme préserve les archives historiques et la dernière génération valide. La restauration qualifie les deux schémas applicatifs. Auth, sessions, Storage, Vault, secrets, réglages, journaux fournisseur, données non synchronisées et RTO restent hors portée.

Les liens utilisent l’API officielle `generate_link` (`invite`/`recovery`), puis sont reconstruits pour le callback strict existant après contrôle du destinataire, du type, de l’origine, du token et de l’UUID attendu. Le compte, les autres identités et l’inventaire sont relus. Aucune création/recréation n’est utilisée pour récupérer un compte.

L’API publique `/auth/v1/settings` ne publie pas la durée OTP. En PROD, la seule clé Auth ne permet donc pas de prouver cette durée : l’interface l’annonce comme inconnue, sans inventer une heure. Le collecteur local la lit réellement dans la configuration du conteneur Auth local. Une future vérification PROD exigerait un canal de configuration qualifié et autorisé séparément.

Le changement d’adresse utilise l’API officielle de mise à jour administrative du **même UUID**, avec les seuls champs `email` et `email_confirm`. Le programme ne modifie ni rôle, ni métadonnées ni mot de passe par cet appel. La confirmation est **administrative**, après une décision réelle de l’exploitant sur un canal déjà connu, liée à l’UUID et à la nouvelle adresse pendant moins de cinq minutes. L’application ne prouve pas automatiquement l’identité du demandeur ou la maîtrise d’une boîte : connaître une ancienne adresse n’est pas une justification suffisante. Elle explique que ce choix ne dépend pas d’une confirmation de l’ancienne boîte inaccessible. Il ne s’agit pas d’une attestation juridique de consentement.

Pour adresse et mot de passe, l’adresse est modifiée et relue avant de générer un lien destiné uniquement à la nouvelle adresse. Le changement intermédiaire est journalisé. Un échec de la seconde étape est affiché comme **partiel**, une réponse perdue comme **incertaine**. Le titulaire choisit toujours lui-même son mot de passe. Une génération ne signifie jamais que ce choix est déjà terminé. Les effets sur les sessions ne sont pas extrapolés : un JWT existant peut rester utilisable jusqu’à expiration.

Sources officielles vérifiées : [generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [implémentation Auth administrative](https://github.com/supabase/auth/blob/master/internal/api/admin.go), [réglages publics Auth](https://github.com/supabase/auth/blob/master/internal/api/settings.go), [dark mode .NET 10](https://learn.microsoft.com/en-us/dotnet/desktop/winforms/whats-new/net100). Les versions réellement testées restent celles de la validation datée.

## Suppression : capacité locale et blocage PROD

La distribution refuse la suppression PROD **avant tout DELETE**. Aucun fichier importé, attestation, paramètre ou thème ne peut activer un adaptateur hébergé inexistant. La seule clé Auth ne prouve ni les dépendances PostgreSQL et permissions, ni Storage, ni la restauration des sauvegardes, ni l’identité immuable de l’exploitant. Aucune modification de privilège PROD n’est réalisée.

Le collecteur de qualification, exclu du ZIP, est limité au conteneur nommé `supabase_db_mon-bprea-admin-v2-local` (ou `supabase_db_mon-bprea-admin-v2-final-local` avec `--final-campaign`) sur Docker local vérifié. Il fournit l’UUID exploitant fictif, les dix comptages, onze signatures FK exactes et validées, RLS et permissions, orphelins, propriétaires Storage et nombres de sessions/refresh. Le programme refuse une cible protégée ou une preuve manquante/divergente. Ce banc dispose des privilèges du conteneur fictif ; **il ne qualifie pas un accès PostgreSQL de production**.

Le collecteur produit automatiquement un vrai `pg_dump` applicatif, le restaure dans une autre base locale avec une structure Auth minimale, compare les données synthétiques, schéma et privilèges, puis lie la preuve au journal courant. L’application réserve l’intention et appelle une seule fois le DELETE Auth natif. Elle relit Auth, les dix tables, sessions/refresh, Storage et le témoin B. La restauration ancienne est refusée après modification du journal, puis la réconciliation retire A dans la base restaurée en préservant B. Le dump brut reste une copie résiduelle identifiée ; la réponse n’annonce pas un effacement universel des appareils, exports ou sauvegardes.

### Architecture PROD proposée, non activée

1. Déployer, seulement après autorisation spécifique, un service administratif privé distinct du frontend. Il vérifie la clé administrative du projet fixe, l’identité opérateur autorisée et l’UUID exploitant enregistré indépendamment. Aucun endpoint SQL libre ni sélecteur de projet.
2. Provisionner côté serveur une identité PostgreSQL de diagnostic **sans superuser, BYPASSRLS, écriture, DDL, création de rôle ou héritage administratif**. Limiter `SELECT` aux colonnes propriétaires/identifiants des dix tables, Storage, sessions et refresh nécessaires, et aux projections de catalogues utiles. Des politiques RLS dédiées à ce seul rôle doivent autoriser ces lectures ; ne pas réaccorder les contenus à `service_role`, ni confondre zéro ligne cachée par RLS avec une preuve d’absence. Le secret de cette identité reste côté serveur, jamais demandé à l’utilisateur ou placé dans Pages.
3. Relier un coordinateur durable au coffre de sauvegardes/restaurations et au journal courant. Une capacité doit être fraîche, bornée au projet, UUID, schéma, inventaire, sauvegarde et empreinte du journal. Introduire un verrou serveur si plusieurs postes/circuits peuvent administrer ; aucune garantie distribuée n’est déduite du verrou Windows.
4. Préparer l’intention avant le seul DELETE Auth ; gérer la réponse perdue par inspection, sans répétition. Exiger les mêmes postcontrôles et la préservation des témoins. Conserver les barrières JWT, copies et réconciliation avant toute restauration. Une réponse partielle ne devient pas un succès global.
5. Tester ce service et ses privilèges sur une cible réaliste isolée, avec A/B, erreurs et interruptions ; faire examiner puis autoriser explicitement son provisionnement et sa qualification PROD. Une recette locale ne l’active pas.

Cette proposition est précise mais **n’est pas un composant PROD livré ou autorisé**. Les champs supplémentaires éventuellement nécessaires doivent être provisionnés par le développeur au déploiement du service, pas transformés en formulaires techniques dans l’application.

## Reproduire les vérifications de développement

Depuis la racine, Node 24, `npm ci`, Windows et le SDK épinglé :

```powershell
./tools/mon-bprea-admin/publish.ps1 -DotnetPath CHEMIN_DOTNET -OutputDirectory DOSSIER_NEUF
```

Le script exécute les vecteurs Node, les tests C#/DPAPI/coffre et les tests WinForms avant de compiler. Le smoke test ouvre un namespace de qualification aléatoire sans clé : aucune lecture du coffre PROD ni requête hébergée.

Pour la recette intégrale, une CLI Supabase locale et Docker Desktop sont nécessaires **au développeur uniquement**. Le script suivant prépare un projet neuf, copie uniquement configuration/templates/fonctions/migrations et compile son garde Docker ; les ports sont liés à `127.0.0.1`. Il refuse les ports occupés et la réinitialisation d’une campagne existante :

```powershell
./tools/mon-bprea-admin/qualification/start-local.ps1 -CliPath CHEMIN_CLI
node tools/mon-bprea-admin/qualification/server.mjs
```

Pour une seconde campagne finale distincte, arrêter d’abord la première stack
avec conservation de ses volumes, puis utiliser `start-local.ps1 -FinalCampaign`,
`server.mjs --final-campaign` et `browser.mjs activate --final-campaign` ou
`browser.mjs combined --final-campaign`. Ce choix utilise le projet
`mon-bprea-admin-v2-final-local` et le dossier
`.tmp/mon-bprea-admin-v2/final-qualification/`, en conservant la première campagne.
Les mêmes ports locaux imposent de ne pas lancer les deux stacks en parallèle.

Le collecteur crée seulement les fixtures exploitant/B, prépare le site local et conserve l’identifiant et les seules clés locales dans `.tmp/mon-bprea-admin-v2/private/`. Lancer le **binaire distribué** avec `--qualification-locale=UUID_DE_CETTE_CAMPAGNE`, saisir la clé locale une fois puis utiliser ses vrais boutons. `browser.mjs activate`, `password`, `email` ou `combined` ouvrent des navigateurs participants jetables ; les liens doivent avoir été copiés volontairement depuis l’application. Aucun profil de navigateur personnel n’est utilisé. Les baselines synthétiques conservées permettent `server.mjs --resume` avant une suppression ; un snapshot antérieur non repris est bloquant, jamais remplacé pour rejouer.

Les secrets hébergés et sauvegardes historiques ne sont pas des fixtures. Arrêter les seuls processus créés, puis la stack avec conservation des volumes. Exécuter `npm run delivery:complete` après les contrôles et conserver les preuves utiles. Les tests de RLS applicatifs gardent leur suite locale dédiée/CI ; un transport simulé ou un rôle administratif ne les remplace pas.
