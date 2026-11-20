# Corrections de prépublication Mon BPREA 2027

Campagne du 20 novembre 2026, [PR #79](https://github.com/Vladoche/mon-bprea/pull/79).
La [validation](VALIDATION-RECETTE-FINALE-2027.md) porte les résultats par environnement.

| ID | Gravité | Source | Symptôme et impact | Cause | Correctif | Reproduction | Confirmation | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R27-01 | P1 | PR #77 et notice V1.1 | La notice et des aides dirigent les participants vers des commandes de copie et de retrait absentes du profil 2027. Une demande de droits risque de rester sans suite. | Libellés et procédures antérieurs à la simplification du profil. | Notice V1.2 candidate et HTML régénéré. Contact et guides alignés sur le circuit assisté. Lien immuable vers la V1.1 dans la preuve historique. | Comparer les passages A à F à l’interface de `profil.html`, qui propose le compte, l’apparence et la synchronisation. | Test navigateur du profil et du contact, rendu public sous le préfixe Pages, aperçu sans JS et comparaison exacte par `--check`. | Correctif prêt pour revue. Approbation humaine en attente. |
| R27-02 | P2 | Chaîne de rendu de notice | Le générateur et l’aperçu continuaient à annoncer la V1.1 pour un nouveau texte. Un relevé pouvait attribuer l’empreinte à la mauvaise version. | Version codée dans le journal du script et dans l’encart de l’aperçu. | L’empreinte est affichée sans numéro codé en dur. L’aperçu affiche la version du Markdown et distingue revue du texte et décision de publication. | Générer la V1.2 avec l’ancien script. La sortie annonçait V1.1. Lors de la première passe Vitest, l’assertion héritée attendait encore ce libellé. | Test de génération sans dépendances, égalité du rendu, refus de l’ancienne empreinte et test de l’aperçu V1.2 rejoués. | Corrigé. |
| R27-03 | P2 | Fixture des liens Auth manuels et réserves PR5 | Les trois tests manuels avaient besoin du nom Docker canonique, déjà réservé par des volumes locaux. | Nom du conteneur figé dans la seule lecture de profil de la fixture. | La fixture accepte le nom borné d’une stack de recette neuve. Elle vérifie toujours le moteur Docker local, le label et le port avant la lecture. | Le diagnostic de #78 identifie les trois parcours concernés et l’adaptation locale alors nécessaire. | Rejeu avec `SUPABASE_TEST_DOCKER_PROJECT` sur le conteneur fictif. La CI conserve le nom canonique. | Correctif de test uniquement. |
| R27-04 | P2 | PR #78 et laboratoire de performances | Les interactions du catalogue synthétique à 600 fiches peuvent dépasser leur budget. | Le scénario de charge dépasse déjà certains seuils sur la version de référence. | Mesure comparative sur catalogue officiel, puis fixture de charge. | Rejouer le laboratoire avec et sans `--large-catalog`. | Chiffres et périmètre dans la [validation](VALIDATION-RECETTE-FINALE-2027.md#performance). | Réserve de capacité suivie dans la validation. |
| R27-05 | P2 | Répétition de mise à niveau locale | Une navigation sans rechargement réutilise l’ancien HTML du profil, dont les commandes diffèrent. | L’en-tête de cache du banc conserve l’HTML déjà visité. Les URL versionnées s’appliquent au chargement du document. | Inscrire la revalidation du document dans la recette et la procédure de publication. | Ouvrir le profil de la version publiée, servir le candidat sur la même origine, puis revenir au profil sans rechargement. | Après rechargement, profil 2027 et références du candidat. File historique confirmée sur la stack locale. | Limite de cache documentée. |
| R27-06 | P2 | Rejeu Chromium Windows | Le premier contrôle de bordure QCM obtient 2,68:1 au lieu du minimum de 3:1. | La trace n’a aucune réponse pour la feuille de styles dédiée, alors que les autres CSS ont répondu. L’origine de cette perte isolée reste indéterminée. | Diagnostic de chargement de la feuille et confirmation de la palette sur l’artefact. | En bloquant seulement cette feuille dans la fixture, on retrouve exactement 2,68:1. | La feuille chargée donne 5,17:1. Seize rejeux ciblés du contrôle des huit palettes réussissent. | Incident de recette, absent des rejeux ciblés. |

## Diagnostic du contraste QCM

Au rejeu Windows de la suite, la trace Playwright donne le statut `-1` pour
`course-quiz-page.css?v=e2e-lot5-1` et 200 pour les autres feuilles. La
case radio est cochée. Le diagnostic local retrouve le style générique
(bordure `#829880`, fond `#f2eee3`) en bloquant seulement cette requête.
Avec la feuille dédiée servie, la même option cochée utilise une bordure
`#954a32` sur fond `#f4e5dc`. Le rejeu `--repeat-each=16 --workers=2`
du scénario de contraste vérifie les huit palettes et leurs états.
La trace et les captures du défaut sont conservées avec les résultats
locaux synthétiques.

## Notice V1.2 candidate — modifications soumises à approbation

**EN ATTENTE D’APPROBATION EXPLICITE DE L’EXPLOITANT.** Le 20 novembre 2026 date
le texte candidat. L’empreinte SHA-256 LF candidate est
`097bf1e94fe869940d286f78b9900d28f02e13fecc9b08680068ef2a56d2dc57`.
La V1.1 du 8 novembre, empreinte
`c2b2422b9c3d6b7ec25227f143080782842c4c077f5a1361d4cd36653ad9b8c1`,
reste celle approuvée et servie au relevé. [Source V1.1 au SHA publié](https://github.com/Vladoche/mon-bprea/blob/3952fd5a98705397bb341dc1fa54e0e8f92979d8/docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md) · [Source V1.2 candidate](../rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md) · [Rendu généré](../../confidentialite.html).

| Passage | V1.1, repère dans le texte approuvé | V1.2, changement | Justification pour les participants |
| --- | --- | --- | --- |
| En-tête | « Version 1.1 · 8 novembre 2026 » | « Version 1.2 · 20 novembre 2026 » | Identifier le nouveau texte et rattacher toute décision à sa propre empreinte. |
| A · Stockage, anciennes clés | « Le profil permet de rechercher les sauvegardes locales, de les exporter et de les retirer par catégorie, y compris les anciennes. » | Retrait de cette phrase. Les anciennes clés, leur reprise et l’examen d’import restent décrits. | Les données historiques peuvent toujours être présentes et utiles à la reprise. |
| B · Stockage, effacement local | « L’effacement local par catégorie se fait depuis le profil sur l’appareil concerné. Il peut laisser un marqueur minimal qui empêche un ancien onglet de recréer les données. » | Indique le retrait de la commande avancée et le chemin par les réglages du navigateur. Demande de vérifier copies et synchronisation, puis de fermer les onglets. | Éviter la perte de progression en attente et préciser la portée locale du retrait. La déconnexion conserve la progression. |
| C · Stockage, provenance | « Le profil permet de retirer séparément un identifiant de provenance et la sauvegarde visiteur. » La suite décrivait le retrait du cache et les exclusions de l’export ordinaire du profil. | Garde l’effet du retrait d’un identifiant et la présence de preuves dans le cache. Oriente vers le responsable en cas d’attribution incertaine sur appareil partagé. | Préserver l’information sur les preuves d’import et les copies locales de tiers. |
| D · Sauvegardes et export | « L’export JSON du profil fournit une copie des données applicatives disponibles et de certains éléments locaux. Les données du mode visiteur s’exportent séparément. » | La copie se demande au responsable. L’appareil et le contexte visiteur peuvent aider à identifier la source. Un ancien JSON peut omettre les journaux et certains détails du compte. | Garder le droit d’accès effectif et expliquer la portée des anciennes copies. Les téléchargements et impressions restent sous le contrôle de leur détenteur. |
| E · Vos droits, portabilité | « Les conditions du droit à la portabilité s’apprécient séparément de l’export JSON volontaire. » | Précise que le droit d’accès permet de demander une copie et que la portabilité répond à ses propres conditions. | Le changement d’interface laisse l’exercice des droits accessible via le même canal. |
| F · Vos droits, clôture | « Pour demander la clôture, écrivez au responsable. Il vérifie votre identité de façon proportionnée, vous propose un export et traite la fermeture du compte et la suppression des données actives. » | Explicite les demandes d’effacement et de clôture, la vérification proportionnée, la proposition de copie et l’assistance locale. Les sauvegardes et copies résiduelles suivent leurs règles propres. | Le titulaire sait à qui écrire et ce qui doit être traité par appareil, côté service et dans les copies. Le recours CNIL demeure indiqué. |

Pour le diff intégral des paragraphes, exécuter depuis la racine
`git diff 3952fd5a98705397bb341dc1fa54e0e8f92979d8 bacb6832f00946f4927f98c0d5a904b27b1b1ac4 -- docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md`.
Les finalités R01 à R05, bases, fournisseurs, transferts, durées, échéances
2027 et sauvegardes hebdomadaires reprennent le texte approuvé. La révision
conserve l’information sur caches, conflits et provenance. Le traitement effectif
des demandes, l’attribution des copies locales et l’application des durées
résiduelles relèvent du [circuit opérateur](../rgpd/PROCEDURE-DEMANDES-ET-INCIDENTS-PROJET.md).
Le responsable vérifie la faisabilité de ce circuit avant décision. Pour les
droits d’accès, d’effacement et de portabilité, voir les articles 15, 17 et 20.
[Texte du RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra) · [Droit d’accès, CNIL](https://www.cnil.fr/fr/comprendre-mes-droits/le-droit-dacces-connaitre-les-donnees-quun-organisme-detient-sur-vous).

## Fiche d’approbation

1. Relire les passages A à F, les droits et le circuit assisté puis vérifier
   l’adresse officielle, la proposition de copie avant clôture et les limites de
   reprise et de retrait des copies. Consulter le rendu sans compte.
2. Depuis le SHA retenu, exécuter `node scripts/build-privacy-notice.mjs --check`
   et vérifier que l’empreinte est celle du texte relu. Toute modification du
   Markdown nécessite une nouvelle empreinte et une nouvelle décision.
3. Consigner en privé l’exploitant, la date réelle, le SHA complet, la version,
   l’empreinte LF et la décision **approuver**, **demander une modification**
   ou **refuser**. Pour une approbation, indiquer expressément que la décision
   porte sur ce texte et cette empreinte.
4. Inscrire la référence de cette décision dans la phase A du
   [plan de publication](../deploiement/PLAN-PUBLICATION-2027.md). L’autorisation
   de déclencher le workflow se consigne séparément.

| Champ | Valeur actuelle |
| --- | --- |
| Version et empreinte | V1.2 candidate · `097bf1e94fe869940d286f78b9900d28f02e13fecc9b08680068ef2a56d2dc57` |
| Décision, date et preuve | En attente d’approbation explicite de l’exploitant |
| SHA de publication | À sélectionner après revue |
