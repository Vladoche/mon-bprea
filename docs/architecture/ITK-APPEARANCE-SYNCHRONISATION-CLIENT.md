# ITK et apparence — synchronisation personnelle (lot 6.3.4)

Ce client clôture le périmètre fonctionnel 6.3 en consommant les deux singletons du [backend 6.3.1](PERSONAL-DATA-BACKEND.md). Il ne crée aucun document ITK et ne modifie ni SQL, RPC, RLS, privilèges de profil, catalogue ou moteur pédagogique. Les [preuves exécutées](../validations/VALIDATION-LOT6-3-4.md) distinguent les tests applicatifs des recettes PostgreSQL/Auth réelles. Le [bilan 6.3](../validations/BILAN-LOT6-3.md) couvre aussi les domaines antérieurs.

## Architecture et sources

Les deux domaines partagent `settings-model.js`, `settings-store.js`, `settings-transport.js` et `settings-service.js`. Ils réutilisent `createScopedRepository()` de `personal-idb.js`, la portée validée du Drill, le backoff de `sync-runtime.js`, le client Supabase et le service Auth communs. Aucune dépendance de production n’est ajoutée. Les moteurs et services Drill, cours/QCM, botanique et leurs historiques restent indépendants.

| Source | Données |
| --- | --- |
| `bprea-demo-itk-v1` | Dernier formulaire visiteur : huit chaînes, sans date ni identité de projet |
| `bprea-demo-appearance-v1` | Choix visiteur v1, champs inconnus et archives éventuelles |
| `bprea-demo-theme-v1` | Ancienne chaîne brute clair/sombre ; reprise seulement en absence du document v1 |
| IndexedDB `mon-bprea-settings-personal-v1`, store `accounts` | Dernières valeurs personnelles fiables, lignes serveur, opérations, dépendances, conflits, imports et dernière réconciliation |

La clé personnelle est la sérialisation de `[environnement, origineSupabase, UUIDAuth]`. Les caches ne sont jamais sélectionnés par e-mail ni à partir d’une variable CSS. Aucun JWT n’est conservé dans IndexedDB. Les clés historiques restent intactes lors de la connexion, de l’import et de la déconnexion.

## Contrats et validation

`personal_save_itk(p_parameters,p_operation_id,p_expected_revision)` reçoit exactement les chaînes `crop,variety,cover,area,month,year,soil,water`. Le catalogue réel `content.js` valide culture et variété ; conduite, sol, eau, surface entière de 1 à 100 000, mois de 1 à 12 et année contractuelle 2026–2033 sont contrôlés. Le contrat accepte une notation décimale/exposant de surface représentant un entier et conserve sa chaîne. Types, taille et champs sont contrôlés avant sauvegarde personnelle et import.

Les replis utilisés pour afficher un ancien formulaire ne valident jamais son document d’origine. Un import invalide explique son refus et conserve la source. Les années du contrat sont fixes : le passage du temps ne rend pas une valeur 2028 invalide et ne justifie aucune modification SQL. Une future interface proposant des années au-delà de 2033 nécessitera une évolution distincte du contrat ; ce lot ne la réalise pas.

`personal_save_appearance(p_preferences,p_operation_id,p_expected_revision)` reçoit `{version:1,season,brightness}` et éventuellement `updatedAt`. Les saisons sont `auto|spring|summer|autumn|winter`, les luminosités `auto|light|dark`. Une date source absente reste absente ; aucune date legacy n’est inventée. Les archives/champs inconnus sont conservés dans la source d’import, pas envoyés comme champs RPC.

Les RPC retournent `{status,row}` avec `inserted|updated|replayed|conflict`. Le client contrôle propriétaire, schéma, types, UUID, contenu et base/révision attendue avant confirmation. Une réponse incohérente n’acquitte rien. Une erreur de lecture n’est jamais interprétée comme un singleton absent.

## Atomicité, opérations successives et CAS

Chaque choix personnel crée dans une transaction IndexedDB une valeur et une opération contenant UUID durable, payload exact, révision attendue et dépendance éventuelle. Le succès local attend `transaction.oncomplete`. Quota, cache futur/illisible ou échec du `put` donnent une erreur explicite, sans succès fictif ni remise à zéro.

Les modifications successives d’un même domaine suivent une chaîne de révisions. Une intention jamais préparée pour envoi (`attempts:0`) peut être remplacée par une nouvelle intention sur sa même base, avec nouvel UUID ; l’ancienne est archivée comme supersédée sans livraison. Dès qu’une livraison est possible, son payload reste immuable et la suivante dépend de sa confirmation avec une base augmentée. Plusieurs intentions ne sont pas envoyées indépendamment avec la même base. Le retry après timeout ou perte d’acquittement conserve strictement UUID, payload et base. Une ancienne intention potentiellement livrée n’est jamais réécrite ni automatiquement rattachée à une autre révision.

Une concurrence conserve la version du compte et l’intention locale. Elle suspend les dépendants du domaine concerné. Les deux choix proposés sont « Garder la version du compte » et « Utiliser mon choix enregistré sur cet appareil ». Le second crée une nouvelle intention avec nouvel UUID sur une base distante fraîche, uniquement après l’action explicite. Les huit paramètres ITK sont un tout ; aucune fusion champ par champ n’est réalisée. `updatedAt` n’arbitre jamais un conflit.

Les singletons SQL ne gardent que leur dernier reçu. Une opération acceptée puis remplacée peut donc revenir en conflit après perte HTTP ; elle ne redevient jamais une intention nouvelle par simple affichage ou retry. Le cache conserve huit reçus confirmés non nécessaires aux dépendances, huit conflits résolus et vingt archives diagnostiques, avec compteur des archives plus anciennes. Les deux dernières preuves d’import restent séparées par domaine. Les opérations actives, livraisons incertaines et conflits non résolus ne sont pas purgés au détriment de leur reprise. Aucun historique documentaire ou pédagogique illimité d’apparence n’est créé.

## Initialisation du thème et choix automatiques

`theme-init.js` reste un script classique synchrone avant CSS. Il applique immédiatement les préférences locales de l’appareil ou les valeurs automatiques, sans attente réseau. Ce rendu provisoire n’est pas une préférence personnelle vérifiée. L’adaptateur asynchrone de `appearance.js` attend l’identité Auth puis applique seulement le cache de cette identité et les valeurs réconciliées. Une identité absente/rejetée retire les préférences privées de la vue ; un autre compte ne reçoit jamais le cache précédent.

L’API `window.BpreaAppearance` reste compatible avec ses consommateurs. Pour un compte vide, le rendu provisoire peut conserver les choix de l’appareil mais le modèle personnel éditable commence en `auto/auto` : aucun choix visiteur n’est importé ni présenté comme confirmé. Le service distingue modification utilisateur et application d’une valeur reçue, afin de ne pas enregistrer à nouveau une préférence lors d’une réconciliation. Les événements visuels ne créent aucune opération réseau. Les minuteurs et retours sur la page recalculent uniquement le rendu.

`auto` reste `auto` sur Supabase et dans le cache personnel. Saison civile, heure locale, changements d’heure et plages matin/jour/crépuscule/nuit sont résolus séparément sur chaque appareil par les règles existantes de [THEMES.md](THEMES.md). Les attributs `data-season`, `data-time`, `data-theme` sont dérivés ; aucun UUID, token ni identité ne figure dans les données CSS. Deux appareils de jour et de nuit peuvent donc afficher des thèmes différents avec les mêmes préférences.

## Formulaires, messages et imports volontaires

`itk-personal-ui.js` suit séparément la valeur chargée, le formulaire modifié et la dernière valeur disponible du compte. Une récupération tardive ne touche pas une saisie active, son focus, le résultat calculé ni les exports. Le bouton de restauration charge explicitement les paramètres ; il ne génère aucun calendrier. Un changement de compte retire en revanche les valeurs et résultats privés du compte quitté.

Le dialogue d’apparence conserve ses contrôles et le focus pendant les publications ordinaires. Ses messages distinguent choix temporaire, sauvegarde locale, attente, confirmation distante et erreur. « Synchronisé » exige une confirmation réelle. Le générateur peut calculer malgré un échec de persistance et annonce alors que ses paramètres ne sont pas sauvegardés.

Chaque domaine possède son aperçu et sa confirmation d’import. L’aperçu montre des paramètres lisibles, indique la provenance visiteur et la divergence avec le compte. La confirmation exige une lecture distante fraîche et une source inchangée ; un changement depuis l’aperçu invalide la décision. Le manifeste conserve source brute et preuve d’acceptation par domaine. Répéter une confirmation du même import ne crée pas une nouvelle opération. Aucun import ne résulte de la connexion. Un document inconnu ou invalide est conservé et refusé sans correction silencieuse ; le rendu courant n’est jamais une source d’import.

## Identité, réseau et limites

Chaque requête capture l’identité attendue, la génération et le JWT vérifié par le service Auth. Le transport fixe ce JWT pour l’appel et contrôle encore l’activité avant de confirmer le cache. Déconnexion, changement de compte ou rejet invalident les réponses tardives. Les opérations d’A restent dans sa portée et ne sont jamais envoyées avec la session de B.

L’identité locale fiable autorise la continuité pendant une panne conformément au contrat Auth existant. Elle n’autorise aucun envoi sans vérification serveur. BroadcastChannel demande seulement la relecture de la portée concernée ; les transactions sérialisent les onglets. Une reconnexion relance récupération et retry avec les identités originales.

Le cache personnel est non chiffré, conservé après déconnexion et exposé aux personnes ou extensions contrôlant le profil navigateur. Aucun service worker n’est ajouté : pages et modules doivent être disponibles pendant la panne API. Le calendrier, CSV et impression sont reconstruits localement ; aucun ancien document ITK complet n’est promis. Les procédures de conservation, export et suppression restent au lot 6.4, l’ouverture contrôlée au lot 6.5 et le générateur avancé au lot 7. Auth public reste désactivée. DEV/PROD ne sont jamais des cibles de ces recettes.
