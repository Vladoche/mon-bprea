# Mon BPREA Admin 2.0 — guide utilisateur

L’application Windows propose trois actions : **Créer un compte**, **Récupérer un compte** et **Supprimer un compte**. Elle gère au maximum sept comptes, exploitant compris. Aucun logiciel complémentaire n’est nécessaire pour la lancer.

**Limite de cette version : la suppression sur le service réel reste bloquée.** Les contrôles des données et des sauvegardes doivent encore y être installés et qualifiés séparément. La suppression a un parcours de qualification locale distinct ; aucun bouton ne permet de lever le blocage réel.

## Télécharger et ouvrir

Depuis une exécution réussie du [workflow Windows officiel](https://github.com/Vladoche/mon-bprea/actions/workflows/admin-windows.yml), télécharger l’artefact **MonBPREAAdmin-2.0-win-x64-…**, puis extraire son archive. Une connexion GitHub peut être nécessaire. Elle contient `MonBPREAAdmin.exe`, ce guide (`LIRE-MOI.md`) et l’empreinte `SHA256.txt`.

Ouvrir `MonBPREAAdmin.exe`. Le programme n’est pas signé : Windows peut afficher un avertissement de provenance. Vérifier qu’il vient bien du dépôt officiel avant de l’exécuter.

## Première ouverture

Saisir la **clé secrète** fournie pour Mon BPREA, commençant par `sb_secret_`, puis choisir **Continuer**. La saisie est masquée. L’application vérifie la connexion et enregistre automatiquement la clé dans le coffre chiffré Windows, pour votre compte sur cet ordinateur.

Aux ouvertures suivantes, les trois actions apparaissent directement. Aucun mot de passe supplémentaire, dossier ou fichier n’est demandé. Une clé enregistrée n’est jamais affichée. Une erreur de réseau ne signifie pas qu’il faut la saisir à nouveau.

## Créer un compte

1. Choisir **Créer un compte**.
2. Entrer l’adresse e-mail du camarade et choisir **Créer le lien d’activation**.
3. Choisir **Copier le lien**, puis le transmettre personnellement au camarade.

Le camarade ouvre lui-même le lien et choisit son mot de passe. L’application n’envoie aucun message et n’ouvre aucun lien personnel automatiquement. Une invitation créée attend encore son activation.

Si un lien déjà créé est retrouvé, il est affiché sans créer un second compte. Sa date reste celle de sa création. La durée est indiquée uniquement lorsqu’elle peut être vérifiée ; sinon l’application annonce qu’elle n’est pas communiquée par le service.

## Récupérer un compte

Choisir **Récupérer un compte**, sélectionner la personne puis l’opération :

- **Réinitialiser le mot de passe** : créer le lien, le copier et le transmettre au titulaire. Lui seul choisit son nouveau mot de passe.
- **Modifier l’adresse e-mail** : saisir la nouvelle adresse. Joindre le titulaire par un canal déjà connu avant de confirmer cette adresse. Son ancien mot de passe est conservé.
- **Modifier l’adresse e-mail et le mot de passe** : vérifier le titulaire et la nouvelle adresse de la même manière, puis transmettre le lien créé pour cette nouvelle adresse.

La connaissance de l’ancienne adresse ne suffit pas à vérifier une identité. En cas de doute, annuler. La confirmation de la nouvelle adresse est administrative, après cet échange ; elle ne demande aucun message à une ancienne boîte devenue inaccessible. Le compte garde le même identifiant et ses données.

Un lien de récupération déjà créé peut être retrouvé. S’il a expiré ou a déjà été utilisé, **Créer un nouveau lien** permet de le remplacer pour une nouvelle demande vérifiée. Une erreur entre le changement d’adresse et la création du lien est signalée comme un changement partiel, jamais comme une récupération terminée.

## Supprimer un compte

Choisir **Supprimer un compte**, sélectionner la personne puis **Supprimer ce compte**. Un seul écran propose **Annuler** ou **Confirmer la suppression**.

Sur le service réel, cette version explique le blocage et ne supprime rien. En qualification locale, elle contrôle le compte, ses données, le compte exploitant protégé et la sauvegarde avant l’action, puis vérifie le résultat. Des contrôles des données actives ne signifient pas que toutes les copies et tous les anciens accès ont disparu.

## Paramètres, aide et incidents

Le petit accès **Paramètres** permet de remplacer ou supprimer la clé enregistrée, de vérifier la connexion et d’ouvrir le diagnostic. Supprimer la clé du coffre ne la révoque pas sur le service et ne supprime aucun compte ni historique.

Si la clé est renouvelée, révoquée ou perdue par Windows, l’application l’explique. Si une opération est incertaine, **ne pas la répéter** : l’application conserve son historique et bloque les nouveaux essais concernés. Elle ne demande jamais de commande ni de modification manuelle de fichier.

La [notice de confidentialité](https://vladoche.github.io/mon-bprea/confidentialite.html) reste accessible sans compte, également depuis **Aide**. La participation volontaire ne constitue pas une preuve inventée de consentement à d’autres traitements.

Les [détails développeur et capacités restant à qualifier](https://github.com/Vladoche/mon-bprea/blob/main/tools/mon-bprea-admin/DEVELOPPEMENT.md) sont séparés de ce guide.
