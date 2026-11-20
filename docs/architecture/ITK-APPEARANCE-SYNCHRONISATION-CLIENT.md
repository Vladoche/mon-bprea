# ITK et apparence — synchronisation personnelle (lot 6.3.4)

Ce client clôture le périmètre fonctionnel 6.3 en consommant les deux singletons du [backend 6.3.1](PERSONAL-DATA-BACKEND.md). Les réglages ne créent aucun document ITK. La personnalisation chromatique étend le singleton d’apparence et son RPC dans une migration distincte. Les [preuves exécutées](../archives/validations/VALIDATION-LOT6-3-4.md) distinguent les tests applicatifs des recettes PostgreSQL/Auth réelles. Le [bilan 6.3](../archives/validations/BILAN-LOT6-3.md) couvre aussi les domaines antérieurs.

## Architecture et sources

Les deux domaines partagent `settings-model.js`, `settings-store.js`, `settings-transport.js` et `settings-service.js`. Ils réutilisent `createScopedRepository()` de `personal-idb.js`, la portée validée du Drill, le backoff de `sync-runtime.js`, le client Supabase et le service Auth communs. Aucune dépendance de production n’est ajoutée. Les moteurs et services Drill, cours/QCM, botanique et leurs historiques restent indépendants.

| Source | Données |
| --- | --- |
| `bprea-demo-itk-v1` | Dernier formulaire visiteur : huit chaînes, sans date ni identité de projet |
| `bprea-demo-appearance-v1` | Choix visiteur v1, champs inconnus et archives éventuelles |
| `bprea-demo-theme-v1` | Ancienne chaîne clair/sombre conservée |
| `bprea-demo-appearance-device-v1` | Mémorisation volontaire du visiteur, avec ou sans choix chromatique |
| IndexedDB `mon-bprea-settings-personal-v1`, store `accounts` | Dernières valeurs personnelles fiables, lignes serveur, opérations, dépendances, conflits, imports et dernière réconciliation |

La clé personnelle est la sérialisation de `[environnement, origineSupabase, UUIDAuth]`. Les caches ne sont jamais sélectionnés par e-mail ni à partir d’une variable CSS. Aucun JWT n’est conservé dans IndexedDB. Les clés historiques restent intactes lors de la connexion, de l’import et de la déconnexion.

## Contrats et validation

`personal_save_itk(p_parameters,p_operation_id,p_expected_revision)` reçoit exactement les chaînes `crop,variety,cover,area,month,year,soil,water`. Le catalogue réel `content.js` valide culture et variété ; conduite, sol, eau, surface entière de 1 à 100 000, mois de 1 à 12 et année contractuelle 2026–2033 sont contrôlés. Le contrat accepte une notation décimale/exposant de surface représentant un entier et conserve sa chaîne. Types, taille et champs sont contrôlés avant sauvegarde personnelle et import.

Les replis utilisés pour afficher un ancien formulaire ne valident jamais son document d’origine. Un import invalide explique son refus et conserve la source. Les années du contrat sont fixes : le passage du temps ne rend pas une valeur 2028 invalide et ne justifie aucune modification SQL. Une future interface proposant des années au-delà de 2033 nécessitera une évolution distincte du contrat ; ce lot ne la réalise pas.

`personal_save_appearance(p_preferences,p_operation_id,p_expected_revision)`
reçoit `{version:1,season,brightness}` et éventuellement `updatedAt`.
Les saisons sont `auto|spring|summer|autumn|winter` et les luminosités
`auto|light|dark`. Les champs `colorMode` et `customColor` sont fournis
ensemble. `colorMode` vaut `seasonal` ou `custom`. `customColor` est un
hexadécimal `#rrggbb` en minuscules, ou `null` en palette saisonnière.
La palette saisonnière peut garder la dernière couleur saisie. Les requêtes
historiques conservent le chromatisme déjà stocké lors d’une édition et
reçoivent leur forme de réponse d’origine. Les dates et charges historiques
restent inchangées. Les réponses et lectures nouvelles vérifient aussi les
champs chromatiques pour les intentions qui les renseignent.

Les RPC retournent `{status,row}` avec `inserted|updated|replayed|conflict`. Le client contrôle propriétaire, schéma, types, UUID, contenu et base/révision attendue avant confirmation. Une réponse incohérente n’acquitte rien. Une erreur de lecture n’est jamais interprétée comme un singleton absent.

## Atomicité, opérations successives et CAS

Chaque choix personnel crée dans une transaction IndexedDB une valeur et une opération contenant UUID durable, payload exact, révision attendue et dépendance éventuelle. Le succès local attend `transaction.oncomplete`. Quota, cache futur/illisible ou échec du `put` donnent une erreur explicite, sans succès fictif ni remise à zéro.

Les modifications successives d’un même domaine suivent une chaîne de révisions. Une intention jamais préparée pour envoi (`attempts:0`) peut être remplacée par une nouvelle intention sur sa même base, avec nouvel UUID ; l’ancienne est archivée comme supersédée sans livraison. Dès qu’une livraison est possible, son payload reste immuable et la suivante dépend de sa confirmation avec une base augmentée. Plusieurs intentions ne sont pas envoyées indépendamment avec la même base. Le retry après timeout ou perte d’acquittement conserve strictement UUID, payload et base. Une ancienne intention potentiellement livrée n’est jamais réécrite ni automatiquement rattachée à une autre révision.

Une concurrence conserve la version du compte et l’intention locale. Elle suspend les dépendants du domaine concerné. Les deux choix proposés sont « Garder la version du compte » et « Utiliser mon choix enregistré sur cet appareil ». Le second crée une nouvelle intention avec nouvel UUID sur une base distante fraîche, uniquement après l’action explicite. Les huit paramètres ITK sont un tout ; aucune fusion champ par champ n’est réalisée. `updatedAt` n’arbitre jamais un conflit.

Les singletons SQL gardent leur dernier reçu. Une opération acceptée puis remplacée peut revenir en conflit après perte HTTP. Le retry reprend l’UUID et la charge d’origine. Le cache conserve les opérations actives, les dépendances et les huit conflits résolus encore présentés avec leurs versions complètes. Les nouvelles archives éligibles gardent les identifiants, révisions et décisions utiles. Le compteur historique et les archives anciennes restent en place au-delà de l’ancienne borne de vingt. Les deux dernières preuves d’import restent séparées par domaine. [Contrat et validation F](../archives/validations/VALIDATION-LOT6-5-5F.md).

## Initialisation du thème et choix automatiques

Le [contrat de rendu](THEMES.md#premier-rendu-et-préférences-personnelles)
décrit l’indication visuelle pré-CSS, sa portée et les cas provisoires.
`auto` reste une préférence sur Supabase et dans le cache personnel.
La résolution horaire, les attributs CSS et le rendu chromatique sont
calculés sur chaque appareil. Leur application ne crée aucune opération.

## Formulaires, messages et imports volontaires

Dans **Outils → Générateur ITK**, renseigne les groupes **Culture**,
**Conditions de production** et **Calendrier**, puis sélectionne **Générer mon
itinéraire**. Le focus se place sur la synthèse, suivie des indicateurs,
des points de vigilance et des jalons mensuels. **Modifier les paramètres**
ramène à l’espèce cultivée. Les exports portent sur le dernier résultat
généré. **Imprimer / PDF** ouvre la boîte d’impression du navigateur, qui
permet d’enregistrer la feuille de résultats au format PDF.

Sous le formulaire, **Sauvegarde des paramètres** indique l’état du dernier
enregistrement. En visiteur, **Mémoriser les paramètres du dernier calcul**
est disponible après génération. **Charger les paramètres mémorisés** restaure
les champs à la demande. **Retirer les paramètres mémorisés** enlève cette
copie de l’appareil. **Anciens paramètres sur cet appareil** permet de
reprendre l’ancien formulaire. Dans un compte, la génération enregistre les
paramètres localement avant confirmation distante. L’examen des paramètres
locaux et le choix d’une version en conflit restent des actions explicites.

`itk-personal-ui.js` suit séparément la valeur chargée, le formulaire modifié et la dernière valeur disponible du compte. Une récupération tardive ne touche pas une saisie active, son focus, le résultat calculé ni les exports. Le bouton de restauration charge explicitement les paramètres ; il ne génère aucun calendrier. Un changement de compte retire en revanche les valeurs et résultats privés du compte quitté.

Le dialogue d’apparence conserve ses contrôles et le focus pendant les
publications ordinaires. Il signale l’attente, le hors-ligne, les conflits et
les erreurs. La résolution d’un conflit reste volontaire.

L’ITK garde son aperçu et sa confirmation d’import. L’apparence historique reste
dans ses clés et manifestes. Les services de lecture et de confirmation restent
disponibles pour une assistance ciblée. Aucun import ne résulte de la connexion.
Une valeur connue peut être saisie de nouveau depuis le dialogue. Voir la
[procédure d’assistance](COURSE-QUIZ-SYNCHRONISATION-CLIENT.md#récupération-assistée)
pour les vérifications avant toute récupération sur un compte.

## Mise en service et repli

1. Confirmer la cible et l’état des migrations, disposer d’un point restaurable
   et appliquer, après accord d’exploitation, la
   [migration additive](../../supabase/migrations/20261120092557_appearance_custom_colors.sql).
   Elle ajoute `color_mode` et `custom_color` avec palette saisonnière par
   défaut, sans UPDATE des données existantes. Conserver l’historique des
   révisions, les grants usuels et les politiques RLS de propriétaire.
2. Vérifier les lectures, les charges historiques et chromatiques et les
   révisions CAS, puis publier le frontend selon le
   [plan Pages](../deploiement/PLAN-PUBLICATION-2027.md). Auth et données réelles
   restent soumis à leur recette autorisée. Le frontend sait lire l’ancien
   schéma si la colonne manque. La synchronisation chromatique a besoin du RPC
   migré. Une opération chromatique prématurée reste en attente avec sa charge
   d’origine et repart quand le nouveau schéma est disponible. L’ITK continue
   à se synchroniser pendant cette attente.
3. Pour un repli du frontend après les premières écritures chromatiques,
   conserver une version du client qui comprend les nouvelles valeurs et
   l’outbox. Le JavaScript antérieur préserve un cache de format inconnu, mais
   peut rendre les paramètres de ce cache indisponibles. Garder les nouvelles
   colonnes et le RPC compatible lors du repli. Toute annulation SQL exige
   une nouvelle migration et une stratégie de préservation des couleurs.
   Éviter les effacements de caches et la réécriture des opérations en attente.

## Identité, réseau et limites

Chaque requête capture l’identité attendue, la génération et le JWT vérifié par le service Auth. Le transport fixe ce JWT pour l’appel et contrôle encore l’activité avant de confirmer le cache. Déconnexion, changement de compte ou rejet invalident les réponses tardives. Les opérations d’A restent dans sa portée et ne sont jamais envoyées avec la session de B.

L’identité locale fiable autorise la continuité pendant une panne conformément au contrat Auth existant. Elle n’autorise aucun envoi sans vérification serveur. BroadcastChannel demande seulement la relecture de la portée concernée ; les transactions sérialisent les onglets. Une reconnexion relance récupération et retry avec les identités originales.

Le cache personnel est non chiffré, conservé après déconnexion et exposé aux personnes ou extensions contrôlant le profil navigateur. Aucun service worker n’est ajouté : pages et modules doivent être disponibles pendant la panne API. Le calendrier, CSV et impression sont reconstruits localement ; aucun ancien document ITK complet n’est promis. Les procédures de conservation, export et suppression restent au lot 6.4, l’ouverture contrôlée au lot 6.5 et le générateur avancé au lot 7. Auth public reste désactivée. DEV/PROD ne sont jamais des cibles de ces recettes.
