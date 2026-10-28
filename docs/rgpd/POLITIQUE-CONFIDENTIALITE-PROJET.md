# Projet de politique de confidentialité de Mon BPREA

> **PROJET NON VALIDÉ — NON DESTINÉ À PUBLICATION EN L'ÉTAT**
>
> Version de travail du 28 octobre 2026, revue 6.4.4. Les mentions « À VALIDER » sont des points bloquants, pas des informations officielles. Ce texte n'atteste pas la conformité du service et ne doit pas être utilisé comme notice définitive ou envoyé avec une invitation étudiante.

Le texte ci-dessous est une **proposition C**, fondée sur les faits techniques A de l'[inventaire](INVENTAIRE-DONNEES.md). L'identité de l'exploitant, les bases légales, les contacts, les durées et les conditions réelles d'hébergement sont des **décisions D**, encore ouvertes. La préparation s'appuie sur les [recommandations CNIL de transparence](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence) et les [articles 12 à 14 du RGPD](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3), consultés le 27 octobre 2026 (**B**).

## À quoi sert Mon BPREA ?

Mon BPREA permet de consulter des cours, de s'exercer, de retrouver ses résultats et de préparer un itinéraire technique agricole simplifié. Les résultats aident à organiser les révisions. Ils ne constituent pas des résultats d'examen certifiés. Le code audité ne prévoit ni classement entre étudiants, ni badge de récompense, ni décision automatisée d'admission ou de sanction.

## Qui est responsable de vos données ?

**À VALIDER AVANT PUBLICATION : identité et coordonnées de l'organisme qui décide des usages de vos données ; rôle de tout établissement partenaire ; contact pour vos droits et coordonnées du DPO s'il est désigné.** Ces éléments ne sont pas encore établis. Le propriétaire du dépôt et les prestataires techniques ne sont pas désignés automatiquement comme responsables du service.

## Utiliser le site sans compte

Dans la configuration publique auditée, le compte et la synchronisation Supabase sont désactivés. L'utilisation des cours et outils reste possible sans compte. Votre navigateur peut conserver sur cet appareil :

- les cours marqués terminés, meilleurs scores et tentatives QCM ;
- les séries du Mode Drill, brouillons, réponses et entraînements ;
- les sessions de reconnaissance des plantes, réponses, dates, durées et erreurs à revoir ;
- les huit derniers paramètres du formulaire ITK ;
- les choix de saison et de luminosité, un ancien choix de thème, ainsi que le jour où vous avez masqué l'anecdote.

Ces sauvegardes locales ne sont pas envoyées à Supabase par le mode visiteur. Elles peuvent appartenir à une autre personne qui a utilisé le même profil navigateur. Elles ne suivent pas automatiquement l'utilisateur sur un autre appareil par une fonction de Mon BPREA. Effacer les données du navigateur peut faire perdre des résultats.

Le site est hébergé sur GitHub Pages : selon la [documentation de GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection), l'adresse IP des visites y est enregistrée pour la sécurité, même sans compte GitHub. « Sans compte » ne signifie donc pas « aucune donnée traitée par l'hébergement ».

## L'espace personnel préparé

Un espace personnel a été développé pour retrouver une progression sur plusieurs appareils. **Son ouverture publique aux étudiants n'est pas réalisée par ce lot.** Le fonctionnement ci-dessous décrit cet espace lorsqu'il est configuré ; il n'annonce pas que des comptes étudiants réels sont déjà actifs.

Un compte serait proposé sur invitation, sans inscription publique libre. L'adresse e-mail sert à l'invitation, à la connexion et à la récupération du mot de passe. Supabase Auth gère l'identifiant du compte et les sessions. Le profil contient un pseudo facultatif et des dates techniques. Le mot de passe et les jetons de session ne sont pas enregistrés dans les historiques pédagogiques.

**À VALIDER : qui fournit l'adresse d'invitation, de quelle source elle provient, pourquoi un compte est proposé, si son usage est facultatif ou requis dans la formation, les données nécessaires et les conséquences d'une non-fourniture.** Le pseudo est facultatif dans le code. Une inscription ou une connexion ne transfère pas automatiquement l'historique visiteur vers un compte.

## Quelles données seraient synchronisées ?

Les données personnelles synchronisées comprennent la progression du Drill, les états de cours, les scores et tentatives QCM, les sessions et réponses botaniques, les derniers paramètres ITK et les choix d'apparence. Les dates, durées, identifiants et informations techniques de synchronisation permettent de retrouver l'historique et de reprendre un envoi interrompu.

Le tableau de bord calcule ses statistiques depuis les premières réponses du Drill. Il ne crée pas un historique statistique séparé. Les entraînements supplémentaires restent conservés dans leur historique. Les anciens scores partiels ne deviennent pas des tentatives datées inventées.

Le générateur ITK ne sauvegarde pas les calendriers, PDF, CSV ou documents complets dans l'espace personnel : il mémorise les huit paramètres `culture, variété, conduite, surface, mois, année, sol, eau`. Les documents sont reconstruits sur l'appareil. Les préférences automatiques de saison/luminosité restent automatiques ; leur rendu dépend de la date et de l'heure locales de chaque appareil.

L'import des anciennes données locales est proposé séparément pour cours/QCM, botanique, ITK et apparence. Il demande un aperçu puis une confirmation et conserve la sauvegarde d'origine. Ne confirmez un import que si ces données vous appartiennent. Le code audité ne propose pas d'import visiteur du Drill.

## Ce qui reste sur votre appareil avec un compte

Le navigateur peut conserver la session de connexion, un marqueur d'identité et une copie de vos données personnelles. Cette copie permet de reprendre les envois et, sous certaines conditions, de continuer pendant une panne réseau. Des opérations en attente, des versions en conflit et des copies brutes d'anciens imports peuvent aussi y rester.

**Se déconnecter ne supprime pas l'historique ni les opérations en attente de cet appareil.** Les vues personnelles sont retirées, mais les caches ne sont pas chiffrés par l'application. Une personne ayant accès au même profil navigateur, une extension autorisée ou un logiciel malveillant pourrait lire des données locales. Un appareil partagé demande donc des précautions particulières. Un résultat encore local n'est pas garanti sur un autre appareil avant confirmation de synchronisation.

Un fichier ITK téléchargé, une impression ou un PDF enregistré par vos soins reste également sous votre contrôle, hors du stockage personnel de Mon BPREA.

## Qui peut accéder aux données ?

Dans le code préparé, les API personnelles limitent chaque compte à ses propres données. Les autres étudiants ne disposent pas d'un accès à ces historiques via les politiques prévues. Aucune interface de consultation des résultats par un formateur n'est livrée dans ce périmètre.

L'hébergement public utilise GitHub Pages. L'espace personnel configuré utilise Supabase pour les comptes, les API et la base de données. Les invitations et récupérations passent par une chaîne de messagerie à préciser. Les opérateurs et prestataires habilités peuvent disposer d'accès techniques privilégiés.

**À VALIDER : destinataires effectifs, habilitations, rôle de l'établissement, fournisseur d'e-mails et contrats applicables.** Les localisations exactes, accès support et transferts éventuels hors de l'Union européenne doivent être confirmés. Ce projet ne garantit pas que toutes les données restent dans l'Union européenne.

Les ressources pédagogiques contiennent des liens vers des sites externes. L'ouverture de ces liens vous conduit vers leurs services et leurs propres règles de confidentialité. Les photographies du jeu et les PDF locaux ne nécessitent pas, dans le code audité, d'intégration d'un service tiers pour leur affichage.

## Sur quelles bases et pour combien de temps ?

**À VALIDER : base légale de chaque finalité, durée ou critère de conservation pour chaque catégorie, y compris comptes, progression, caches, imports, journaux, messages et sauvegardes.** Aucune base légale générale n'est choisie dans ce projet.

Le code ne fixe pas de date d'effacement automatique des comptes ou des historiques pédagogiques. Certaines préférences remplacent leur valeur précédente et quelques diagnostics locaux sont limités en nombre ; cela ne constitue pas une politique de conservation. Les durées réelles des journaux et sauvegardes des prestataires ne sont pas établies par cet audit.

## Cookies et sauvegardes du navigateur

Le code utilise surtout localStorage et IndexedDB pour la sauvegarde, l'apparence et le compte préparé. Aucun outil de publicité ou de mesure d'audience n'a été identifié dans les sources auditées. L'analyse des accès au terminal et des éventuelles exemptions fonctionnelles reste à valider ; l'absence de publicité ne dispense pas d'examiner ces usages. Les traceurs des sites externes et les réponses de l'infrastructure ne sont pas tous vérifiables depuis le dépôt. Aucun bandeau de consentement n'est ajouté dans ce lot.

## Vos droits et les fonctions disponibles

Selon les conditions applicables, vous pouvez demander accès, rectification, effacement ou limitation de vos données. Opposition et portabilité dépendent notamment de la base et des conditions du traitement. Si un traitement est fondé sur le consentement, son retrait doit être possible. Vous pouvez adresser une réclamation à la [CNIL](https://www.cnil.fr/fr/plaintes).

**À VALIDER : canal de contact autorisé, personnes chargées des demandes, vérification d'identité proportionnée, délais et modalités opérationnelles.** N'envoyez jamais votre mot de passe ou un jeton de connexion pour prouver votre identité.

Le profil propose de préparer puis télécharger volontairement une copie JSON du compte vérifié, lorsque l'espace personnel est configuré. Elle couvre les dix tables applicatives et les compléments normalisés de ce compte sur cet appareil. Elle reste **partielle** : données internes Auth, journaux, sauvegardes, autres appareils, archives brutes/champs inconnus et marqueurs techniques de suspension ne sont pas annoncés comme couverts. Les erreurs serveur empêchent la remise d'un fichier ; les exclusions locales sont signalées. Les copies visiteur sélectionnées constituent un fichier séparé, sans propriétaire de compte présumé. Aucun envoi à un tiers n'est réalisé par cet export. Le CSV ITK ne constitue pas cette copie de compte.

Un parcours distinct permet d'effacer volontairement des catégories de cet appareil, après aperçu et confirmation. Les opérations non synchronisées choisies peuvent être perdues définitivement. Les autres comptes et les données serveur restent conservés. Un marqueur technique personnel reste dans IndexedDB pour suspendre les anciens clients ; sa durée nécessaire reste à valider. La reprise explicite peut reconstruire depuis le serveur les données encore présentes, sans récupérer le non synchronisé effacé. Un fichier déjà téléchargé reste sur l'appareil de son destinataire.

La clôture de compte est un **prototype réservé aux tests locaux éphémères**, après nouvelle connexion native et confirmation distincte. Elle n'est pas un service disponible sur l'hébergement public. Elle contrôle l'effacement Auth et des dix tables actives, sans prétendre retirer caches de tous les appareils, impressions, e-mails, journaux ou sauvegardes fournisseur. Les appareils absents peuvent conserver des copies ; une restauration de sauvegarde doit être traitée par une procédure à valider. Un JWT déjà émis peut subsister jusqu'à expiration ; la prévention de recréation serveur est testée séparément.

Ces fonctions techniques ne remplacent ni un canal de droits opérationnel, y compris sans accès au compte, ni l'examen des conditions de chaque droit. La procédure, ses responsables, les exceptions et modalités de remise/suppression restent à approuver. [Préparation des droits](PREPARATION-DROITS.md), [limites vérifiées](../validations/VALIDATION-LOT6-4-4.md).

## Avant qu'une version officielle soit publiée

Cette section est une **note interne de préparation**, à retirer du texte officiel après validation. Elle ne remplace pas les informations manquantes :

1. Résoudre D01 à D14 dans [les décisions](DECISIONS-A-VALIDER.md), compléter et approuver les mentions et leurs preuves internes ; ne pas afficher de champs « À VALIDER » aux étudiants.
2. Adapter le texte au public et au fonctionnement effectivement ouverts, conserver une version datée, distinguer information visiteur et personnel ; prévoir les informations spécifiques à l'invitation indirecte.
3. Dans un lot autorisé, créer la page publique définitive selon la [spécification](SPECIFICATION-INFORMATION-PUBLIQUE.md), accessible sans connexion avant la première collecte pertinente et depuis les parcours de compte ; vérifier clavier, mobile et sombre. **Aucune page racine `confidentialite.html` n'est créée ou publiée par 6.4.4.**
4. Vérifier l'artefact exact : [prepare-pages.py](../../scripts/prepare-pages.py) n'inclut aujourd'hui pas `docs/` ; la page racine future, elle, sera publiée par cette chaîne. Le présent Markdown pourra rester visible dans le dépôt public : son avertissement doit rester explicite.
5. Prévoir une information avant/au moment pertinent de la collecte et de la première invitation ; une notice publiée seule ne prouve ni sa communication, ni un consentement. Recette 6.4.4 puis validation d'ouverture 6.5, sans activation implicite.
