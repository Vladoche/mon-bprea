# Mon BPREA Admin

Application locale Windows x64 : consulter les comptes Auth et préparer une invitation individuelle pour Mon BPREA PROD. Aucun accès aux données pédagogiques, envoi de courriel, récupération, suppression de compte ou changement de rôle. Le plafond de sept comptes reste administratif ; une place est réservée à l’exploitant lorsqu’il est absent.

## Télécharger et lancer

1. Ouvrir le [workflow Windows](https://github.com/Vladoche/mon-bprea/actions/workflows/admin-windows.yml), choisir une exécution réussie sur la version souhaitée, puis télécharger l’artefact **MonBPREAAdmin-win-x64-…** dans la rubrique *Artifacts*. Une connexion GitHub peut être nécessaire.
2. Extraire l’archive dans un dossier local du poste de l’exploitant. Elle contient `MonBPREAAdmin.exe`, `LIRE-MOI.md` et l’empreinte `SHA256.txt`. Le nom de l’artefact identifie le commit compilé ; vérifier cette version avant utilisation.
3. Lancer `MonBPREAAdmin.exe`. Aucun Node.js ni runtime .NET installé n’est nécessaire. L’exécutable n’est pas signé : Windows peut afficher l’avertissement habituel d’un programme provenant d’Internet. Vérifier sa provenance et son empreinte avant de décider de l’exécuter.

## Déverrouiller la session

Le déverrouillage demande la clé administrative moderne `sb_secret_…` et l’adresse vérifiée du compte exploitant. Les deux autres champs permettent de choisir le dossier privé des invitations et le fichier `operator.json` du préflight existant ; ils peuvent rester vides pour consulter uniquement les comptes. La clé est masquée, conservée seulement en mémoire pour la session et jamais enregistrée par l’application. Utiliser **Verrouiller** ou fermer la fenêtre pour retirer ses références en mémoire ; les chaînes .NET ne permettent pas de garantir un effacement physique immédiat de toutes les copies.

Choisir le **même dossier privé que l’exécuteur Node historique**, pour partager verrou et réservations. Ne pas créer un nouveau dossier pour contourner un incident. Le dossier doit être local, hors dépôt, hors cloud et partage, appartenir au compte Windows courant et n’accorder l’accès qu’à ce compte et SYSTEM. Les fichiers sensibles sont protégés par Windows ; un refus de protection bloque l’opération. Le fichier `operator.json` contient les attestations existantes du [préflight opérateur](https://github.com/Vladoche/mon-bprea/blob/main/docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#invitation-et-r%C3%A9cup%C3%A9ration-individuelles). Les contrôles opérationnels et leurs dates doivent correspondre à des faits réellement vérifiés, jamais à des valeurs recopiées pour débloquer un écran.

La cible est fixe : `oqoqrxwfbkhtpksqimgd`, API HTTPS Supabase de ce projet et callback `https://vladoche.github.io/mon-bprea/authentification.html`. Il n’existe aucun sélecteur d’environnement. L’application ne modifie jamais les réglages Auth.

## Consulter les comptes

Choisir **Actualiser** dans la section **Comptes**. L’application relit les réglages Auth puis l’inventaire borné. Les invitations en attente comptent dans la capacité. Les dates de confirmation proviennent d’Auth : « Adresse confirmée » ne signifie pas que la personne est connectée. Un inventaire incomplet ou ambigu bloque les invitations.

## Inviter une personne

1. Vérifier les prérequis du poste et du préflight, notamment l’habilitation individuelle et la décision humaine d’ouverture. Les cases sont des attestations de l’opérateur ; le logiciel ne prouve ni la remise de la notice ni les échanges privés.
2. Saisir l’adresse unique et confirmer les trois prérequis : notice V1.1 remise avant collecte/confirmation de l’adresse, demande ou acceptation personnelle avec adresse confirmée, canal privé convenu. Ces confirmations sont réinitialisées pour une nouvelle opération.
3. Choisir **Préparer l’invitation**. Aucun compte n’est créé à ce stade. Vérifier le récapitulatif PROD, l’adresse, la capacité et l’heure de l’inventaire. Le préflight expire après cinq minutes.
4. Saisir exactement la phrase de confirmation affichée pour cette adresse, puis confirmer la génération. Elle peut créer immédiatement le compte Auth et son profil. Le participant choisira seul son mot de passe.
5. Après réussite, utiliser l’accès au dossier privé pour ouvrir privativement le fichier individuel `auth-link-IDENTIFIANT.txt`. Ne pas ouvrir le lien sur le poste administrateur. Le remettre manuellement au seul destinataire, sans capture, journal, transfert public ni presse-papiers automatique. Aucun courriel n’a été envoyé par l’application.
6. Noter séparément la remise effective au participant avec la commande prévue dans l’écran de résultat. La création du fichier et celle du compte ne prouvent ni remise ni activation.

La durée actuellement prévue du lien est d’une heure, **sous réserve du réglage PROD effectivement vérifié par l’opérateur** ; l’API publique des réglages Auth ne prouve pas cette durée. Retirer la copie du lien après usage/expiration selon la procédure privée approuvée, sans effacer les réservations ou preuves nécessaires.

## Si une opération échoue

Un résultat incertain conserve durablement sa réservation. Aucun nouvel essai automatique, aucune suppression et aucune invitation de remplacement ne sont proposés. Utiliser uniquement **Actualiser** pour une inspection non destructive, puis faire qualifier l’incident selon le [circuit manuel](https://github.com/Vladoche/mon-bprea/blob/main/docs/deploiement/INVITATIONS-ET-RECUPERATION-MANUELLES.md). Ne pas effacer `operation.lock`, une réservation ou un journal pour recommencer. L’expiration du lien ne supprime pas le compte ; la récupération reste hors V1.

## Compiler et vérifier

Sources : C# / .NET 10 LTS, WinForms, sans dépendance applicative NuGet externe. SDK fixé par `global.json`. Depuis la racine du dépôt, installer les outils de test Node 24 avec `npm ci`, puis, sous Windows avec le SDK .NET prévu :

```powershell
./tools/mon-bprea-admin/publish.ps1
```

La commande exige une sortie neuve ou vide, compare les contrats avec les vrais modules Node sur des cas synthétiques, exécute les tests C# et Windows, puis publie Release `win-x64`, self-contained, single-file, sans trimming. Elle inspecte les fichiers distribués et les motifs connus de clés/jetons. Ce contrôle borné ne remplace pas la revue des sources et ne prouve pas l’absence de toute forme possible de secret.

Le workflow utilise le même script sans secret PROD. Il publie uniquement l’exécutable, ce guide et son empreinte pendant quatorze jours. Il n’appelle aucun administrateur hébergé et ne déploie rien sur GitHub Pages. Les tests simulés vérifient le client administratif et ses échecs ; ils ne constituent pas une preuve RLS ni une recette d’invitation réelle sur PROD.
