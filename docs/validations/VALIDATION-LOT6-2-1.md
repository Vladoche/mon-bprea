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

**Migration DEV non appliquée ; simulation réussie après les tests réels.** Le connecteur a confirmé le projet **Mon BPREA DEV**, référence `wcckbyhrtroittbfophv`, région `eu-west-1`, état `ACTIVE_HEALTHY`, PostgreSQL 17.11. L'historique contient uniquement `20261022000100 / profiles` et les trois tables Drill sont absentes. Aucun test RLS n'a été redirigé vers DEV.

Après consultation de `db push --help`, la CLI **2.121.0** a exécuté avec code 0 :

```text
supabase db push --project-ref wcckbyhrtroittbfophv --dry-run --skip-vault
```

La sortie confirme `dryRun:true` et exactement **`20261024083417_create_drill_sync_schema.sql`**, sans seed ni rôles supplémentaires. Vault est explicitement exclu. Une nouvelle lecture de l'historique après simulation confirme que seule la migration des profils reste appliquée.

Les conseillers DEV ne signalent aucun lint de performance. Le seul avertissement sécurité est celui déjà connu, [protection contre les mots de passe divulgués désactivée](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) ; aucun réglage Auth ni achat n'a été effectué.

L'application effective reste soumise à l'accord explicite prévu par le [contrat du lot](../architecture/DRILL-SYNCHRONISATION-BACKEND.md). La commande préparée est `supabase db push --project-ref wcckbyhrtroittbfophv --skip-vault --yes`, depuis cette branche et après une dernière relecture de la simulation. Aucun changement de PROD, d'Auth/SMTP ou des comptes fictifs existants n'a été réalisé.

## Livraison et actions restantes

Les preuves SQL/API/concurrence et la simulation DEV sont obtenues ; la PR reste en brouillon. Prochaine étape : obtenir l'autorisation d'appliquer cette seule migration sur DEV, puis relire son historique, les tables, RLS, privilèges et conseillers. Cette validation ne constitue pas une autorisation de fusion, de modification du ruleset ou de publication publique. La synchronisation frontend reste au lot 6.2.2.
