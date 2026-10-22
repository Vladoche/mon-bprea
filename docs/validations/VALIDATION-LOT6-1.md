# Validation — Authentification et sécurité (lot 6.1)

Préparation le **22 octobre 2026**, sur `feature/authentification-lot6-1`, créée depuis `origin/main` au commit `f6e99b3`. Ce commit fusionne la PR nº 8 du lot 5.2 ; son intégration a été vérifiée avec `git merge-base --is-ancestor`. Le dépôt était propre avant intervention. Aucune donnée locale préexistante n’a été supprimée.

## Livraison et périmètre

Le site reste statique, avec ses trois rubriques et toutes ses URL historiques. Quatre pages HTML sont ajoutées : connexion, activation/récupération, mot de passe oublié et profil. Un client Supabase par document et un service partagé avec le header restaurent et contrôlent les sessions. Le SDK **2.118.0**, verrouillé, est servi localement ; `esbuild` **0.28.2** ne sert qu’à sa préparation. La configuration suivie reste désactivée et ne contient aucun identifiant.

La migration [`20261022000100_profiles.sql`](../../supabase/migrations/20261022000100_profiles.sql) crée `profiles` avec UUID Auth, pseudo facultatif et dates serveur. Le trigger de création est atomique avec Auth, ignore les métadonnées utilisateur et échoue explicitement en cas d’erreur. Sa fonction definer appartient à postgres, utilise un chemin vide et un schéma privé non exposé. Le pseudo seul est modifiable ; l’e-mail et les mots de passe restent dans Auth.

RLS et privilèges se complètent :

- `profiles_select_own` permet à `authenticated` de lire uniquement `(select auth.uid()) = id`.
- `profiles_update_own` impose cette même condition dans `USING` et `WITH CHECK`, avec `UPDATE(pseudo)` seulement.
- Les visiteurs n’ont aucun privilège ; les étudiants ne peuvent insérer/supprimer ni modifier UUID ou dates. Aucun champ administrateur n’existe.

Les invitations natives doivent être envoyées depuis le Dashboard ou le service de confiance. Aucun formulaire public d’inscription ni panneau administratif n’est ajouté. Les modèles versionnés utilisent `token_hash` et le callback réel sous `/mon-bprea/`, avec nettoyage immédiat de l’URL, `no-referrer` et clic explicite avant `verifyOtp`. La définition du mot de passe exige une vérification de lien pour le même UUID. Aucune redirection fournie dans l’URL n’est utilisée.

Aucun exercice, résultat, ITK, Dashboard, historique botanique ou préférence n’est synchronisé. Les clés locales existantes sont préservées à la déconnexion. Le détail des environnements, commandes, réglages manuels et limites est dans [AUTHENTIFICATION.md](../architecture/AUTHENTIFICATION.md).

## Vérifications locales réellement exécutées

Poste Windows, Node.js **24.22.0**, npm **10.4.0**, Chromium Playwright. Les tests utilisent des données synthétiques et des contextes isolés ; aucune suite ne vise le site publié.

| Commande ou contrôle | Résultat constaté |
| --- | --- |
| `npm ci --fetch-retries=0 --fetch-timeout=20000` | Code 0, installation depuis le verrou |
| `npm run build:auth-sdk` | Code 0, fichier navigateur et licence MIT préparés |
| `npx playwright install chromium` | Code 0 |
| `npm test` | Dernier passage : **107 tests, 13 fichiers réussis**, code 0 |
| `npm run test:e2e` | **17 parcours Chromium réussis en 9,7 s**, code 0 ; cinq nouveaux parcours Auth sans mocks réseau |
| `python scripts/prepare-pages.py --version lot6-1-verification --output .tmp/lot6-1-verification/mon-bprea` | Code 0 : 90 fichiers publics, 190 références versionnées et `.nojekyll` conservé |
| `git diff --check` et `git check-ignore` | Code 0 ; configuration locale, environnement privé et fichiers temporaires Supabase ignorés |
| Inspection de l’artefact et recherche de clés secrètes/privées | Aucun secret détecté ; outils, fichiers privés et dossier Supabase absents de la copie publique |
| CLI `supabase@2.121.0 --version` | Code 0 : **2.121.0** |
| CLI `supabase@2.121.0 status --output json` | Code 1 : Docker et Podman absents ; aucune stack locale accessible |
| `npm run test:supabase` | Refus explicite sans confirmation/configuration de stack ; **aucun test Supabase exécuté sur ce poste** |
| `npm run test:e2e:supabase -- --list` sans configuration locale | Refus explicite du garde d’environnement, aucun scénario réel exécuté |
| Parsing TOML / `node --check` | Syntaxe de configuration et scripts vérifiée |
| Requête HTTP HEAD sur `https://vladoche.github.io/mon-bprea/` | HTTP 200, URL finale identique ; contrôle d’adresse uniquement, aucun test de production |

Un passage intermédiaire a exécuté 23 parcours dont 11 contrats HTTP simulés. Ces contrats ont été remplacés par des tests sans mocks Auth pour respecter l’exigence du lot : les simulations restent réservées aux unités. Les parcours connectés sont dans la suite séparée avec Supabase réel. Ce résultat intermédiaire n’est pas utilisé comme preuve de validation finale ou de sécurité.

Le SDK tiers généré contient des blancs significatifs à l’intérieur de chaînes multilignes ; `.gitattributes` désactive uniquement le contrôle des blancs sur ce fichier pour éviter de modifier ces chaînes. Le contrôle CI de reconstruction depuis les dépendances verrouillées vérifie son contenu exact. `git diff origin/main --check` passe avec cette exception ciblée.

Les unités couvrent champs, réponses SDK incomplètes, erreurs sans détails sensibles, restauration vérifiée par Auth, réseau indisponible, sessions invalides, changements de compte, renouvellement pendant une lecture et absence de réapparition d’une réponse tardive après déconnexion. L’autorisation de changement du mot de passe est liée au compte du lien et ne survit pas à un changement de compte. Les tests d’artefact exécutent réellement le préparateur Python : publication des pages/imports versionnés, configuration locale appliquée seulement à la copie, refus des clés administratives/legacy et champs supplémentaires avant création de sortie.

## Vérification visuelle

Inspection effective sur serveur local isolé : connexion sur ordinateur 1280 px et mobile 390 px, automne clair et hiver sombre, profil indisponible, lien invalide, formulaire d’activation/récupération et profil connecté. Les vues connectées ont été inspectées avec un service factice pour le rendu uniquement, sans les assimiler à un essai Supabase. Les captures ignorées sous `.playwright-mcp/` ont été inspectées ; aucun débordement horizontal ni erreur de console relevé. Les données privées sont insérées avec `textContent`/`value` ; les vues privées et champs de mot de passe sont effacés lors d’une sortie vers le cache navigateur.

## Sécurité réelle et CI

La suite de sécurité est préparée avec **Supabase CLI 2.121.0** et PostgreSQL 17 :

- pgTAP : 19 contrôles structurels sur RLS, privilèges de colonnes, accès anonyme et fonctions privées.
- `scripts/test-supabase.mjs` : deux comptes fictifs invités, mails capturés, activation dans un contexte neuf, inscription API refusée, isolation A/B, pseudo modifiable, colonnes techniques protégées, contraintes, métadonnées et JWT falsifiés, récupération, usage unique, logout/refresh et vraies expirations.
- `tests/e2e-supabase/auth.spec.js` : parcours navigateur réel d’invitation/activation, connexion, profil/pseudo, rechargement, déconnexion, conservation locale et récupération. Les réponses Auth/PostgREST ne sont pas simulées ; seul le JSON de configuration publique est fourni au navigateur.

Le workflow distinct **Sécurité Auth et RLS**, job `supabase-security`, utilise une stack Docker éphémère locale au runner. Les seules clés sont générées pour cette stack, capturées hors journaux et masquées avant usage. La clé administrative ne va jamais dans la page. Traces, vidéo et captures des E2E réels sont désactivées ; seul le compte synthétique créé par le run peut être nettoyé. Les comptes étudiants et projets distants sont interdits par les gardes d’environnement.

La [PR nº 9](https://github.com/Vladoche/mon-bprea/pull/9) est ouverte en brouillon vers `main`. **Au lancement de la PR, ces tests réels ne sont pas encore validés.** La réussite des unités et des E2E autonomes ne démontre pas RLS. Les résultats CI doivent être consignés ici avant de lever cette réserve. Les jobs obligatoires `unit-integration` et `e2e` et le ruleset de `main` sont conservés. Aucune fusion ni publication n’est autorisée par cette livraison.

Premier [run de sécurité](https://github.com/Vladoche/mon-bprea/actions/runs/39829500314) : stack réelle démarrée, **19 contrôles pgTAP réussis**, refus des inscriptions publiques et connexions anonymes vérifié, deux invitations reçues/activées et liens invalides/réutilisés refusés. La connexion par mot de passe a ensuite échoué : `auth.email.enable_signup=false` désactivait le fournisseur e-mail entier dans cette version CLI. La configuration est corrigée pour conserver ce fournisseur avec `true` tout en gardant `auth.enable_signup=false`. Le runner exige toujours le code exact `signup_disabled` pour une création libre. Ce premier run partiel ne valide pas l’ensemble du lot ; une nouvelle exécution complète est requise.

Deuxième [run de sécurité](https://github.com/Vladoche/mon-bprea/actions/runs/39829999777) : les **19 contrôles SQL et les dix premiers groupes API réels passent**, dont connexion, isolation A/B, pseudo, colonnes techniques, contraintes Unicode/contrôles, JWT falsifié, récupération et révocation du refresh. Le dernier groupe révèle une attente d’expiration trop courte : PostgREST tolère officiellement 30 secondes de décalage sur `exp`. Le test est corrigé pour attendre `exp + 30 s + 2 s`, puis exiger un HTTP 401 avec `PGRST303`, sans accepter un simple échec serveur. Cette marge est documentée et aucun contrôle de signature/RLS n’est assoupli.

## Interventions et limites avant ouverture

Créer/configurer un projet DEV séparé de PROD, appliquer les migrations versionnées et contrôler ses réglages Auth : inscriptions et connexions anonymes désactivées, minimum de mot de passe, URL exactes sans wildcard et modèles d’e-mail. Le fichier `config.toml` ne modifie aucun projet hébergé. Le workflow Pages continue de publier la configuration désactivée tant qu’une activation n’a pas été autorisée.

Le SMTP Supabase par défaut n’est pas prévu pour accueillir la promotion. Un SMTP adapté, domaine d’envoi et essais contrôlés sont nécessaires. Aucun camarade n’a été invité. Les informations juridiques, durées de conservation, droits et procédures du lot 6.4 restent à finaliser avant comptes réels ; l’ouverture attend la validation du lot 6.5.

La session persistante reste exposée aux risques XSS et appareil partagé. Un access token déjà émis demeure valable jusqu’à son expiration après logout, avec la tolérance de 30 secondes de PostgREST ; le SDK révoque le refresh de la session locale. Le lien à usage unique figure dans la première requête HTTP avant nettoyage JavaScript et peut donc apparaître dans les journaux d’infrastructure. Ces limites sont documentées, sans revendication de révocation JWT instantanée ou de conformité juridique définitive.
