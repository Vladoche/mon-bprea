# Mon BPREA Admin 1.1

Application locale Windows x64 : consulter les comptes Auth, préparer une invitation individuelle et récupérer l’accès à un compte confirmé pour Mon BPREA PROD. Aucun accès aux données pédagogiques, envoi de courriel, suppression de compte ou changement de rôle. Le plafond de sept comptes reste administratif ; une place est réservée à l’exploitant lorsqu’il est absent.

## Télécharger et lancer

1. Ouvrir le [workflow Windows](https://github.com/Vladoche/mon-bprea/actions/workflows/admin-windows.yml), choisir une exécution réussie sur la version souhaitée, puis télécharger l’artefact **MonBPREAAdmin-1.1-win-x64-…** dans la rubrique *Artifacts*. Une connexion GitHub peut être nécessaire.
2. Extraire l’archive dans un dossier local du poste de l’exploitant. Elle contient `MonBPREAAdmin.exe`, `LIRE-MOI.md` et l’empreinte `SHA256.txt`. Le nom de l’artefact identifie le commit compilé ; vérifier cette version avant utilisation.
3. Lancer `MonBPREAAdmin.exe`. Aucun Node.js ni runtime .NET installé n’est nécessaire. L’exécutable n’est pas signé : Windows peut afficher l’avertissement habituel d’un programme provenant d’Internet. Vérifier sa provenance et son empreinte avant de décider de l’exécuter.

## Déverrouiller la session

Le déverrouillage demande la clé administrative moderne `sb_secret_…` et l’adresse vérifiée du compte exploitant. Les deux autres champs permettent de choisir le dossier privé des opérations et le fichier `operator.json` du préflight existant ; ils peuvent rester vides pour consulter uniquement les comptes. La clé est masquée, conservée seulement en mémoire pour la session et jamais enregistrée par l’application. Utiliser **Verrouiller** ou fermer la fenêtre pour retirer ses références en mémoire ; les chaînes .NET ne permettent pas de garantir un effacement physique immédiat de toutes les copies.

Choisir le **même dossier privé que l’exécuteur Node historique**, pour partager verrou et réservations. Ne pas créer un nouveau dossier pour contourner un incident. Le dossier doit être local, hors dépôt, hors cloud et partage, appartenir au compte Windows courant et n’accorder l’accès qu’à ce compte et SYSTEM. Les fichiers sensibles sont protégés par Windows ; un refus de protection bloque l’opération. Le fichier `operator.json` contient les attestations existantes du [préflight opérateur](https://github.com/Vladoche/mon-bprea/blob/main/docs/deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#invitation-et-r%C3%A9cup%C3%A9ration-individuelles). Les contrôles opérationnels et leurs dates doivent correspondre à des faits réellement vérifiés, jamais à des valeurs recopiées pour débloquer un écran.

La cible est fixe : `oqoqrxwfbkhtpksqimgd`, API HTTPS Supabase de ce projet et callback `https://vladoche.github.io/mon-bprea/authentification.html`. Il n’existe aucun sélecteur d’environnement. L’application ne modifie jamais les réglages Auth.

## Consulter les comptes

Choisir **Actualiser** dans la section **Comptes**. L’application relit les réglages Auth puis l’inventaire borné. Les invitations en attente comptent dans la capacité. Les dates de confirmation proviennent d’Auth : « Adresse confirmée » ne signifie pas que la personne est connectée. Un inventaire incomplet ou ambigu bloque toute génération. Sélectionner explicitement une ligne ; un compte non confirmé ou présentant un état Auth restreint ne permet pas la récupération.

## Inviter une personne

1. Vérifier les prérequis du poste et du préflight, notamment l’habilitation individuelle et la décision humaine d’ouverture. Les cases sont des attestations de l’opérateur ; le logiciel ne prouve ni la remise de la notice ni les échanges privés.
2. Saisir l’adresse unique et confirmer les trois prérequis : notice V1.1 remise avant collecte/confirmation de l’adresse, demande ou acceptation personnelle avec adresse confirmée, canal privé convenu. Ces confirmations sont réinitialisées pour une nouvelle opération.
3. Choisir **Préparer l’invitation**. Aucun compte n’est créé à ce stade. Vérifier le récapitulatif PROD, l’adresse, la capacité et l’heure de l’inventaire. Le préflight expire après cinq minutes.
4. Saisir exactement la phrase de confirmation affichée pour cette adresse, puis confirmer la génération. Elle peut créer immédiatement le compte Auth et son profil. Le participant choisira seul son mot de passe.
5. Après réussite, utiliser l’accès au dossier privé pour ouvrir privativement le fichier individuel `auth-link-IDENTIFIANT.txt`. Ne pas ouvrir le lien sur le poste administrateur. Le remettre manuellement au seul destinataire, sans capture, journal, transfert public ni presse-papiers automatique. Aucun courriel n’a été envoyé par l’application.
6. Noter séparément la remise effective au participant avec la commande prévue dans l’écran de résultat. La création du fichier et celle du compte ne prouvent ni remise ni activation.

La durée actuellement prévue du lien est d’une heure, **sous réserve du réglage PROD effectivement vérifié par l’opérateur** ; l’API publique des réglages Auth ne prouve pas cette durée. Retirer la copie du lien après usage/expiration selon la procédure privée approuvée, sans effacer les réservations ou preuves nécessaires.

## Récupérer l’accès à un compte confirmé

1. Après déverrouillage, choisir **Actualiser**, sélectionner l’adresse dans **Comptes**, puis **Récupérer l’accès**. L’adresse est reprise en lecture seule. Une invitation en attente ou un compte verrouillé demande un diagnostic ; aucune récupération automatique n’est proposée.
2. Vérifier une nouvelle demande réelle du titulaire, son identité par un canal de confiance déjà établi, l’adresse sélectionnée, le canal privé de remise et le fait que le titulaire choisira seul son mot de passe. Les cinq cases sont décochées à chaque nouvelle opération. Elles consignent vos attestations, sans vérifier automatiquement l’identité. Une demande issue d’un canal inhabituel nécessite un contact complémentaire par le canal connu ; aucune pièce d’identité systématique. Ne demander ni mot de passe existant, JWT, code MFA ou lien de session.
3. Confirmer également les prérequis du poste, l’autorisation individuelle et l’état des opérations précédentes. Si un ancien fichier privé est perdu, diagnostiquer son état avant de demander un autre lien. Choisir **Préparer la récupération** ; vérifier projet PROD, adresse, contrôle d’identité, canal, inventaire récent, stockage privé et identité du compte validée en interne. La récupération reste possible à sept comptes et ne crée aucune place ni nouveau profil.
4. Saisir exactement `CONFIRMER PROD recovery adresse`, avec l’adresse affichée, puis **Générer ce lien de récupération**. L’application relit réglages et inventaire sous verrou et refuse toute dérive, tout changement d’UUID/adresse/confirmation, toute restriction Auth et tout inventaire de cinq minutes ou plus. Une réservation durable précède le seul POST administratif, sans retry.
5. Le résultat indique **Lien de récupération généré et enregistré dans le dossier privé** et le nom du fichier individuel. Aucun email n’a été envoyé. Ouvrir seulement le dossier privé ; remettre le lien au titulaire vérifié, sans ouvrir ce lien sur le poste administrateur ni le copier automatiquement dans le presse-papiers. Sa validité est limitée, à vérifier dans les réglages PROD (valeur attendue : 3 600 secondes).
6. Acquitter séparément la remise effective avec **Noter la remise au titulaire**. L’actualisation conserve ce reçu pendant la session. Le titulaire choisit personnellement son nouveau mot de passe sur le callback existant ; la génération du fichier ne prouve pas que ce changement a eu lieu. UUID, profil, rôle, adresse, préférences et données pédagogiques restent ceux du même compte.

Un lien expiré peut nécessiter une **nouvelle demande individuelle**, avec contrôle d’identité et autorisation renouvelés, après qualification du compte et des opérations antérieures. Les liens précédents ne sont jamais rejoués automatiquement.

## Réservations V1 et journal V1.1

Utiliser ensemble les sources Node et l’exécutable V1.1 de cette livraison, dans le **même dossier privé** ; ne pas réutiliser une ancienne copie Node qui ignore le journal V1.1. Suspendre toute administration depuis un autre poste, dossier ou Dashboard. Le verrou `operation.lock` reste commun et exclusif.

Aucune migration ni réécriture des réservations V1 n’est nécessaire pour la récupération Windows. Une réservation V1 `reserved` bloque ; une opération V1 `delivered-private` avec date de livraison acquittée peut être suivie d’une récupération, même si son ancien lien a déjà été retiré selon la procédure de conservation. Cet état prouve la livraison locale, pas la remise ni le changement de mot de passe. Toute nouvelle demande exige la qualification des opérations précédentes ; fichier perdu ou état ambigu : diagnostic préalable, sans suppression ni remise à zéro.

Les récupérations Windows ajoutent des fichiers immuables `recovery-UUID-reserved.json`, `recovery-UUID-delivered-private.json` puis `recovery-UUID-handed-over.json`. Le premier conserve UUID Auth, empreinte de cible, date et cinq attestations ; aucun email en clair, clé, token ou lien dans ces événements. Le fichier secret `auth-link-UUID.txt` reste sous EFS et ACL du compte Windows courant/SYSTEM. Livraison locale et remise sont distinctes ; une nouvelle récupération exige la remise précédente acquittée et de nouvelles attestations. Une perte/altération du fichier avant remise bloque la reprise. Après remise, la copie du lien peut être retirée selon la procédure approuvée, sans retirer les événements.

Node reconnaît ce journal avant de réserver ; les anciens contrats d’invitation et de récupération restent valables. Quand Node remplace sa propre réservation V1 achevée, il en conserve d’abord les octets dans `history-reservation-UUID.json`, sans écraser une archive différente. Les fichiers V1 et les événements Windows sont conservés. Ne jamais enlever une réservation, un événement ou un verrou pour rendre une opération répétable.

## Si une opération échoue

Un résultat incertain conserve durablement sa réservation. Aucun nouvel essai automatique, aucune suppression et aucune invitation de remplacement ne sont proposés. Utiliser uniquement **Actualiser** pour une inspection non destructive, puis faire qualifier l’incident selon le [circuit manuel](https://github.com/Vladoche/mon-bprea/blob/main/docs/deploiement/INVITATIONS-ET-RECUPERATION-MANUELLES.md). Ne pas effacer `operation.lock`, une réservation ou un journal pour recommencer. L’expiration du lien ne supprime pas le compte ; une récupération V1.1 exige le même compte confirmé et une nouvelle demande vérifiée. Une incertitude reste bloquante après redémarrage ; seule une actualisation non destructive est proposée.

## Compiler et vérifier

Sources : C# / .NET 10 LTS, WinForms, sans dépendance applicative NuGet externe. SDK fixé par `global.json`. Depuis la racine du dépôt, installer les outils de test Node 24 avec `npm ci`, puis, sous Windows avec le SDK .NET prévu :

```powershell
./tools/mon-bprea-admin/publish.ps1
```

La version **1.1** est visible dans la fenêtre et les métadonnées du programme. Le contrat administratif suit la [documentation Supabase `generateLink`](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), avec `type: recovery` et le callback fixe, sans envoi automatique.

La commande exige une sortie neuve ou vide, compare les contrats avec les vrais modules Node sur des cas synthétiques, exécute les tests C# et Windows, puis publie Release `win-x64`, self-contained, single-file, sans trimming. Elle inspecte les fichiers distribués et les motifs connus de clés/jetons, vérifie la version et produit aussi `MonBPREAAdmin-1.1-win-x64.zip` (trois fichiers, empreinte exécutable contrôlée dans l’archive). Ce contrôle borné ne remplace pas la revue des sources et ne prouve pas l’absence de toute forme possible de secret.

Le workflow utilise le même script sans secret PROD. Il publie uniquement l’exécutable, ce guide et son empreinte pendant quatorze jours. Il n’appelle aucun administrateur hébergé et ne déploie rien sur GitHub Pages. Les tests simulés vérifient le client administratif et ses échecs ; ils ne constituent pas une preuve RLS ni une recette d’invitation ou de récupération réelle sur PROD. Aucun test de cette livraison ne contacte Supabase PROD. Le callback existant est vérifié avec le SDK réel et des réponses HTTP synthétiques ; la récupération hébergée réelle reste non exécutée.
