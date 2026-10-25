# Données personnelles — architecture et contrat backend du lot 6.3.1

Ce lot prépare exclusivement le modèle PostgreSQL, sa sécurité et les contrats des futurs clients. Aucun adaptateur de synchronisation cours/QCM, botanique, ITK ou apparence n'est ajouté au site. Les clés locales, les calculs pédagogiques et le défaut Auth public désactivé restent inchangés. DEV et PROD ne sont pas des cibles de test ou de migration de ce lot.

## 1. Audit préalable : faits observés dans le dépôt

L'audit porte sur les lecteurs, les écritures et les calculs effectivement utilisés, et pas seulement sur le nom des clés. Les structures ci-dessous décrivent les données locales existantes. Les sections de conception distinguent ensuite les décisions du nouveau backend ; une contrainte distante plus stricte n'est pas présentée comme un invariant déjà garanti dans localStorage.

### Inventaire fonctionnel

| Domaine | Source et version | Structure et identifiants disponibles | Création et modification observées | Suppression ou annulation observée | Intégrité, historique à préserver et concurrence |
| --- | --- | --- | --- | --- | --- |
| Cours | localStorage `bprea-demo-progress-v1` ; aucun champ de version dans le document | Objet indexé par `lesson.id` ; `done`, `score`, `quizAttempts`, `legacyQuizScore`, archives et propriétés inconnues | Case du cours : relire le document, remplacer `done`, conserver les autres champs. QCM parfait : poser `done` à vrai | Décocher écrit explicitement `done:false` ; aucune suppression de l'entrée ou de son historique | `done` n'a pas de date de modification locale. Le lecteur affiche la vérité logique de la valeur. Réécriture globale après relecture, sans transaction inter-onglets : risque de perte lors d'écritures réellement simultanées |
| QCM classiques | Même document de progression ; historique ajouté au format ancien | `quizAttempts:[{score,total,completedAt}]` par cours ; aucun ID de tentative, de question historique ou d'opération | Chaque correction ajoute une tentative ; `score` garde le meilleur score absolu. Ancien meilleur score conservé dans `legacyQuizScore:{score,total}` lors de la première correction historisée | Recommencer ajoute une tentative ; n'efface pas les précédentes. Aucun parcours de suppression | Scores entiers sûrs, `0 <= score <= total`, `total > 0` et date ISO avec fuseau pour une tentative exploitable. Les anciens scores n'ont pas de date. Archives/éléments invalides et champs inconnus conservés. Même risque de concurrence que les cours |
| Botanique : sessions | localStorage `monbprea.botanical.v1` ; `schemaVersion:1` | `sessions:[]` de métadonnées avec `id` stable, catégorie, mode, durée, révision, début, nombre de questions et fin nullable | Session créée avant les réponses ; complétion `completedAt:null -> date`. Métadonnées initiales non remplaçables | Une nouvelle visite/session ne supprime pas les anciennes ; pas de suppression métier | Identifiants non vides, dates UTC, 1 à 10 questions, durée 1 à 300 secondes. Fin partielle autorisée. Première date de fin conservée. Relecture et trois essais sans verrou atomique |
| Botanique : réponses | `answers:[]` du même document | `id === questionId`, `sessionId` ; question créée sous `${sessionId}-qN` | Ajout d'un résultat terminal ; même identité/contenu normalisé = succès sans écriture ; identité identique/contenu divergent = refus | Réviser crée d'autres sessions/réponses ; n'annule pas l'erreur historique | Réponse immuable, statuts et cohérence du choix contrôlés. Des réponses sans session sont néanmoins acceptées par le store local : historique orphelin à signaler, sans inventer une session |
| Paramètres ITK | localStorage `bprea-demo-itk-v1` ; aucun champ de version | Un objet de huit chaînes `crop,variety,cover,area,month,year,soil,water` ; aucun ID ni date | Soumettre le générateur remplace les derniers paramètres. Aucun document ITK calculé n'est persisté | Remplacement volontaire autorisé ; aucun parcours de suppression ou versionnage | Validation explicite de surface et contraintes HTML ; choix des autres valeurs par les listes de l'interface. Pas de migration/archives spécifiques ; écriture globale avec dernier enregistrement gagnant |
| Apparence | localStorage `bprea-demo-appearance-v1`, objet `version:1` ; ancienne clé brute `bprea-demo-theme-v1` | `season`, `brightness`, `updatedAt` facultatif, champs inconnus et éventuelle `unrecognizedPreferencesArchive` | Modifier un choix relit puis écrit les préférences et une date de l'appareil ; migration legacy sans date | Choisir `auto` remplace un choix fixe ; ancienne clé conservée. Aucune suppression métier | Valeurs reconnues décrites ci-dessous. Archive des formats inconnus lors d'un choix explicite ; lecture seule sans écrasement. Relecture avant patch, sans CAS inter-onglets |

| Domaine audité | Modèle distant recommandé, issu de l'audit | Futur lot client |
| --- | --- | --- |
| Cours | État personnel par identité pédagogique, révision serveur et faux explicite ; ne pas recalculer un `done:true` à partir d'un ancien résultat parfait | 6.3.2 |
| QCM classiques | Tentatives distinctes immuables, identité persistante d'opération ; conserver les bases historiques sans créer de tentative ou date fictive | 6.3.2 |
| Botanique | Sessions personnelles et réponses immuables séparées ; clé de réponse métier et relation comprenant le propriétaire ; complétion de session conditionnelle | 6.3.3 |
| ITK | Un singleton de derniers paramètres par compte, remplaçable avec révision ; aucune bibliothèque ni historique documentaire | 6.3.4 |
| Apparence | Un singleton de choix persistants par compte, remplaçable avec révision ; valeurs automatiques conservées comme telles | 6.3.4 |

### Cours et résultats QCM : format réel

Sources : [`app.js`](../../assets/app.js), lignes 21–42, 107–118 ; [`exam-stats.js`](../../assets/exam-stats.js), lignes 5–62 et 72–134 ; [`exam-preparation.js`](../../assets/exam-preparation.js) ; [`content.js`](../../assets/content.js), lignes 2–105.

Les identifiants des cours actuellement publiés sont `matiere-organique`, `rapport-cn`, `pedofaune` et `pedoflore`, tous rattachés à `uc3`. Les UC publiques sont `uc1` à `uc5`, `ucare1` et `ucare2`. Les clés ne sont pas des UUID Auth. Chaque cours contient trois questions QCM publiques, indexées dans son tableau `quiz` ; la sauvegarde ne conserve ni choix des réponses, ni énoncés, ni version de banque, ni identifiants de questions QCM.

Exemple représentatif, avec une date fictive de test réellement présente seulement dans une tentative historisée :

```json
{
  "matiere-organique": {
    "done": false,
    "score": 3,
    "legacyQuizScore": { "score": 2, "total": 3 },
    "quizAttempts": [
      { "score": 3, "total": 3, "completedAt": "2026-10-21T12:00:00.000Z" },
      { "score": 1, "total": 3, "completedAt": "2026-10-21T12:05:00.000Z" }
    ]
  }
}
```

Ce document est légitime : après le QCM parfait, l'utilisateur a pu décocher le cours. La sauvegarde ne permet pas de dater cette annulation. Un ancien meilleur score ne permet de retrouver ni le nombre de tentatives, ni leurs dates, ni les réponses individuelles. `score` est un maximum de nombres de bonnes réponses, pas un pourcentage ; si le nombre de questions évolue, les `total` des tentatives restent ceux enregistrés à leur correction.

Le lecteur accepte tout objet racine non nul et non tableau. Une chaîne JSON illisible, un tableau, une primitive ou `null` deviennent `{progressArchive:[raw]}` lors de la prochaine écriture, en conservant la chaîne source. Le changement de case préserve les autres propriétés de l'entrée et archive une ancienne entrée non objet. `recordQuizAttempt` copie les champs inconnus ; un ancien `quizAttempts` non tableau est ajouté à `quizAttemptsArchive`, un meilleur score non entier sûr ou négatif à `quizScoreArchive`, et une ancienne entrée non objet non nulle à `progressArchive`. Les éléments invalides déjà dans un tableau de tentatives restent dans ce tableau. Il n'existe pas d'enveloppe de version permettant de conclure qu'une propriété inconnue serait inutile.

Pour les calculs, les dates d'une tentative doivent être des chaînes ISO avec `Z` ou décalage, une date civile réelle et un instant interprétable. Les scores exploitables sont des entiers sûrs bornés par leur total positif. Le meilleur score peut néanmoins contenir un ancien nombre supérieur au total courant, car l'écriture historique conserve tout ancien entier sûr non négatif ; les statistiques signalent ensuite ce résultat comme invalide. Le backend ne doit pas « réparer » silencieusement cette donnée ni effacer la source.

Les statistiques comptent toutes les tentatives valides pour la réussite : somme des scores divisée par somme des totaux. Pour la complétion, les répétitions n'ajoutent pas de questions uniques ; un ancien meilleur score valide contribue seulement à la complétion. `done` n'est jamais une preuve de tentative réalisée. Les QCM classiques restent séparés des premières réponses et entraînements Drill.

L'écran empêche deux corrections de la même page avec `submitted`, puis « Recommencer » ouvre une nouvelle tentative. Il relit la progression avant l'écriture, mais l'enchaînement lecture/écriture n'est pas atomique. L'absence d'ID local interdit de dédupliquer sûrement par `(score,total,completedAt)` : deux tentatives véritables peuvent avoir ces trois valeurs identiques. Un futur import devra conserver une correspondance durable entre chaque entrée source et son identité d'opération, avant le premier envoi. Des copies de sauvegarde sans provenance commune ne permettent pas une déduplication automatique certaine.

Les tests existants couvrent notamment le calendrier, l'ITK et la conservation d'une progression pendant les changements d'apparence (`tests/e2e/critical-paths.spec.js`). L'audit ne retrouve pas de suite unitaire dédiée à `recordQuizAttempt`/`getUnitExamStats` : ce constat ne vaut pas validation directe de ces fonctions. Le lot backend ajoute ses propres fixtures représentatives sans modifier ces calculs.

### Reconnaissance botanique : sessions et réponses indépendantes du Drill

Sources : [`botanical-store.js`](../../assets/botanical-store.js), lignes 4–26 et 33–130 ; [`botanical-engine.js`](../../assets/botanical-engine.js), création de session, évaluation et normalisation ; [`botanical.js`](../../assets/botanical.js) ; [`RECONNAISSANCE-PLANTES.md`](RECONNAISSANCE-PLANTES.md). Les tests `tests/integration/botanical-store.test.js` et `tests/unit/botanical-engine.test.js` exercent la banque réelle et la conservation des historiques.

Une session sauvegardée a la forme suivante :

```json
{
  "id": "session-test",
  "categoryId": "petits-fruits",
  "mode": "chrono",
  "durationSeconds": 30,
  "revision": false,
  "startedAt": "2026-10-21T12:00:00.000Z",
  "totalQuestions": 4,
  "completedAt": null
}
```

Les IDs de catégories et de plantes viennent de `botanical-bank.json`. Les métadonnées sauvegardées ne comprennent ni les quatre choix proposés, ni un snapshot des questions/photographies, ni une progression permettant de reprendre la session courante après fermeture. Le nombre de questions est entier de 1 à 10 ; la durée est un nombre fini entre 1 et 300 secondes, pas nécessairement entier. Les identifiants locaux sont non vides et limités à 200 caractères ; la création borne l'ID session à 190 pour pouvoir lui ajouter `-qN`.

Chaque réponse conserve `id`, `sessionId`, `questionId`, `categoryId`, `speciesId`, `photoId`, `mode`, `revision`, `status`, `selectedSpeciesId`, `correct`, `elapsedMs` et `answeredAt`. Son identité est celle de sa question : `id === questionId`. Les modes sont `discovery` et `chrono`. Les statuts sont `correct`, `incorrect`, `timeout` et `skipped_image` ; ce dernier signifie une image indisponible et est exclu du dénominateur des résultats. Un timeout n'est autorisé qu'en Chrono. Une sélection correcte égale `speciesId`, une sélection incorrecte est un autre ID non vide, un timeout ou une image indisponible a une sélection nulle. `correct` équivaut exactement au statut `correct`.

Les dates sont des instants ISO UTC valides. `elapsedMs` est normalisé en entier arrondi entre zéro et `Number.MAX_SAFE_INTEGER`. Une session peut être créée déjà complétée ; sinon seule sa fin passe de null à une date supérieure ou égale au début. Les autres métadonnées ne peuvent pas changer. Le store local garde la première fin non nulle, même si un appel ultérieur propose une autre fin ; cette tolérance locale ne doit pas masquer un conflit distant. Il n'exige ni que toutes les questions soient répondues avant une fin, ni qu'une réponse locale possède déjà sa session. Les tests du store contiennent effectivement des réponses sans session. Un import distant avec relation obligatoire devra les refuser et les conserver à part dans la source, sans métadonnée inventée.

Le retry d'une réponse portant la même identité et les mêmes champs métier normalisés réussit sans réécrire ; un contenu divergent est refusé. Deux nouvelles questions de deux sessions sont deux véritables tentatives même si elles concernent la même plante. Réviser une erreur `incorrect` ou `timeout` crée une nouvelle session avec `revision:true` ; un succès ultérieur ne supprime pas l'erreur historique. Ces résultats ne partagent aucune identité avec le Drill.

Un document corrompu ou de version entière future bloque toute écriture ; la chaîne d'origine reste intacte. Dans un document v1 lisible, les lignes invalides/doublonnées sont exclues de la vue statistique mais restent dans le JSON brut, avec les champs inconnus de la racine et des réponses. Les champs inconnus d'une session existante restent conservés lors de sa complétion. La transaction locale relit puis vérifie la chaîne avant une écriture, avec trois essais ; ces opérations localStorage ne forment pas un verrou atomique entre onglets.

### Générateur ITK : derniers paramètres, sans collection de documents

Sources : [`app.js`](../../assets/app.js), lignes 121–154 ; [`content.js`](../../assets/content.js), lignes 109–141 ; parcours ITK de `tests/e2e/critical-paths.spec.js`.

```json
{
  "crop": "tomate",
  "variety": "Marmande",
  "cover": "serre",
  "area": "100",
  "month": "5",
  "year": "2028",
  "soil": "limoneux",
  "water": "standard"
}
```

Ces huit valeurs proviennent de `Object.fromEntries(new FormData(form))` et sont donc toutes des chaînes. La surface est explicitement convertie et refusée si elle n'est pas finie ou hors de 1 à 100 000 m² ; l'input HTML impose en plus `step=1` et `required`. Les mois sont les chaînes `1` à `12`, les années proposées `2026` à `2033`, les conduites `serre|plein`, les sols `leger|limoneux|lourd` et l'eau `standard|limitee`.

| Culture | Variétés/types actuellement proposés |
| --- | --- |
| `tomate` | `Marmande`, `Roma`, `Cœur de bœuf`, `Autre / non précisée` |
| `laitue` | `Batavia`, `Feuille de chêne`, `Laitue pommée`, `Autre / non précisée` |
| `carotte` | `Nantaise`, `Touchon`, `Carotte de conservation`, `Autre / non précisée` |
| `courgette` | `Black Beauty`, `Ronde de Nice`, `Courgette verte (type)`, `Autre / non précisée` |

Le changement de culture remplace les options de variété ; une variété sauvegardée absente de la liste est remplacée à l'affichage par sa première option. Les valeurs manquantes/falsy reçoivent des défauts d'affichage. Le lecteur `safeRead` ne valide pas exhaustivement le document : ces replis ne constituent pas un certificat de validité pour un import distant. Il n'existe ni date de modification, ni ID de projet, ni liste d'ITK, ni historique de paramètres. Le calendrier, les densités et les alertes sont recalculés depuis les données publiques. L'export CSV et l'impression n'ajoutent pas de document persistant. Copier ces résultats dans une bibliothèque distante introduirait une fonctionnalité absente du périmètre.

### Apparence : choix persistants et rendu local

Sources : [`theme-init.js`](../../assets/theme-init.js), lignes 4–37 et 69–80 ; [`appearance.js`](../../assets/appearance.js) ; [`THEMES.md`](THEMES.md) ; tests unitaires et d'intégration `appearance.test.js`.

Le document reconnu est `{version:1,season,brightness,...champsInconnus}`. `season` vaut `auto|spring|summer|autumn|winter`, et `brightness` `auto|light|dark`. `updatedAt` est une date ISO de l'appareil écrite seulement lors d'un choix explicite ; elle peut donc être absente, et le lecteur local ne valide pas un ancien champ de date. Aucun horodatage de serveur n'existe dans la source.

L'ancienne clé contient une chaîne brute `light` ou `dark`. Si la nouvelle clé est absente, le lecteur peut créer une préférence v1 `season:auto` et `brightness:ancienneValeur`, sans date fictive, et conserve l'ancienne clé. Un objet v1 conserve ses champs inconnus. Pour un format non reconnu/corrompu/futur, la lecture n'écrit pas ; lors d'un choix explicite, la chaîne brute est conservée dans `unrecognizedPreferencesArchive:[raw]` avant d'écrire un document reconnu. Une saison invalide retombe à `auto` pour le rendu ; une luminosité invalide retombe au choix legacy reconnu puis à `auto`. Le futur import ne doit pas confondre ces replis d'affichage avec des choix valides provenant de la source.

Le mode automatique s'interprète sur chaque appareil selon son calendrier et son heure locale : saisons civiles au 1er mars/juin/septembre/décembre ; matin 6–10 h, jour 10–18 h, crépuscule 18–22 h, nuit 22–6 h. Les attributs calculés `data-season`, `data-time`, `data-theme` ne sont pas des préférences à envoyer. Un choix `auto` reste `auto` après récupération sur un autre appareil.

### Autres stockages : exclusions justifiées

Recherche effectuée dans les modules applicatifs et le SDK Auth local. Aucune clé de stockage découverte n'est automatiquement ajoutée au modèle distant.

| Source | Catégorie et contenu | Décision du lot 6.3.1 |
| --- | --- | --- |
| `bprea-demo-drill-v1` | Pédagogie visiteur : document v1 de séries, réponses, entraînements et brouillons | Déjà audité au lot Drill ; aucun doublon dans les nouvelles tables, aucun transfert visiteur automatique |
| IndexedDB `mon-bprea-drill-personal-v1`, version 1, store `accounts` | Drill personnel : `scope = JSON([environment,origin,userId])` ; document `version,scope,drill,operations,remote,conflicts,lastReconciledAt` | Cache/outbox déjà dédiés aux lots 6.2 ; conserver le contrat et les données existants |
| `bprea-demo-daily-fact-dismissed-v1` | État d'interface : date civile Europe/Paris du masquage de l'anecdote du jour | Exclu : préférence temporaire de l'appareil, aucune nécessité pédagogique de la rendre distante |
| `bprea-demo-theme-v1` | Ancienne préférence de luminosité | Source de compatibilité de l'apparence, pas de table ni de deuxième préférence concurrente |
| `bprea-auth-${hostname}-${sitePath}` et dérivés SDK PKCE | Session et continuité Auth sous la responsabilité du SDK partagé | Exclus : ne copier ni JWT, refresh token ni secret dans les tables personnelles |
| `bprea-auth-local-identity-v1:${JSON([environment,origin,path])}` | Marqueur local `{version:1,userId,sessionId}`, sans valeur d'autorisation distante | Exclu : continuité de session gérée par Auth, pas une donnée pédagogique |
| Repli interne sessionStorage du SDK Realtime, `phx:fallback:${transport}` | État technique de transport du SDK | Exclu : aucun document métier applicatif en sessionStorage |
| URL et mémoire des pages | Navigation, filtres, mois du calendrier, session botanique en cours et éléments d'interface | État temporaire ; aucune nouvelle table |
| `content.js`, banques Drill/botanique, `calendar-events.json`, `resources.json`, `navigation.json`, `daily-facts.json`, photos et PDF | Contenus éditoriaux publics du dépôt | Exclus : ne pas recopier dans les données privées ; conserver seulement les identifiants utiles aux résultats |
| `profiles` et Supabase Auth | UUID, pseudo facultatif, identité de connexion | Déjà pris en charge au lot 6.1 ; ne pas recopier l'e-mail ou créer de profil pédagogique parallèle |

## 2. Principes de compatibilité issus de l'audit

Un import futur doit préserver intégralement la source locale et ses archives, et signaler les éléments qu'il ne peut pas accepter. Aucun refus n'autorise à supprimer la clé, à la réinitialiser ou à attribuer une date fictive à un résultat ancien. Une version de document inconnue requiert une décision explicite du futur client avant extraction ; les champs inconnus ne deviennent pas arbitrairement des colonnes ou des charges JSON universelles.

Les formats distants imposent des limites et des relations explicites, sans prétendre que le stockage local historique les garantissait déjà. Les résultats proviennent d'un navigateur public : les scores et les réponses constituent des déclarations pédagogiques du client. Les données disponibles permettent de vérifier les types, bornes, identités, cohérence déclarative et relations de propriétaire ; elles ne constituent pas des preuves d'examen certifié. La banque publique actuelle ne permet pas de reconstruire ou certifier une ancienne réponse dont les choix/snapshots n'ont jamais été sauvegardés.

Les cours ont un état volontaire modifiable, les QCM un historique de tentatives et une base ancienne partielle, la botanique des résultats terminaux et des métadonnées de session complétables, l'ITK et l'apparence des singletons remplaçables. Ces différences justifient des contrats de domaine distincts.

## 3. Modèle SQL retenu (choix du lot 6.3.1)

Migration générée par `supabase migration new create_personal_data_backend`, après lecture de `--version` et `migration new --help` de la CLI **2.121.0** : `20261025143831_create_personal_data_backend.sql`. Les migrations profils et Drill restent inchangées. Les six tables suivantes représentent des domaines identifiés dans l'audit, sans coffre universel localStorage ni copie des contenus publics.

| Table | Identité et données métier | Mutabilité et finalité |
| --- | --- | --- |
| `course_states` | PK `(user_id,lesson_id)` ; `done`, `best_score` nullable, `legacy_score/legacy_total` nullables ensemble | État volontaire du cours, meilleur score absolu historique sans dénominateur inventé, base QCM ancienne avec total connu. `done` réversible ; meilleur score non décroissant ; base ancienne préservée |
| `quiz_attempts` | PK `(user_id,attempt_id)` ; `lesson_id,score,total,completed_at` | Une tentative QCM classique par UUID d'opération durable. Append-only, sans question ni réponse individuelle inventée |
| `botanical_sessions` | PK `(user_id,session_id)` ; `category_id,mode,duration_seconds,is_revision,started_at,total_questions,completed_at` | Métadonnées initiales immuables ; seule la première fin peut compléter une session |
| `botanical_answers` | PK `(user_id,answer_id)` ; identité de question, session, catégorie, espèce, photo, mode, révision, statut, sélection, correction, durée et date | Résultat terminal immuable ; `answer_id=question_id`, unicité personnelle session/question et FK composite vers la session du même propriétaire |
| `itk_settings` | PK `user_id` ; `parameters` JSONB avec les huit chaînes auditées | Derniers paramètres, remplaçables. Aucun projet, document généré ou historique de versions |
| `appearance_preferences` | PK `user_id` ; `season,brightness,client_updated_at` nullable | Choix persistants, remplaçables ; `auto` reste une valeur, interprétée localement |

Toutes les tables ont un `schema_version=1` protégé et un `created_at` serveur. Les quatre tables modifiables ont aussi `operation_id`, `base_revision`, `revision` et `updated_at`. `is_revision` botanique signifie « révision des erreurs » ; `revision` SQL désigne uniquement le compteur de concurrence. Aucun horodatage serveur ne représente rétroactivement une activité de l'appareil.

Chaque table dépend de `auth.users(id)` avec `ON DELETE CASCADE`. La FK botanique contient `user_id` : connaître une session d'un autre compte ne permet ni de la voir ni de lui rattacher une réponse. Les clés et index commencent par `user_id` pour RLS ; les index d'historique complètent les PK pour la pagination des tentatives et des réponses. Aucune FK vers un catalogue pédagogique figé en base : un retrait de contenu public ne doit pas supprimer un historique. Les IDs restent du texte borné et contrôlé, sans prétendre certifier leur origine éditoriale.

Le backend conserve le meilleur score absolu sans lui fabriquer un total ; les tentatives gardent chacune leur propre total. Le futur client pourra projeter le maximum du meilleur score conservé et des scores des tentatives ; il ne doit pas recalculer `done` à partir de ces lectures. L'action locale actuelle qui marque un cours terminé après un QCM parfait pourra produire une opération d'état explicite distincte au lot 6.3.2. L'envoi de la tentative et celui de l'état ne forment pas une transaction métier commune : une outbox doit conserver séparément les deux intentions jusqu'à leur résolution.

## 4. Isolation, privilèges et limites de confiance

RLS est activée sur chaque nouvelle table. Les politiques `SELECT` et `INSERT`, limitées à `authenticated`, vérifient `(select auth.uid()) = user_id`. Les quatre tables modifiables ont une politique `UPDATE` avec cette condition dans **USING et WITH CHECK**. Il n'existe aucune politique ou permission `DELETE` étudiante : décocher, compléter et remplacer sont des modifications, pas des suppressions. Les deux historiques n'ont aucun droit `UPDATE`.

Après révocation des droits par défaut, `authenticated` reçoit `SELECT`, les seuls `INSERT` métier et les seuls `UPDATE` nécessaires. Le propriétaire est toujours obtenu par `auth.uid()` ; les grants n'autorisent pas l'écriture de `user_id`, des dates serveur, du compteur `revision` ni de la version de schéma. `base_revision` et `operation_id` sont des commandes client contrôlées par trigger, pas des colonnes techniques de confiance. Aucune permission anonyme ou `PUBLIC` n'est ajoutée, aucune vue n'est créée, aucun rôle ni privilège des tables antérieures n'est modifié.

Les RPC sont `VOLATILE SECURITY INVOKER`, avec `search_path=''`, noms qualifiés et `EXECUTE` réservé à `authenticated`. Les guards privés sont eux aussi invoker et ne sont pas des RPC appelables par les clients. Aucun `SECURITY DEFINER`, contournement RLS, e-mail ou `user_metadata` ne participe à l'autorisation. Le rôle administratif n'est jamais nécessaire au navigateur ; les seuls appels administratifs de test créent et nettoient les comptes fictifs de leur exécution locale dédiée.

Les triggers contrôlent aussi les écritures PostgREST directes. Une RPC ne constitue donc pas l'unique barrière contre un PATCH construit à la main. Le client peut déclarer un score ou une réponse cohérente sans l'avoir réellement obtenu : ces valeurs ne sont **pas des résultats d'examen certifiés**. Les vérifications portent sur la forme, la cohérence, les relations et la propriété, sans recalcul à partir d'un snapshot qui n'existe pas dans ces historiques.

## 5. Concurrence et reprise des écritures

### États modifiables : comparaison de révision obligatoire

Le client conserve une opération durable `{operationId,expectedRevision,payload}` avant tout envoi. Créer exige `expectedRevision=0` ; la première ligne reçoit `revision=1` et `base_revision=0`. Modifier exige la dernière révision lue. Le guard compare `base_revision` à l'ancienne `revision`, incrémente lui-même la révision et fixe les dates serveur. Une ancienne base est refusée ; ni un `updated_at` client, ni une date plus récente ne lui donnent priorité. Un PATCH direct sans nouvelle base correcte ne peut contourner ce contrôle.

Les RPC verrouillent la ligne existante et traitent la course à la création sans écrasement. Deux modifications concurrentes sur la même base ne gagnent pas toutes les deux. Une réussite renvoie `inserted` ou `updated` et la ligne effective. Une base dépassée renvoie `conflict` et la ligne personnelle actuelle. Le client conserve son intention locale, relit et propose une décision explicite ; une nouvelle intention après résolution reçoit un nouvel UUID et la nouvelle base. Aucune fusion silencieuse de choix incompatibles n'est promise.

Même dernier UUID, même base et même payload canonique : `replayed`, sans nouvelle révision ni changement de date. Même UUID avec un contenu différent : `conflict`. Une opération déjà remplacée par une autre n'a plus de reçu historique dans ces singletons : son retry avec la base originale retourne **conflict**, même si elle avait réussi avant la perte d'acquittement. C'est une limite volontaire de minimisation ; la valeur actuelle reste intacte et l'opération ancienne n'est jamais réappliquée automatiquement. La file doit conserver le conflit et ne pas réémettre le même UUID avec une base modifiée. Une table de reçus perpétuels n'est pas introduite pour inventer un historique de préférences ou d'ITK.

`course_states.done=false` est une valeur distante conservée, jamais une absence à combler depuis un ancien appareil. Les scores historiques ne diminuent pas et la base ancienne déjà enregistrée ne disparaît pas lors d'une annulation du cours. Pour une session botanique, les métadonnées initiales ne changent jamais et une fin non nulle ne peut pas être remplacée par une autre fin. La fin peut survenir avant que toutes les questions aient reçu une réponse ; elle ne prouve pas un taux de complétion de 100 %.

### Historiques immuables

QCM : `attempt_id` identifie l'opération, pas une empreinte du score. Retry exact : `replayed` ; même ID avec autre contenu : `conflict` ; deux IDs durables distincts : deux tentatives, même à score/total/date égaux. Aucun UPDATE ou upsert avec écrasement. Le serveur ne déduit pas une chronologie fine entre deux dates pédagogiques égales ; l'ordre stable de lecture utilise aussi l'identité, pas une heure artificielle.

Botanique : `answer_id` reprend exactement le `questionId` local ; il n'existe pas d'UUID technique alternatif pour contourner cette identité. Retry exact : `replayed` ; même identité avec résultat divergent : `conflict`. Deux questions différentes restent deux tentatives. La FK et les contrôles de session imposent la cohérence du propriétaire et des métadonnées ; les insertions concurrentes sont sérialisées sur la session pour respecter son nombre de questions. Une réponse historique orpheline n'est pas transformée en session fictive.

## 6. Contrat d'API pour 6.3.2, 6.3.3 et 6.3.4

Toutes les écritures se font avec une session Auth valide du compte propriétaire et une clé publique publishable. Le résultat normal est un **objet JSON** `{status,row}`, sans tableau enveloppant : `status` vaut `inserted`, `updated` (mutables seulement), `replayed` ou `conflict` ; `row` contient les colonnes SQL en snake_case et uniquement la ligne visible du compte courant. Pour un conflit sans ligne à la clé demandée (base non nulle sur création absente ou UUID d'opération déjà utilisé sur une autre clé personnelle), `row` vaut **null**. Le client conserve son intention et examine ses opérations, sans considérer null comme une autorisation de créer ou de réattribuer. Il vérifie son UUID et sa génération Auth avant de consommer une ligne.

| RPC et lot | Paramètres nommés PostgREST, tous présents ; null autorisé là où indiqué | Opération |
| --- | --- | --- |
| `personal_save_course` — 6.3.2 | `p_lesson_id:text`, `p_done:boolean`, `p_best_score:bigint|null`, `p_legacy_score:bigint|null`, `p_legacy_total:bigint|null`, `p_operation_id:uuid`, `p_expected_revision:bigint` | Créer/remplacer l'état complet d'un cours ; la paire legacy est nulle ensemble ; ne jamais fabriquer une date de case ou de score ancien |
| `personal_record_quiz` — 6.3.2 | `p_attempt_id:uuid`, `p_lesson_id:text`, `p_score:bigint`, `p_total:bigint`, `p_completed_at:timestamptz` | Ajouter une tentative classique avec sa date réellement conservée |
| `personal_save_botanical_session` — 6.3.3 | `p_session:jsonb`, `p_operation_id:uuid`, `p_expected_revision:bigint` | Créer les métadonnées ou compléter la première fin ; objet local `id,categoryId,mode,durationSeconds,revision,startedAt,totalQuestions,completedAt` ; `completedAt` absent équivaut à null |
| `personal_record_botanical_answer` — 6.3.3 | `p_answer:jsonb` | Ajouter l'objet local complet `id,sessionId,questionId,categoryId,speciesId,photoId,mode,revision,status,selectedSpeciesId,correct,elapsedMs,answeredAt` ; `selectedSpeciesId` doit être explicitement null pour timeout/image indisponible |
| `personal_save_itk` — 6.3.4 | `p_parameters:jsonb`, `p_operation_id:uuid`, `p_expected_revision:bigint` | Remplacer les huit chaînes `crop,variety,cover,area,month,year,soil,water`, sans champs de document généré |
| `personal_save_appearance` — 6.3.4 | `p_preferences:jsonb`, `p_operation_id:uuid`, `p_expected_revision:bigint` | Objet `version:1,season,brightness`, plus `updatedAt` facultatif ; absence de date source reste null |

Exemple de requête de décochage, après lecture d'une révision 1 :

```json
{
  "p_lesson_id": "matiere-organique",
  "p_done": false,
  "p_best_score": 3,
  "p_legacy_score": 2,
  "p_legacy_total": 3,
  "p_operation_id": "63100000-0000-4000-8000-000000000002",
  "p_expected_revision": 1
}
```

L'UUID est illustratif : le client génère et persiste le sien une seule fois. Les clés JSON inconnues sont refusées dans les payloads structurés : un client ne doit pas passer l'objet brut contenant les archives. Il préserve la sauvegarde brute et sa correspondance locale, puis extrait explicitement le sous-ensemble connu et validé. Le refus d'un champ ne justifie jamais son effacement de la source.

### Validation et erreurs

Identités métier non vides de 1 à 200 caractères ; UUID opération nul réservé refusé ; entiers sûrs JavaScript jusqu'à 9 007 199 254 740 991, scores positifs ou nuls et total positif bornant le score ; dates finies dans les années 1 à 9999 ; objets JSON et types contrôlés avant conversion. Les payloads JSON sont limités à 8 192 octets pour une session/réponse botanique et à 4 096 pour ITK/apparence ; les sessions sont limitées à dix questions et 1 à 300 secondes (fraction autorisée). Les métadonnées de réponse doivent correspondre à la session et sa date doit être comprise entre son début et sa fin lorsque celle-ci existe. Une fin ne peut précéder une réponse déjà reçue. Ce sont des contraintes distantes supplémentaires : les anciennes lignes localement lisibles qui les enfreignent sont refusées sans effacement. Les statuts/choix suivent les formes auditées. Les valeurs et associations culture/variété ITK suivent le catalogue actuel ; surface numérique entière entre 1 et 100 000, notation décimale/exposant admise comme dans le formulaire avec chaîne originale conservée ; une évolution du catalogue demandera une nouvelle migration de validation. Les dates source restent déclaratives et ne servent pas à gagner un conflit.

L'API est un contrat v1 : le serveur protège `schema_version=1` ; les objets d'apparence exigent `version:1`. Les enveloppes locales cours/ITK ne disposent pas de version interne, tandis que le document botanique exige `schemaVersion:1` **avant extraction par le futur importeur**. Une RPC d'entrée ne peut deviner la version d'un document dont le client n'a envoyé qu'une ligne. Aucun importeur n'est livré dans ce lot.

| Résultat/code | Signification et conduite du futur client |
| --- | --- |
| `conflict` | Conflit métier normal : conserver opération/intention et ligne gagnante, ne pas compter une deuxième tentative, résoudre explicitement |
| `23514` | CHECK ou validation métier refusée ; ne pas réessayer en boucle, conserver source et diagnostic sans donnée sensible |
| `23502`, `22P02`, `22007`, `22008` | Colonne requise, type ou date SQL invalide ; opération refusée sans destruction de la source |
| `23503` | Relation inexistante/interdite ; envoyer d'abord la session personnelle valide, ne jamais inventer une session étrangère/orpheline |
| `23505` | Identité/UUID déjà utilisé de façon incompatible avec une autre clé ; conserver l'opération et examiner la collision, ne pas changer arbitrairement l'identité |
| `42501` ou HTTP 401/403 | Privilège/identité/session refusés ; suspendre les envois de l'espace courant et revalider Auth, jamais essayer avec le compte suivant |
| `40001` | Transaction concurrente à reprendre ; renvoyer strictement la même opération persistée, avec attente bornée |
| Réseau/timeout/5xx | Acquittement incertain : ne pas recréer d'UUID ni augmenter la base ; renvoyer l'opération exacte, puis traiter replay/conflit |

Une relation étrangère peut être refusée avant la FK par le guard, avec `42501` et un message d'indisponibilité qui ne révèle pas l'existence d'une session voisine. Les erreurs de validation et de type peuvent précéder la recherche d'un conflit ; ne pas dépendre d'un ordre de vérification pour les payloads invalides.

### Lecture, pagination et deuxième appareil

Lire les tables via PostgREST `SELECT`, filtré par `user_id` courant même si RLS s'applique déjà. GET renvoie un tableau de lignes, vide si aucune n'est visible ; une erreur n'est pas un tableau vide. Utiliser des pages bornées, par exemple 100 lignes (maximum de projet PostgREST conservé), sans supposer qu'une réponse est un historique complet. Ordres de curseur : `course_states` par `lesson_id`, `quiz_attempts` par `(created_at,attempt_id)`, `botanical_sessions` par `session_id`, `botanical_answers` par `(created_at,answer_id)`. Les index correspondants sont dans la migration. Pour les singletons ITK/apparence, zéro ou une ligne par utilisateur suffit.

Pour les historiques immuables, appliquer le filtre lexicographique `(created_at > cursorTime) OR (created_at = cursorTime AND identity > cursorId)`, avec ordre ascendant sur les deux colonnes, encodage des valeurs et `.limit(100)`. Avancer le curseur seulement après persistance atomique du lot local. La date pédagogique ne sert pas de curseur d'arrivée : un ancien résultat peut être envoyé aujourd'hui. Les UUID d'opération et IDs botaniques restent les clés de déduplication du cache, y compris si une page est relue.

Un parcours paginé n'est pas un snapshot transactionnel multi-requêtes : une transaction commencée avant la lecture peut être validée après le passage du curseur, et des états modifiables peuvent changer pendant la pagination. Ne pas construire un protocole de réplication sans perte sur le seul `created_at/updated_at`. Au démarrage, à la reprise et à l'actualisation, refaire des passes complètes par identité, fusionnées par PK/révision, jusqu'à stabilisation lorsque l'activité le permet ; périodiquement relire entièrement l'historique paginé. Les quatre domaines modifiables sont relus entièrement, pas uniquement après un watermark de date. La convergence suppose une connexion et des passes terminées ; aucun instantané global des six tables n'est promis.

Sur un second appareil, commencer par récupérer toutes les pages personnelles, sans reprendre la clé visiteur comme source implicite. L'absence de cache et une erreur de lecture distante ne signifient pas un historique vide. La projection statistique ne double pas les opérations locales en attente et leurs lignes acquittées ; un conflit n'est pas une nouvelle tentative.

## 7. Obligations des futurs clients offline-first

1. Préserver les anciennes clés et les chaînes brutes, archives incluses. L'historique visiteur ne doit jamais être transféré automatiquement à la connexion. Tout futur parcours d'import doit relever d'un lot autorisé et d'un choix explicite.
2. Séparer cache, outbox, conflits et manifestes par environnement, origine/projet Supabase et UUID Auth validé. Ne pas copier ces domaines dans le cache Drill existant sans une décision de conception dédiée.
3. Enregistrer atomiquement l'intention locale et son opération durable avant envoi. Les QCM historiques exigent un manifeste par entrée source (identité de sauvegarde/provenance + position) ; ne pas hacher score/date pour fusionner des tentatives distinctes. Deux copies sans provenance commune demandent une résolution explicite ; aucune déduplication certaine n'est disponible.
4. Capturer l'identité, le JWT et la génération de session pour chaque requête. Revalider avant le départ et avant d'appliquer une réponse. En cas de A vers B, abandonner le transport A et conserver son outbox dans A ; ne jamais renvoyer son payload sous le JWT B. Un ancien résultat HTTP ne réactive pas l'affichage de A.
5. Après acquittement, persister ligne distante et retrait de l'opération dans la même transaction locale. Après perte d'acquittement, garder ID/base/payload identiques. Les opérations modifiables supersédées restent en conflit ; leur source n'est pas effacée pour obtenir un succès apparent.
6. Réconcilier par identité/révision, conserver séparément les deux intentions incompatibles et rendre une résolution explicite possible. Ne pas effectuer d'union monotone des `done:true` ni choisir le plus grand horodatage appareil. Des scores historiques restent distincts de l'état volontaire du cours.
7. Conserver les formats futurs et éléments invalides hors de l'envoi, avec un diagnostic local non destructif. Valider wrapper/version, dates, types et champs avant extraction. Une réponse botanique orpheline reste disponible dans la source, sans session créée artificiellement. Une ancienne apparence sans date est acceptable ; une date présente mais invalide n'est pas convertie en date courante.

Ces obligations réutilisent les principes validés du [client Drill](DRILL-SYNCHRONISATION-CLIENT.md), sans ajouter ici de client JavaScript, service worker, interface de transfert, nouvel écran de compte ou Dashboard unifié. La déconnexion ne supprime aucune progression.

## 8. Confidentialité et préparation du lot 6.4

| Catégorie | Finalité et portée | Racine d'identification pour accès/export/conservation/suppression futurs |
| --- | --- | --- |
| Cours et base QCM ancienne | Retrouver état de cours et meilleur résultat disponible, y compris historique partiel non daté | `course_states.user_id` vers UUID Auth |
| Tentatives QCM | Retrouver les essais datés et leurs totaux d'origine | `quiz_attempts.user_id` |
| Sessions et réponses botaniques | Historique indépendant, erreurs et révisions, statistiques descriptives | `botanical_sessions.user_id`, `botanical_answers.user_id` et FK composite |
| Derniers paramètres ITK | Retrouver le dernier formulaire du générateur | `itk_settings.user_id` |
| Apparence | Retrouver les choix persistants, rendus selon chaque appareil | `appearance_preferences.user_id` |
| Compteurs et dates serveur | Cohérence des écritures, reprise et diagnostic de synchronisation | Colonnes techniques des mêmes lignes, sans historique de navigation |

Aucun mot de passe, e-mail dupliqué, token, clé administrative, secret SMTP, empreinte d'appareil ou contenu public n'est stocké dans ces tables. La conservation minimale porte sur les lignes nécessaires et le dernier reçu des données modifiables. Les cascades établissent la propriété pour une future suppression de compte autorisée ; aucun endpoint étudiant de suppression globale n'est livré. Le lot **6.4** devra définir et valider les procédures complètes d'accès, d'export, de durée de conservation et de suppression, y compris Auth, profils, Drill, caches et sauvegardes. Ce schéma n'est pas à lui seul une procédure RGPD validée.

## 9. Validation et application ultérieure

Les preuves exécutées, les limites du poste sans Docker et les liens CI figurent dans [VALIDATION-LOT6-3-1.md](../validations/VALIDATION-LOT6-3-1.md). Les tests pgTAP ne remplacent pas les sessions Auth et les requêtes PostgREST A/B réelles. Les deux sont exécutés sur la stack éphémère du job `supabase-security`, avec les suites antérieures conservées.

Aucune commande de ce lot ne doit appliquer cette migration à un projet hébergé. Après revue et tests verts sur le dernier commit, une intervention distincte pourra être autorisée pour **DEV `wcckbyhrtroittbfophv` uniquement** : vérifier référence/cible/historique et sauvegarde, contrôler le delta attendu, simuler les commandes adaptées à la CLI avec son aide puis appliquer seulement après autorisation explicite. Ne pas lancer les runners destructifs sur DEV. **PROD `oqoqrxwfbkhtpksqimgd` reste exclu**, sans modification Auth/SMTP, nouvelle invitation externe, ouverture étudiante ni activation de `assets/auth-config.json`.

Références consultées : [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [privilèges de colonnes](https://supabase.com/docs/guides/database/postgres/column-level-security), [changelog](https://supabase.com/changelog). Le changement TLS annoncé pour novembre 2026 concerne les API hébergées et n'impose pas de modification de ce backend PostgreSQL local. Les principes du schéma ne dépendent pas d'une mise à jour des SDK existants.
