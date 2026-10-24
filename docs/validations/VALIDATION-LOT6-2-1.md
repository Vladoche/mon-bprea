# Validation — Backend PostgreSQL du Mode Drill (lot 6.2.1)

Préparation du **24 octobre 2026**, branche `feature/lot6-2-1-backend-drill` créée depuis `main` `abf9ddc61c1629846943a3a242253088921719e0`, après fusion de la PR #11. L'arbre de travail initial était propre. Aucune autre PR ouverte n'a été trouvée. Le ruleset actif `25489814`, consulté sans modification, exige désormais les trois contrôles `unit-integration`, `e2e` et `supabase-security`.

## Périmètre

Backend uniquement : séries hebdomadaires, premières réponses et entraînements, contraintes PostgreSQL, droits minimaux, RLS et contrat d'intégration. Le moteur Drill, ses clés locales, ses historiques et le Dashboard local restent inchangés. Aucune synchronisation JavaScript, file hors ligne, migration de données locales ou modification des pages HTML/CSS. Les brouillons restent locaux.

La migration `20261024083417_create_drill_sync_schema.sql` a été générée avec **Supabase CLI 2.121.0**, après consultation réelle de `migration new --help`. La migration `20261022000100_profiles.sql` du lot 6.1 reste intacte.

Le [contrat backend](../architecture/DRILL-SYNCHRONISATION-BACKEND.md) décrit l'audit du format `bprea-demo-drill-v1`, les tables, les opérations idempotentes, les conflits et les lectures prévues pour le lot 6.2.2.

## Vérifications locales et CI — reprise terminée le 24 octobre 2026

La reprise a conservé les neuf fichiers déjà préparés, puis corrigé les mentions périmées de `docs/TESTS.md` concernant les trois checks obligatoires et le déclenchement de sécurité sur toutes les PR. Livraison sur la [PR #12](https://github.com/Vladoche/mon-bprea/pull/12), en brouillon, commit d'implémentation **`759b95c8341328173e6ee6d96f016a300092835b`**. Les résultats ci-dessous proviennent d'exécutions réelles, relues dans les jobs GitHub.

| Vérification | Résultat exécuté |
| --- | --- |
| Node.js 24.22.0 et `npm ci` | Installation reproduite avec succès pendant la reprise, depuis le cache npm |
| `npm test` | **107 tests réussis dans 13 fichiers**, 0 échec ; relancés pendant la reprise |
| `npm run test:e2e` | **17 parcours Chromium réussis**, 0 échec ; HTTP local et contextes isolés, relancés pendant la reprise |
| Qualité CI | [`unit-integration`](https://github.com/Vladoche/mon-bprea/actions/runs/40095069072/job/120875476843) et [`e2e`](https://github.com/Vladoche/mon-bprea/actions/runs/40095069072/job/120875477160) réussis ; SDK navigateur verrouillé également vérifié |
| Nouvelle migration et pgTAP | Migration appliquée dans la stack éphémère ; **108 assertions SQL réussies dans 2 fichiers**, profils et Drill compris |
| Runner Auth/RLS Drill réel | **22 groupes réussis**, dont six scénarios de concurrence PostgREST réelle ; aucun échec |
| Régression réelle du lot 6.1 | **11 groupes Auth/profils/RLS réussis**, avec expirations réelles invitation/récupération/JWT ; **1 parcours navigateur Supabase réel réussi** |
| Sécurité CI | [`supabase-security`](https://github.com/Vladoche/mon-bprea/actions/runs/40095069008/job/120875476217) réussi, stack éphémère arrêtée avec succès |
| Docker sur ce poste | Absent ; aucune exécution locale réelle Supabase revendiquée |

Les 22 groupes Drill prouvent la création et relecture des snapshots, les retries exacts, les conflits sans écrasement, les contraintes de payload, le calcul serveur de correction, les refus de colonnes techniques/UPDATE/DELETE, l'isolation A/B et le refus d'un visiteur/JWT falsifié. Les six scénarios concurrents vérifient les créations identiques ou divergentes, deux premières réponses différentes, les retries de première réponse et d'entraînement, ainsi que deux entraînements distincts de contenu identique. Les requêtes directes PostgREST et la restitution en mémoire vers les lecteurs Drill/Dashboard existants réussissent aussi ; aucun client de synchronisation n'est livré.

La relecture indépendante de la migration et du runner n'a relevé aucun défaut concret ; `node --check scripts/test-drill-supabase.mjs` et les vérifications Git d'espaces passent. Aucun écran n'étant modifié, aucun nouveau rendu visuel n'est à valider dans ce lot backend. Les parcours Chromium existants ont bien été réexécutés ; cela ne constitue pas une inspection visuelle manuelle d'une nouvelle interface.

Le nouveau runner `scripts/test-drill-supabase.mjs` est intégré au job existant `supabase-security`, sans retirer les contrôles du lot 6.1. Les gardes imposent la stack `mon-bprea-lot6-1-local`, les endpoints de boucle locale et ses seules clés locales. Les tests ne doivent jamais être redirigés vers DEV ou PROD. Le nettoyage vise exclusivement les utilisateurs fictifs créés par chaque run dans cette stack éphémère.

## Supabase hébergé

**Migration DEV appliquée avec succès le 24 octobre 2026, après accord explicite de l'utilisateur.** Le connecteur a confirmé le projet **Mon BPREA DEV**, référence `wcckbyhrtroittbfophv`, région `eu-west-1`, état `ACTIVE_HEALTHY`, PostgreSQL 17.11. Avant l'application, l'historique contenait uniquement `20261022000100 / profiles` et les trois tables Drill étaient absentes. Aucun runner de tests RLS n'a été redirigé vers DEV.

Après consultation de `db push --help`, la CLI **2.121.0** a exécuté avec code 0 :

```text
supabase db push --project-ref wcckbyhrtroittbfophv --dry-run --skip-vault
```

La sortie a confirmé `dryRun:true` et exactement **`20261024083417_create_drill_sync_schema.sql`**, sans seed ni rôles supplémentaires. Vault est explicitement exclu. Une nouvelle lecture de l'historique après cette simulation a confirmé que seule la migration des profils était alors appliquée.

L'utilisateur a ensuite autorisé l'application de cette seule migration sur DEV. Une dernière simulation identique a précédé la commande effective, exécutée avec **code 0**, sans seed ni rôles supplémentaires :

```text
supabase db push --project-ref wcckbyhrtroittbfophv --skip-vault --yes
```

Les vérifications après application sont des lectures de l'historique et des catalogues DEV ; les preuves comportementales A/B et concurrence restent celles de la stack locale éphémère de CI.

| Contrôle DEV après application | Résultat observé |
| --- | --- |
| Historique | `20261022000100 / profiles` et **`20261024083417 / create_drill_sync_schema`** |
| Nouvelle simulation | `upToDate:true`, `dryRun:true`, `migrations:[]` |
| Tables Drill | Trois tables présentes et vides ; aucune progression importée |
| RLS et politiques | Activée sur les trois tables ; deux politiques par table, SELECT et INSERT, liées à `(select auth.uid()) = user_id` pour `authenticated` |
| Droits visiteurs | Aucun droit de table ou de colonne pour `anon` |
| Droits étudiants | SELECT et INSERT sur les seules colonnes métier prévues ; aucun UPDATE/DELETE/TRUNCATE ni INSERT de propriétaire/date serveur/correction |
| RPC | Trois fonctions `SECURITY INVOKER`, `VOLATILE`, `search_path` vide ; EXECUTE uniquement pour `authenticated`, absent pour PUBLIC/anon/service_role |
| Guards et contraintes | Trois triggers actifs, fonctions privées invoker non exécutables par les rôles clients ; contraintes validées, clés uniques et FK composites conformes |
| Profils du lot 6.1 | RLS et politiques conservées ; seule la colonne `pseudo` reste modifiable ; schéma privé inaccessible aux étudiants |
| Données existantes | Deux comptes Auth et deux profils conservés ; aucun compte ni historique supprimé |

Les conseillers après application ne relèvent aucun problème SQL/RLS de sécurité. Le seul avertissement sécurité reste celui déjà connu, [protection contre les mots de passe divulgués désactivée](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Le conseiller performance relève seulement deux informations [index encore inutilisés](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), `drill_training_history_idx` et `drill_answers_activity_idx`, sur les tables neuves sans activité ; ils sont conservés pour les lectures prévues. Aucun réglage Auth/SMTP, achat ou changement de PROD n'a été effectué.

## Livraison et actions restantes

Les preuves SQL/API/concurrence sont obtenues et la migration DEV autorisée est appliquée puis auditée. Le lot 6.2.1 est livré dans la PR #12, qui reste en brouillon pour revue. Aucune fusion, modification du ruleset ni publication publique n'est effectuée. La prochaine étape de développement est la synchronisation frontend du lot 6.2.2 ; les limites Auth/e-mails des lots ultérieurs restent consignées dans les validations correspondantes.
