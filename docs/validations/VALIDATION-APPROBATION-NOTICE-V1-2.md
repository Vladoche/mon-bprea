# Validation de l’approbation de la notice V1.2

**Preuve datée de prépublication.** Les verdicts ci-dessous décrivent le
relevé de la campagne initiale. Le [registre Pages](../deploiement/EXPLOITATION-PRIVEE.md#registre-de-publication-pages)
consigne les lancements qui ont suivi et le [plan de publication](../deploiement/PLAN-PUBLICATION-2027.md)
porte les conditions du prochain lancement.

**20 novembre 2026, heure de Paris (CET).** Approbation de la notice **enregistrée**.
Préparation **GO PARTIEL**. Publication **non autorisée**.

## Notice contrôlée et décision

| Contrôle | Résultat |
| --- | --- |
| Référence synchronisée | `origin/main` à `bb3514efecbc4edd85b7e3f3fde90bb5d69ed458`, fusion de [#79](https://github.com/Vladoche/mon-bprea/pull/79) le 20/11/2026 à 07:09:33 UTC. |
| Branche et worktree | Départ sur `codex/recette-finale-2027`, worktree propre. Branche `codex/approbation-notice-v1-2` créée sur ce `origin/main`, worktree propre avant contrôles. |
| Source | [Source V1.2 au commit vérifié](https://github.com/Vladoche/mon-bprea/blob/bb3514efecbc4edd85b7e3f3fde90bb5d69ed458/docs/rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md), « Version 1.2 · 20 novembre 2026 ». |
| SHA-256 LF attendu | `097bf1e94fe869940d286f78b9900d28f02e13fecc9b08680068ef2a56d2dc57` |
| SHA-256 LF recalculé | `097bf1e94fe869940d286f78b9900d28f02e13fecc9b08680068ef2a56d2dc57` |
| Comparaison | Les **64 caractères** concordent. Calcul indépendant sur les octets du fichier et du blob de `origin/main`, après conversion des CRLF en LF. |
| Décision du responsable | **APPROUVÉE**, par instruction explicite de l’exploitant à Codex, enregistrée le **20 novembre 2026 à 08:27:51 CET**. |
| Preuve | `NOTICE-V12-20261120`. Déclaration originale conservée dans le dossier opérateur privé prévu par le projet. Fichier créé sans écrasement, relu et confirmé ignoré par Git. Propriétaire courant et ACL vérifiées sur le dossier et le fichier, accès limités au profil opérateur, à SYSTEM et aux administrateurs locaux. |
| Portée | Texte exact de la notice uniquement. Déploiement, opérations Supabase PROD, invitations et création ou suppression de compte exclus de la décision. |

Le texte et son HTML figurent sur `main` depuis la fusion de #79.
La trace documentaire de la décision est proposée dans la
[PR #80](https://github.com/Vladoche/mon-bprea/pull/80).
Le SHA de publication devra être choisi sur `main` après son intégration.

## Contrôles techniques

| Périmètre | Exécution et résultat |
| --- | --- |
| Rendu et empreinte | `node scripts/build-privacy-notice.mjs --check` réussi. Le générateur imprime la même empreinte et vérifie l’égalité du HTML versionné avec le rendu du Markdown. La version est visible dans la page. Sources conservées à l’identique. |
| Contenu | Conditions d’accès, finalités, données locales, conservation, sauvegardes, limites de reprise, droits et recours CNIL présents. Le texte dirige les demandes de copie, d’effacement et de clôture vers le responsable. Aucun renvoi à une commande retirée, aucune donnée de participant ni secret. L’identité et le contact affichés sont ceux prévus pour l’information publique. |
| Liens et accessibilité | Validation des routes et des neuf ancres du sommaire sur l’artefact. Clavier et focus du lien d’évitement vérifiés. Contrôle visuel Chromium à 320 px en sombre sans JavaScript et 1 280 px en clair, sans débordement. Accès direct sans compte. Les cinq destinations externes de la notice, dont la plainte CNIL, répondent en HTTP 200. Contact répond en HTTP 200 et le lien `mailto:` correspond à l’adresse officielle. |
| Profil | Les tests confirment l’absence d’export et de restauration JSON, d’effacement avancé et de clôture autonome. Contact et confidentialité restent accessibles. Pseudo, apparence, suivi de synchronisation et confirmations distantes testés avec le transport simulé, y compris retard et changement de compte. |
| Artefact Pages | `python scripts/prepare-pages.py --version bb3514efecbc4edd85b7e3f3fde90bb5d69ed458 --output .tmp/approval-v12-pages/mon-bprea`. 162 fichiers publics et `.nojekyll`, 342 références relatives versionnées, imports compris. Le HTML de la notice est identique après retrait des seuls suffixes de version du build. Inventaire conforme à la liste publique, exclusions et signatures de secrets contrôlées. Auth désactivée avec URL et clé vides pour ce build. La suite Chromium a aussi construit un artefact de forme PROD avec une clé fictive et des requêtes interceptées. |
| Intégration | **41 réussites** dans `pages-release.test.js`, `auth-artifact.test.js` et `preopening.test.js`. Contrôle du rendu, empreinte, préflight, exclusions et constructeur. Le rejeu hors bac à sable a levé un refus Windows de création de lien physique pour une fixture. |
| Navigateur | **30 réussites** dans `profile.spec.js`, `pages-production.spec.js`, `privacy-artifact.spec.js`, `contact.spec.js` et `appearance-preferences.spec.js`. Deux ouvertures supplémentaires de l’artefact au préfixe `/mon-bprea/`, en boucle locale, réussies. |

La campagne complète de #79, une restauration supplémentaire, l’envoi d’un
courriel réel, Safari, le lecteur d’écran natif et la recette 2027 authentifiée
hébergée n’ont pas été rejoués. Les contrôles Auth et SQL hébergés sont les
constats datés du dossier de préouverture. Le canal public Contact a été testé
jusqu’au lien de messagerie.

## Référence de publication

- **Branche cible** `main`. Référence technique contrôlée
  `bb3514efecbc4edd85b7e3f3fde90bb5d69ed458`, notice V1.2 et empreinte
  ci-dessus. La PR d’approbation porte uniquement des documents.
  [Checks de la tête de #80](https://github.com/Vladoche/mon-bprea/pull/80/checks).
- **Checks de #79** sur `a0074308aefebd146ce54f4d02646d18541df61b` :
  `unit-integration`, `e2e`, `ui-performance-lab` et `supabase-security`
  réussis. Ces workflows de PR n’ont pas exécuté de jobs sur le commit de
  fusion. [Checks #79](https://github.com/Vladoche/mon-bprea/pull/79/checks).
- **Pages servie** `3952fd5a98705397bb341dc1fa54e0e8f92979d8`,
  fin du dernier déploiement réussi le **8 novembre à 15:34:30 UTC**.
  Lecture publique du 20 novembre : HTTP 200 sur la notice et Contact, V1.1
  visible et références au même SHA. [Exécution Pages](https://github.com/Vladoche/mon-bprea/actions/runs/42495467393).
- **Diff publié → référence** : 100 commits et 308 fichiers, dont la refonte
  2027, le profil simplifié et la notice V1.2. Le dossier d’approbation
  s’ajoute à cet écart documentaire au moment de sa fusion.
  [Comparaison Git](https://github.com/Vladoche/mon-bprea/compare/3952fd5a98705397bb341dc1fa54e0e8f92979d8...bb3514efecbc4edd85b7e3f3fde90bb5d69ed458).
- **Déclenchement** manuel sur `main` via `workflow_dispatch`.
  Le workflow exige `publish_auth_production=true`, désactivé par défaut,
  et l’empreinte LF approuvée. Il vérifie le rendu et les paramètres publics
  avant construction et déploiement. [Workflow](../../.github/workflows/deploy.yml).
- **Retour arrière** : préparer une PR ciblée restaurant le périmètre public
  vérifié de la version de repli, y compris sa notice et son rendu. Refaire la
  répétition sous le même préfixe, préserver les données et les migrations,
  puis obtenir l’accord sur le nouveau SHA de `main`.
  [Procédure de repli](../deploiement/PLAN-PUBLICATION-2027.md#retour-arrière-frontend).
- **Après publication autorisée** : contrôler en visiteur la version, Contact,
  la notice, les routes et ressources, le callback sans preuve et les caches
  dans un navigateur neuf et un onglet existant. Sous mandat distinct,
  l’exploitant vérifie la connexion, les historiques et les confirmations
  distantes dans deux navigateurs. Reporter les résultats au registre.
  [Phase B](../deploiement/PLAN-PUBLICATION-2027.md#phase-b--exécution-future-sous-autorisation).

## Prérequis et réserves

| Point | État au 20 novembre et contrôle au lancement |
| --- | --- |
| Sauvegarde et journal | Relecture locale à **08:30:03 CET**, sans accès hébergé. Le dernier point du **18/11 à 13:09:16 CET**, restauré en isolement à **13:09:41 CET**, est frais au relevé. ACL et EFS contrôlés, empreintes du manifeste et de l’archive recalculées, journal courant concordant avec la preuve de restauration. Échéance **25/11/2026 à 13:09:16 CET**. Revalider le point, le journal, le schéma et les dépendances au lancement. |
| Limites de reprise | Preuve applicative sur dix tables. Auth complet, Storage, sessions, configuration, données uniquement locales et RTO restent hors preuve. [Qualification du 18 novembre](VALIDATION-PREMIERE-INVITATION-PROD.md). |
| Accès et Auth | Invitations uniquement, inscription publique et anonyme désactivées, e-mail avec confirmation. Site URL `https://vladoche.github.io/mon-bprea/`, callback unique `authentification.html` à cette racine. Vérifier les variables publiques `PAGES_SUPABASE_PROD_URL` et `PAGES_SUPABASE_PROD_PUBLISHABLE_KEY` et les surcharges Actions au lancement. Le plafond de sept comptes relève du circuit administratif. Récupération assistée via le contact et le callback commun. Les relevés PROD du 8 et du 18 novembre restent datés. La durée de lien de 24 h et le renouvellement réel ont leur propre périmètre de décision. [Contrat Auth](../architecture/AUTHENTIFICATION.md) · [Plan de publication](../deploiement/PLAN-PUBLICATION-2027.md). |
| Contact opérateur | Le canal public fonctionne jusqu’au `mailto:` et l’essai du 05/11 reste attesté. Le contrôle local `preopening -- contact` signale des preuves absentes dans le dossier pour la maîtrise de la boîte, sa protection, sa récupération, sa consultation et les dates de réception/réponse. Vérifier ces pièces avant lancement, le contact étant le canal d’exercice des droits. [Dossier opérateur et contact](../deploiement/EXPLOITATION-PRIVEE.md#dossier-opérateur-et-contact). |
| Réserves de recette | Safari et lecteur d’écran natif hors couverture. P2 sur les interactions du catalogue synthétique de 600 fiches, catalogue officiel dans le budget au relevé #79. Recette authentifiée hébergée à autoriser. [Recette finale](VALIDATION-RECETTE-FINALE-2027.md#performance). |

La [fiche d’approbation](CORRECTIONS-PREPUBLICATION-2027.md#fiche-dapprobation),
la [checklist](CHECKLIST-RECETTE-FINALE-2027.md), le
[plan](../deploiement/PLAN-PUBLICATION-2027.md), la
[spécification d’information publique](../rgpd/SPECIFICATION-INFORMATION-PUBLIQUE.md),
l’[état du projet](../developpement/ETAT-DU-PROJET.md) et le
[changelog](../../CHANGELOG.md#non-publié) reflètent la décision. Les preuves de
la campagne #79 restent datées de cette campagne.

Après revue et intégration du dossier, relever le SHA complet de `main` et
recalculer l’empreinte LF. Si le texte change, obtenir une nouvelle approbation.
Vérifier les changements et les prérequis, statuer sur les réserves et
l’information des personnes concernées, puis obtenir la décision explicite
sur la publication et sur le périmètre de la recette connectée.
