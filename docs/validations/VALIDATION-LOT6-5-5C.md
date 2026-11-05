# Validation du lot 6.5.5.C — sept comptes et contact public

**5 novembre 2026. Livraison de préouverture ciblée ; aucune ouverture privée.** Base vérifiée par `git fetch origin` : `5887f5f1e9b727c041c6eb5832c55ecf562aa3da`, fusion de la [PR #35](https://github.com/Vladoche/mon-bprea/pull/35), également confirmée par ses métadonnées GitHub. Worktree initial propre ; branche `feature/lot6-5-5c-capacite-contact-public` issue de ce dernier `origin/main`.

## Décisions définitives et limites de publication

- **Sept comptes au total : un exploitant et six autres participants adultes.** Aucun nouveau choix de décompte demandé. Plafond administratif dépendant du circuit contrôlé de l'unique opérateur, sans quota serveur ni migration.
- **vladimir.fouillade@hotmail.fr est le contact officiel ; sa publication publique est expressément autorisée**, y compris hors connexion. Cette coordonnée n'est pas un secret à retirer du dépôt. Aucune autorisation d'accès à la boîte, de publier d'autres coordonnées ou d'utiliser un nom civil dans la notice finale n'en est déduite.
- Calendrier B conservé : préavis/export dès le 31/05/2027, fermeture le 30/06, suppression active prévue au plus tard le 30/07 ; sauvegarde applicative hebdomadaire, perte maximale visée sept jours, clôture assistée. Aucun RPO garanti, reprise Auth complète ou effacement immédiat chez tous les fournisseurs promis.

## Code et disponibilités locales

[policy.json](../../scripts/preopening/policy.json) porte la confirmation, la répartition et le contact autorisé. `init` préremplit ces seules décisions. Le helper de compatibilité conserve identité, attestations et champs privés ; une adresse différente provoque un refus plutôt qu'un transfert de preuves. Consultation régulière de la boîte ajoutée aux préconditions ; les autres gardes d'invitation ne sont pas relâchés.

[contact.html](../../contact.html) est une page HTML autonome : projet facultatif/indépendant, périmètre confirmé, ouverture encore interdite, motifs d'assistance/connexion/récupération/données/suppression/incidents/participation, mailto et adresse sélectionnable. Aucun formulaire/backend/CAPTCHA/service supplémentaire. Le seul script de thème est facultatif ; aucun chargement Auth. Courriel ordinaire présenté avec ses limites ; aucun mot de passe/JWT/lien/sauvegarde JSON/pièce d'identité non sollicitée à envoyer.

Les 17 autres pages ont un lien statique de pied de page, conservé dans le footer partagé avec JavaScript. Les parcours récupération, lien invalide et clôture renvoient au contact sans exiger un compte accessible. Préfixe Pages conservé. Aucun changement de clé locale, d'URL existante ou de configuration Auth.

La [notice de travail](../rgpd/POLITIQUE-CONFIDENTIALITE-PROJET.md) intègre seulement les décisions définitives et l'identification du fournisseur de boîte. Elle garde ses réserves juridiques, identité finale, bases, résidus, lieux/support/retentions et reprise. L'aperçu `preopening:notice` crée désormais une génération privée neuve et rend le mailto ; l'aperçu B existant est préservé. La notice n'est ni approuvée ni intégrée à Pages.

## Dossier opérateur et messagerie

Le chemin canonique `.tmp/preopening-operator/` n'existait pas : création locale avec les ACL restrictives prévues. Le dossier B `.tmp/preopening-operator-655b/` reste intact, sans lecture de ses contenus ni remplacement. Aucun autre dossier opérateur rempli écrasé ; `.gitignore` et maintenance `.tmp` inchangés, aucun nettoyage général.

Dans le nouveau `operator.json`, capacité et publication sont confirmées ; identité et approbations juridiques restent non attestées. `withoutAccountChecked` référence **uniquement la recette locale de l'artefact**, avec `hostedUrlChecked:false`. ACL du fichier identiques avant/après cette seule attestation ; protection du dossier vérifiée. Aucun contenu privé affiché. Le contrôle contact reste en échec attendu avec six manques : propriété effective, protection/MFA, récupération, consultation régulière, réception et réponse. Les dates de ces deux essais restent nulles.

**Vérifications de boîte réellement réalisées : aucune.** Aucun accès Microsoft, mot de passe, MFA/code de récupération, lecture de courriels, envoi extérieur ou réponse. La [procédure courte](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#vérifier-la-boîte-microsoft--à-faire-par-lexploitant) est prête pour l'exploitant : maîtrise de la boîte, état MFA, moyens de récupération valides, essai neutre depuis l'extérieur et réponse, routine de consultation. Les préflights ne transforment pas un booléen ou une fixture en fait opérationnel.

## Preuves fournisseur nouvelles

La [matrice ciblée](../rgpd/FLUX-ET-PRESTATAIRES.md) distingue service/données/titulaire/rôle, conditions et version, région/accès, copies/journaux, conservation, garanties et inconnues pour les trois prestataires. Sources GitHub/Supabase de B réutilisées ; aucune consultation administrative. Microsoft personnel ajouté sur sources publiques officielles consultées le 05/11 : [contrat effectif au 30/09/2026](https://www.microsoft.com/fr-fr/servicesagreement), [confidentialité de septembre 2026](https://www.microsoft.com/fr-fr/privacy/privacystatement), aide sécurité/récupération et distinction comptes personnels/professionnels.

Aucune clause Microsoft 365 entreprise, résidence UE exclusive ou DPA signé présumé. Applicabilité aux comptes, lieux effectifs, accès/support et délais résiduels restent incomplets. La divergence entre les indications publiques de conservation des éléments supprimés Outlook est consignée ; aucun délai universel inventé. P0-07/08 progressent en preuve publique, restent ouverts. Le changelog public Supabase a été consulté : aucune mise à niveau CLI/SDK, migration ou modification des workflows de ce lot ; CLI CI toujours fixée en v2.

## P0 concernés — avant / après

| P0 | Avant B | Après C | Preuve nouvelle | Reste |
| --- | --- | --- | --- | --- |
| 04 | Information exploitant manquante | Contact public intégré ; vérifications de messagerie requises | Adresse/publication décidées, page sans compte et dossier compatible ; procédure Microsoft prête | Propriété, MFA, récupération, réception/réponse, consultation régulière |
| 05 | Implémenté localement, recette requise | Même statut ; texte rapproché de l'approbation | Capacité/contact/calendrier et limites cohérents ; aperçu local | Cadre/bases, identité finale si requise, résidus/fournisseurs, approbation complète puis publication avant collecte |
| 07 | Preuves fournisseur manquantes | Même blocage, preuve publique partiellement complétée | Fournisseur Hotmail identifié et conditions grand public datées | Rattachement effectif des comptes/conditions et rôles/garanties |
| 08 | Preuves fournisseur manquantes | Même blocage, preuve publique partiellement complétée | Documentation internationale et rétentions Microsoft examinées | Lieux/accès/support/copies/délais applicables ; divergence publique à clarifier |
| 14 | Autorisation hébergée nécessaire, capacité hypothétique | Capacité définitivement acquise ; activation toujours bloquée | Sept = exploitant + six ; refus du huitième testé | Cible, autres P0, preuves effectives et mandats séparés, T11/D inchangés |
| 15 | Implémenté localement, recette requise | Même statut ; circuit et messages précisés | Modèles avant collecte/confirmation/remise, contact officiel, préflights | Notice complète approuvée accessible avant collecte, circuit/terminal approuvés et future autorisation d'ouverture/liens |

Les autres statuts restent acquis : **02/09 résolus ; 01/03/06/10 prêts à approuver ; 12/13 implémentés localement avec preuves opérationnelles encore requises ; 11 bloqué par autorisation hébergée.** La preuve de clôture native en CI #35 n'est pas rouverte. La [matrice courante](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md) reste la référence des quinze P0.

## Tests locaux et revue visuelle

Node **24.22.0**, dépendances verrouillées par `npm ci` (aucune ajoutée), `npx playwright install chromium` exécuté.

| Contrôle | Résultat réellement observé |
| --- | --- |
| Préflights/artefact ciblés | **26/26 réussis** : sept/huitième, réserve exploitant, pending, doublons, incertitude, fictifs, récupération à pleine capacité, signup/anonyme fermés ; contact sans fausse preuve, aperçu et exclusions Pages |
| `npm test` | **539 réussis, 1 ignoré, 51 fichiers** ; lien symbolique Windows sans privilège ignoré, aucune réussite revendiquée pour lui |
| Contact/Auth ciblés | **14/14 E2E** ; réponses Auth du défaut désactivé, aucune requête Supabase pour le contact |
| `npm run test:e2e` final | **94/94 réussis**, y compris les parcours existants et inventaire réseau/stockage des **18 pages** en contextes vierges |
| `npm run build:auth-sdk` | Réussi, SDK 2.118.0 ; aucune différence dans le bundle verrouillé |
| Sans JavaScript | Six combinaisons 320/390/1280 px × clair/sombre, mailto exact/adresse sélectionnable, pas de formulaire ni requête tierce/Auth, accès depuis les points publics |
| Clavier/accessibilité | Tabulation, lien d'évitement, focus du main puis mailto visibles ; titres/régions et nom du lien contrôlés dans l'arbre d'accessibilité. Aucun essai vocal avec lecteur d'écran réel : non validé sur ce matériel |
| Visuel | Six captures contact et quatre aperçu notice inspectées, sans débordement, textes/liens lisibles ; saisons/préférence sombre conservées par le script existant ; aperçu toujours signalé non approuvé |
| Configuration | Auth versionnée et dans l'artefact désactivée, URL/clé vides ; aucune modification de Supabase/configuration d'inscription |

Premier essai des tests ciblés : **EPERM** du bac à sable sur le lien physique Windows ; reprise locale autorisée réussie, sans affaiblir le contrôle. Premier E2E complet : **93 réussis / 1 échec**, lien Connexion absent de l'en-tête du nouveau contact autonome ; ajout du lien puis **94/94**, contrôle d'inventaire conservé. Capture locale initialement bloquée par le profil Chromium du bac à sable ; exécution autorisée utilisant l'installation existante réussie. Aucun de ces échecs initiaux n'est masqué comme réussite.

Preuves visuelles locales ignorées sous `.tmp/preopening-visual-ZhLV7A/`, aperçu sous `.tmp/preopening-notice-preview-Bo0BBI/` ; ni ces captures ni les dossiers opérateur n'entrent dans la PR. Les tests pédagogiques/Auth HTTP simulés restent distincts de RLS. Docker et CLI Supabase exécutables absents du poste ; tests réels Supabase locaux **NON EXÉCUTÉS**. Aucun runner redirigé vers DEV/PROD ; seule la CI éphémère habituelle peut fournir les nouveaux résultats réels.

## Artefact, liens et confidentialité

Contrôles exécutés avant commit : **764 liens Markdown internes dans 91 fichiers, aucune cible/ancre absente** ; artefact de **135 fichiers publics + `.nojekyll` (136), 18 HTML**, ressources relatives valides, Auth désactivée, racines privées et notice absentes. Recherche de motifs sensibles dans les fichiers publics et vérification des adresses ajoutées : aucun élément non autorisé détecté. L'exception de publication porte exactement sur l'e-mail autorisé. Aucun scanner existant n'est désactivé/assoupli ; aucune exception générale par domaine ou suppression de contrôle. Aucun secret, JWT réel, lien administratif, contenu de courriel, sauvegarde ou historique individuel ajouté. `git diff --check` sans erreur.

Workflows examinés : `quality.yml` et `auth-security.yml` ne publient pas Pages. **Une fusion future dans main déclenchera automatiquement `deploy.yml`**, puis `prepare-pages.py`, upload et déploiement de l'artefact statique. La nouvelle page Contact/CSS et ses liens approuvés seront alors publiés. Le constructeur garde ses racines publiques explicites ; docs/notice, scripts, tests, `.tmp`, configurations locales et dossiers opérateur sont exclus. Aucune notice complète, Auth active ou pièce privée ne doit être publiée par cette fusion. Aucun workflow modifié, déploiement manuel, fusion ou protection main modifiée dans C.

## État historique et actions restant à autoriser

T03/T08/T10/T12 C2 acquis dans leurs sous-cas documentés ; **T11 DEV non exécuté, D non autorisée**, deux comptes fictifs A/B conservés, **3/3 liens consommés, 29/60 Auth mutantes, 104/140 tentatives pédagogiques, 36 lignes applicatives documentées**. Aucun compteur, fixture de campagne ou marqueur consommé modifié. Copie partielle du 29 octobre et résidus conservés, aucune nouvelle sauvegarde/rotation/nettoyage.

Priorités restantes : vérifier la messagerie/récupération ; approuver cadre juridique/bases/notice et identité finale éventuelle ; trancher durées résiduelles et applicabilité des garanties fournisseur ; accepter/démontrer les limites de reprise ; choisir la cible puis autoriser seulement les lectures/recettes/préparatifs hébergés nécessaires. Publication de notice, activation et invitations restent des décisions ultérieures. **Aucun accès administratif Supabase hébergé, création/modification de compte, lien généré, invitation/courriel envoyé, D, T11 ou ouverture dans ce lot.**

## Reçu Git et CI

Branche de livraison indiquée en tête ; PR et résultats des trois jobs à rattacher après leur observation. La fusion reste à l'exploitant ; aucun succès CI n'est inféré de la seule configuration des workflows.
