# Mon BPREA Admin 2.3 — guide utilisateur

L’application Windows propose trois actions : **Créer un compte**, **Récupérer un compte** et **Supprimer un compte**. La capacité administrative est de dix comptes au total, dont un exploitant et neuf participants. Les invitations en attente occupent une place. Si l’exploitant est absent de l’inventaire, sa place reste réservée. Aucun logiciel complémentaire n’est nécessaire pour la lancer.

**Limite de cette version : la suppression sur le service réel reste bloquée.** Les contrôles des données et des sauvegardes doivent encore y être installés et qualifiés séparément. La suppression a un parcours de qualification locale distinct ; aucun bouton ne permet de lever le blocage réel.

## Télécharger et ouvrir

Depuis une exécution réussie du [workflow Windows officiel](https://github.com/Vladoche/mon-bprea/actions/workflows/admin-windows.yml), télécharger l’artefact **MonBPREAAdmin-2.3-win-x64-…**. Une connexion GitHub peut être nécessaire. L’archive contient `MonBPREAAdmin.exe`, ce guide (`LIRE-MOI.md`) et l’empreinte `SHA256.txt`.

Ouvrir `MonBPREAAdmin.exe`. Le programme n’est pas signé : Windows peut afficher un avertissement de provenance. Vérifier qu’il vient bien du dépôt officiel avant de l’exécuter.

## Première ouverture

Saisir la **clé secrète** fournie pour Mon BPREA, commençant par `sb_secret_`, puis choisir **Continuer**. La saisie est masquée. L’application vérifie la connexion et enregistre automatiquement la clé dans le coffre chiffré Windows, pour votre compte sur cet ordinateur.

L’assistant retrouve et vérifie l’historique administratif et le dossier de sauvegarde. Si l’accès distinct aux sauvegardes manque, **Finaliser la configuration** affiche un champ masqué pour le mot de passe PostgreSQL du projet. Une fois la connexion vérifiée, Windows mémorise cet accès séparément. Les outils compatibles sont retrouvés ou préparés automatiquement.

Aux ouvertures suivantes, les trois actions apparaissent directement avec les accès mémorisés. **Paramètres → État du système** indique si la création de comptes est disponible et comment résoudre un blocage.

## Créer un compte

1. Choisir **Créer un compte**.
2. Entrer l’adresse e-mail du camarade et choisir **Créer le lien d’activation**.
3. Choisir **Copier le lien**, puis le transmettre personnellement au camarade.

Le camarade ouvre lui-même le lien et choisit son mot de passe. L’application n’envoie aucun message et n’ouvre aucun lien personnel automatiquement. Une invitation créée attend encore son activation.

Si l’adresse est déjà activée, utilise **Récupérer un compte**. Si elle attend son activation, l’application retrouve le lien encore utilisable ou ouvre le parcours de renouvellement. Chaque copie revérifie l’invitation en cours.

En PROD, une nouvelle invitation ou son renouvellement exige une sauvegarde applicative restaurée et vérifiée depuis moins de sept jours et une durée Auth vérifiée de 24 heures. La première invitation exige aussi une place disponible. **Créer un compte** affiche les places participantes d’après un inventaire Auth complet, relu sous verrou avant la mise en réserve. Une récupération ou un renouvellement conserve le compte et sa place.

## Récupérer un compte

Choisir **Récupérer un compte** puis sélectionner la personne. Tant que son invitation attend l’activation, **Créer un nouveau lien d’activation** permet de remplacer le lien précédent, y compris après expiration. Confirmer, choisir **Copier le lien**, puis le transmettre au même camarade. Son compte conserve son identifiant et sa place. Si l’historique ne suffit pas à prouver l’état du lien précédent, sa durée est affichée comme non vérifiée.

Après activation, trois opérations sont proposées.

- **Réinitialiser le mot de passe** : créer le lien, le copier et le transmettre au titulaire. Lui seul choisit son nouveau mot de passe.
- **Modifier l’adresse e-mail** : saisir la nouvelle adresse. Joindre le titulaire par un canal déjà connu avant de confirmer cette adresse. Son ancien mot de passe est conservé.
- **Modifier l’adresse e-mail et le mot de passe** : vérifier le titulaire et la nouvelle adresse de la même manière, puis transmettre le lien créé pour cette nouvelle adresse.

La connaissance de l’ancienne adresse ne suffit pas à vérifier une identité. En cas de doute, annuler. La confirmation de la nouvelle adresse est administrative, après cet échange ; elle ne demande aucun message à une ancienne boîte devenue inaccessible. Le compte garde le même identifiant et ses données.

Un lien de récupération déjà créé peut être retrouvé. S’il a expiré ou a déjà été utilisé, **Créer un nouveau lien** permet de le remplacer pour une nouvelle demande vérifiée. Une erreur entre le changement d’adresse et la création du lien est signalée comme un changement partiel, jamais comme une récupération terminée.

## Supprimer un compte

Choisir **Supprimer un compte**, sélectionner la personne puis **Supprimer ce compte**. Un seul écran propose **Annuler** ou **Confirmer la suppression**.

Sur le service réel, cette version explique le blocage et ne supprime rien. En qualification locale, elle contrôle le compte, ses données, le compte exploitant protégé et la sauvegarde avant l’action, puis vérifie le résultat. Des contrôles des données actives ne signifient pas que toutes les copies et tous les anciens accès ont disparu.

## Paramètres, aide et incidents

Le petit accès **Paramètres** permet de remplacer ou supprimer la clé enregistrée, de vérifier la connexion et de consulter **État du système**. **Renouveler et vérifier maintenant** crée une nouvelle copie puis la restaure dans une base isolée sur le poste. La vérification se lance aussi à l’ouverture et pendant que l’application reste ouverte. La sauvegarde peut rattraper une échéance manquée lorsque le poste et la connexion sont disponibles.

Si un contrôle échoue, **Copier le diagnostic** fournit l’état des vérifications sans données de compte. Les anciennes archives restent disponibles. La copie couvre les données applicatives. La reprise des comptes Auth, des sessions, de Storage et des réglages hébergés reste à qualifier.

Si la clé est renouvelée, révoquée ou perdue par Windows, l’application l’explique. Si une opération est incertaine, **ne pas la répéter** : l’application conserve son historique et bloque les nouveaux essais concernés. Elle ne demande jamais de commande ni de modification manuelle de fichier.

**Paramètres → Vérifier un renouvellement interrompu** peut finaliser le journal si le résultat chiffré existe et correspond exactement à l’invitation Auth. Une réponse perdue sans résultat conservé nécessite une vérification avant toute nouvelle tentative.

### Vérifier les 24 heures en PROD

Ouvrir **Paramètres → Durée des liens d’activation**. Le bouton ouvre le tableau de bord du projet fixe. Une fois la modification PROD autorisée, choisir **Authentification → Fournisseurs → Email**, régler **Email OTP Expiration** à **86 400 secondes**, enregistrer et relire. Ce réglage est partagé par les invitations, Magic Links, confirmations, récupérations et changements d’adresse par e-mail. Les liens restent sensibles pendant leur durée de validité. [Documentation Supabase](https://supabase.com/docs/guides/auth/auth-email-passwordless).

Pour vérifier la valeur depuis l’application, saisir un jeton de gestion limité à la lecture de la configuration Auth du projet (`auth_config_read`), puis choisir **Vérifier la durée**. Le jeton est masqué et conservé en mémoire pendant cette ouverture. Le programme relit la configuration au moment de créer ou de copier un lien. [API de lecture Auth](https://supabase.com/docs/reference/api/v1-get-auth-service-config).

La [notice de confidentialité](https://vladoche.github.io/mon-bprea/confidentialite.html) reste accessible sans compte, également depuis **Aide**. La participation volontaire ne constitue pas une preuve inventée de consentement à d’autres traitements.

Les [détails développeur et capacités restant à qualifier](https://github.com/Vladoche/mon-bprea/blob/main/tools/mon-bprea-admin/DEVELOPPEMENT.md) sont séparés de ce guide.
