# Décisions et preuves encore nécessaires avant ouverture privée

**6 novembre 2026 · lot 6.5.5.G.** Le cadre RGPD, le responsable, les bases R01–R05, le contact, le screening et les durées de conservation sont consignés dans le [reçu du 5 novembre](../rgpd/RECU-ARBITRAGES-2026-11-05.md). D12 est approuvée dans le périmètre recetté par D, E et F. La capacité reste de sept comptes, exploitant et six autres adultes. [Reçu D12](../rgpd/RECU-ARBITRAGE-D12-2026-11-06.md), [matrice des quinze P0](PLAN-PREOUVERTURE-PRIVEE.md).

| Décision ou preuve restante | Action |
| --- | --- |
| Information préalable | Valider le circuit final et la preuve minimale de remise de la notice avant collecte. Appliquer la règle D12 approuvée sur les résidus locaux et son suivi du volume. [D12](../rgpd/ANALYSE-STOCKAGES-NAVIGATEUR-D12.md) |
| Conditions des prestataires et transferts | Rattacher conditions et DPA à l’organisation cible, confirmer l’offre et la région, puis vérifier la chaîne de services et le circuit manuel. Les durées exhaustives des journaux et le datacenter précis du webmail sont des limites documentées. [Preuves PF-01 à PF-03](../rgpd/FLUX-ET-PRESTATAIRES.md#preuves-matérielles-restantes) |
| Notice et publication | Relire les écarts substantiels et approuver la V1.1 résultante. Autoriser ensuite la publication statique de la version retenue et son contrôle public. [Spécification](../rgpd/SPECIFICATION-INFORMATION-PUBLIQUE.md) |
| Limites de reprise et clôture | Accepter la reprise applicative partielle. Vérifier copie actuelle, fraîcheur, restauration isolée et journal d’effacements, chaîne opérateur de clôture et suivi des copies. [Procédures](EXPLOITATION-PRIVEE-SIX-ADULTES.md) |
| Cible et autorisations techniques | Choisir la cible, vérifier accès/roles/MFA et réglages, traiter les réserves C2 et prévoir exécuteur de liens et retour arrière. Activation et invitations relèvent de décisions distinctes. [Plan](PLAN-PREOUVERTURE-PRIVEE.md) |

## Interventions à délimiter par mandat

1. **Lecture fournisseur ciblée.** Relever uniquement les pièces nécessaires à PF-01 à PF-03 selon le projet de mandat ci-dessous. Les vérifications de sécurité et de préparation à l’activation restent des opérations distinctes.
2. **Copie actuelle et restauration isolée.** Couvrir les dix tables et la correspondance Auth utile sans exporter de secret. Vérifier couverture, reprise et réconciliation avant tout retour en service. La copie du 29 octobre reste séparée. Utiliser les preuves de clôture native acquises en CI #35 et compléter la chaîne opérateur sur la cible.
3. **Réserves de campagne.** Statuer séparément sur T11 DEV et sur D pour les seules cibles fictives, avec preuve privée fraîche. Les autres sous-cas C2 demandent une recette ciblée ou une acceptation motivée de la limite.
4. **Préparation de l’exécuteur de liens et de la cible.** Vérifier cible/callback, capacité, émission unique, réservation privée, gestion d’un résultat incertain et retour arrière. Le circuit conserve ses contrôles de fraîcheur et de vérification d’identité.

## Projet de mandat de lecture fournisseur

**À soumettre séparément à l’exploitant.** Ce projet de mandat couvre un seul relevé en lecture pour PF-01 à PF-03. Cible proposée sous réserve de désignation explicite par l’exploitant **Supabase PROD Mon BPREA, référence `oqoqrxwfbkhtpksqimgd`**. Confirmer l’organisation et la référence dans le mandat privé avant toute connexion. DEV et les autres projets sont exclus. Toute autre cible exige un nouveau périmètre. [Identification documentaire de PROD](INVITATIONS-ET-RECUPERATION-MANUELLES.md).

| Autorisé après accord écrit | Constat à consigner en privé |
| --- | --- |
| Lire la fiche de l’organisation et son rattachement au projet, et rapprocher le titulaire et l’entité contractante des pièces détenues par l’exploitant | Date, opérateur habilité, référence cible, organisation et titulaire juridique, offre et canal de souscription |
| Lire les pièces de souscription/acceptation et les références du DPA. Relier les clauses publiques aux services de l’offre effectivement retenue | Version et date des conditions, DPA applicable, clause/annexe de transfert, garanties et sous-traitants pertinents, référence de chaque preuve |
| Lire les métadonnées non secrètes de région, de services et d’intégrations de la cible, limitées à Auth/API/base et aux éventuels services affectant le stockage, les journaux ou l’envoi. Confirmer le circuit de remise prévu avec l’exploitant à partir de son descriptif | Région AWS, services concernés, limites de rétention utiles et statut manuel ou automatique de l’envoi. Consigner les flux et leurs garanties ainsi que les réserves, sans valeurs de configuration sensibles |

Utiliser seulement les vues de métadonnées et les pièces déjà disponibles. Arrêter le relevé si la cible diffère, si un écran expose les données exclues ou si une action d’écriture ou d’élévation de droits est nécessaire. Les pièces et la synthèse détaillée restent dans le dossier opérateur privé, sans capture de console contenant des données sensibles. Reporter dans le suivi public uniquement le statut et les mentions approuvées nécessaires à la notice.

Sont exclus du mandat les listes d’utilisateurs, comptes et adresses de participants, profils, tables, contenus et lignes de journaux, rôles et réglages de sécurité des membres, mots de passe, clés, JWT, secrets SMTP, liens et messages. Le mandat ne couvre ni la boîte Microsoft ni un autre compte hébergé. Il exclut tout SQL, changement de configuration ou de droits, migration, test mutatif, copie ou sauvegarde, génération ou remise de lien, invitation, activation, T11 DEV et nettoyage D. Il s’arrête à la restitution privée du relevé. La revue de la V1.1 et la publication conservent leurs accords propres. [Conditions de publication](../rgpd/SPECIFICATION-INFORMATION-PUBLIQUE.md#conditions-avant-publication).
