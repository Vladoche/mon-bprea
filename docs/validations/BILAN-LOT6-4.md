# Bilan du chantier 6.4 — confidentialité et préouverture

**28 octobre 2026. Préparation technique distincte des décisions d'ouverture.** Ce bilan ne certifie pas la conformité RGPD et n'autorise ni 6.5, ni déploiement, ni invitation. Auth publique reste désactivée.

| Sous-lot | Livraison et preuve | Statut technique / limite |
| --- | --- | --- |
| 6.4.1 — inventaire/transparence | [PR #21 fusionnée](https://github.com/Vladoche/mon-bprea/pull/21), [validation](VALIDATION-LOT6-4-1.md) ; inventaire, flux/prestataires, registre, projet de politique, D01–D14 et screening | Documents préparés et audit local identifié ; aucune base légale, durée ou responsabilité approuvée |
| 6.4.2 — copie personnelle | [PR #22 fusionnée](https://github.com/Vladoche/mon-bprea/pull/22), [contrat](../architecture/EXPORT-DONNEES-PERSONNELLES.md), [validation](VALIDATION-LOT6-4-2.md) | Copie JSON volontaire, dix tables + quatre compléments normalisés, compte/visiteur distincts ; pagination, exclusions, générations et remise vérifiée. Globalement partielle, pas réponse juridique exhaustive |
| 6.4.3 — retrait/clôture/conservation | [PR #23 fusionnée](https://github.com/Vladoche/mon-bprea/pull/23), [contrat](../architecture/SUPPRESSION-DONNEES-PERSONNELLES.md), [validation](VALIDATION-LOT6-4-3.md) | Retrait local sélectionné et barrières v2 ; clôture réauthentifiée et cascades testées exclusivement en éphémère. Politique/JSON non validés et aucune purge active |
| 6.4.4 — recette/dossier final | [validation détaillée](VALIDATION-LOT6-4-4.md), [matrice](../rgpd/MATRICE-CONFORMITE-ET-PREUVES.md), [dossier P0/P1/P2](../rgpd/DOSSIER-PREOUVERTURE.md) | Scénarios A–E croisés, audit artefact/URL et cohérence documentaire. Résultats locaux et preuve CI finale distingués ; aucun état hébergé inféré |

Les résultats historiques #23 (376 unités/intégration, 67 Chromium, 386 pgTAP, 26 Chromium Supabase) appartiennent à sa tête `ec715f76…`, pas au nouveau code. La recette 6.4.4 conserve les suites et renforce les interactions copie/retrait/clôture ainsi que les refus de conservation. Les trois checks de sa **tête finale de PR**, leurs liens et SHA sont à consulter dans la description de cette PR ; la [validation 6.4.4](VALIDATION-LOT6-4-4.md) indique les exécutions et limites du poste sans Docker.

## Ce qui est préparé techniquement

- Les domaines Auth/profil, Drill/Dashboard, cours/QCM, botanique, ITK/apparence, caches/files/conflits/imports ont des contrats, tests et limites reliés aux preuves.
- La copie tient compte de la confidentialité A/B, de la cohérence bornée et des exclusions ; le retrait local ne promet pas supprimer serveur ou fichier déjà remis.
- La prévention de recréation serveur repose sur FK/cascades avec JWT résiduel ; celle des caches repose sur v2/epochs/générations et services coopérants. Ces protections et leurs preuves sont distinctes.
- Information publique future, procédure demandes/incidents, exercice fictif et portes de décision sont préparés. Aucune notice définitive, service hébergé de clôture, canal officiel ou purge n'est activé.

## Ce qui bloque l'ouverture

Les **D01–D14 restent non validées** : responsable et établissements, bases/finalités, public/effets, contact/droits, conservation, contrats/transferts, screening AIPD, accès opérateurs/incidents/restauration, information préalable et autorisations de mise en service. Les P0 du [dossier](../rgpd/DOSSIER-PREOUVERTURE.md) indiquent chaque pièce, fonction à désigner et intervention nécessaire. La conclusion AIPD reste suspendue ; ni dispense ni obligation n'est prononcée sans faits suffisants.

L'exploitant doit notamment disposer d'un service de suppression ou d'une alternative de droits réellement opérante, traiter les copies absentes et backups, et faire vérifier la configuration hébergée sous autorisation distincte. Le prototype refuse les origines hébergées ; ne pas enlever cette garde pour « préparer » l'ouverture.

Les durées restent nulles dans le JSON, le planificateur n'efface rien et la conservation sans échéance n'est pas déclarée conforme. Une copie partielle n'est pas la totalité des données détenues par les prestataires ; un UUID, une archive ou une barrière locale ne sont pas anonymes.

**État du passage à 6.5 : BLOQUANT.** Une préparation technique achevée après ses preuves CI finales peut coexister avec ce blocage. Aucune invitation étudiante, modification DEV/PROD, déploiement Supabase/Pages, activation Auth, fusion ou changement de protection n'est effectué dans 6.4.4.
