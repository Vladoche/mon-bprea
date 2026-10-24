# Validation — Backend PostgreSQL du Mode Drill (lot 6.2.1)

Préparation du **24 octobre 2026**, branche `feature/lot6-2-1-backend-drill` créée depuis `main` `abf9ddc61c1629846943a3a242253088921719e0`, après fusion de la PR #11. L'arbre de travail initial était propre. Aucune autre PR ouverte n'a été trouvée. Le ruleset actif `25489814`, consulté sans modification, exige désormais les trois contrôles `unit-integration`, `e2e` et `supabase-security`.

## Périmètre

Backend uniquement : séries hebdomadaires, premières réponses et entraînements, contraintes PostgreSQL, droits minimaux, RLS et contrat d'intégration. Le moteur Drill, ses clés locales, ses historiques et le Dashboard local restent inchangés. Aucune synchronisation JavaScript, file hors ligne, migration de données locales ou modification des pages HTML/CSS. Les brouillons restent locaux.

La migration `20261024083417_create_drill_sync_schema.sql` a été générée avec **Supabase CLI 2.121.0**, après consultation réelle de `migration new --help`. La migration `20261022000100_profiles.sql` du lot 6.1 reste intacte.

Le [contrat backend](../architecture/DRILL-SYNCHRONISATION-BACKEND.md) décrit l'audit du format `bprea-demo-drill-v1`, les tables, les opérations idempotentes, les conflits et les lectures prévues pour le lot 6.2.2.

## Vérifications locales et CI

| Vérification | État de préparation |
| --- | --- |
| Node.js 24.22.0 et `npm ci` | Exécutés avec succès |
| `npm test` | **107 tests réussis dans 13 fichiers**, 0 échec |
| `npm run test:e2e` | **17 parcours Chromium réussis**, 0 échec ; HTTP local et contextes isolés |
| Nouvelle migration et pgTAP | À vérifier dans la stack Supabase locale éphémère de CI |
| Runner Auth/RLS Drill réel | À vérifier dans la même stack |
| Tests du lot 6.1 | Conservés ; à revalider avec la nouvelle migration |
| Docker sur ce poste | Absent ; aucune exécution locale réelle Supabase revendiquée |

Le nouveau runner `scripts/test-drill-supabase.mjs` est intégré au job existant `supabase-security`, sans retirer les contrôles du lot 6.1. Les gardes imposent la stack `mon-bprea-lot6-1-local`, les endpoints de boucle locale et ses seules clés locales. Les tests ne doivent jamais être redirigés vers DEV ou PROD. Le nettoyage vise exclusivement les utilisateurs fictifs créés par chaque run dans cette stack éphémère.

## Supabase hébergé

**Migration DEV non appliquée à ce stade.** L'identification des projets, la relecture de l'historique DEV et la simulation précéderont une demande d'autorisation explicite, après réussite des tests réels. Aucun changement de PROD, d'Auth/SMTP ou des comptes fictifs existants n'est autorisé par cette préparation.

## Livraison et actions restantes

Finaliser les preuves SQL/API et les scénarios de concurrence dans la CI de la PR, puis préparer la simulation DEV. Aucune fusion, modification du ruleset ni publication publique ne sera effectuée.
