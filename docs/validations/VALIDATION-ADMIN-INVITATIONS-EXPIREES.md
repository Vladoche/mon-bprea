# Mon BPREA Admin 2.2 — invitations expirées

**18 novembre 2026 · GO en environnement isolé.** La finalisation PROD reste conditionnée à l’autorisation du changement Auth et à la relecture de la valeur de **86 400 secondes**. Le compte participant réel a été exclu de la recette.

## Défaut et correctif

Après expiration, Supabase garde l’utilisateur invité dans Auth. Admin 2.1 refusait une nouvelle invitation vers une adresse existante et réservait la récupération aux comptes confirmés. Le journal pouvait en outre ressortir le lien d’origine sans contrôler son état.

**Récupérer un compte** distingue l’invitation en attente, l’invitation expirée, la durée historique inconnue et le compte activé. Une adresse déjà invitée saisie dans **Créer un compte** retrouve le lien encore copiable ou dirige vers le même parcours. Le renouvellement relit l’inventaire et l’historique et utilise `generate_link` avec le type `invite`. Supabase remplace le jeton du compte invité non confirmé et refuse un compte déjà confirmé. L’UUID du résultat, l’adresse, le nouvel horodatage Auth et le nombre de comptes sont ensuite relus. [API officielle](https://supabase.com/docs/reference/javascript/auth-admin-generatelink) · [Implémentation Auth v2.197.0](https://github.com/supabase/auth/blob/v2.197.0/internal/api/mail.go#L150-L188).

## Résultats vérifiés

| Contrôle | Résultat |
| --- | --- |
| Fenêtre de 60 secondes, GoTrue v2.197.0 local | Création depuis le binaire 2.2, compte non confirmé, refus de l’ancien lien par Supabase avec `otp_expired` avant renouvellement. Après réouverture, la clé mémorisée est relue, l’invitation expirée est reconnue et la copie n’est proposée que pour le nouveau lien. |
| Renouvellement sur le même compte | Le navigateur indépendant a accepté le nouveau lien. Le participant fictif a choisi son mot de passe et s’est connecté dans un contexte neuf. UUID, adresse, profil, rôle Auth `authenticated` et nombre de comptes vérifiés. Les dix tables ont été comparées avant et après le renouvellement, et le profil témoin est resté inaccessible à la session du participant. |
| Fenêtre de 86 400 secondes, GoTrue v2.197.0 local | Configuration du conteneur relue par le collecteur. Le résultat Windows affiche « Lien d’activation valable 24 heures ». Un lien encore en attente, remplacé volontairement, a été refusé. Son remplacement a permis l’activation et la connexion. Une échéance physique de 24 heures n’a pas été attendue. |
| Récupération après activation | Les parcours Windows mot de passe, adresse, puis adresse et mot de passe ont abouti sur Supabase local. Dans chaque cas, connexion du titulaire, UUID, profil et données des dix tables vérifiés avec les données d’un témoin préservées. |
| Historique et concurrence | Deux réservations et deux reçus distincts, avec référence à l’opération initiale. DPAPI et ACL vérifiés sous Windows. Aucun lien ni adresse dans les événements en clair. Tests de journal V1/V1.1/V2/2.1, ancien exécuteur, répétition, plafond de sept, activation concurrente, divergence d’identité, durée non vérifiable, réponse perdue et finalisation lorsque le payload chiffré est disponible. |
| Sauvegarde | 18 assertions sur une source PostgreSQL native Windows et un cluster de restauration isolés. Contrôle de l’archive et des privilèges. Le garde PROD exige toujours une preuve applicative récente avant création ou renouvellement. |
| Contrôles automatisés | 87 vecteurs Node, 2 922 assertions .NET, 37 vérifications WinForms, 644 tests Node réussis et un ignoré. La reconstruction du SDK verrouillé ne produit aucun diff. |
| Distribution | Mon BPREA Admin 2.2.0.0, Windows x64 autonome, SDK .NET 10.0.404. Exécutable non signé, test de démarrage et ZIP à trois fichiers avec contrôle d’empreinte. |

La campagne courte utilisait le paquet dont le SHA-256 de l’exécutable est
`95b42e558cbc3da36b36205c86f3f79b898392f4836f220a517a779b8317a13d`.
La campagne à 24 heures a testé le renforcement du contrôle de la réponse
Management API (`0070ca3d396f93f8f1aefd92383ee51e85e52748f9df82cedcd9a0e87ffc1180`).
Le paquet final ajoute la sélection du mode clair réservée à la qualification.
Il a été recompilé, puis le renouvellement au clavier et l’affichage des
24 heures en mode clair ont été revérifiés sur la stack locale.

- SHA-256 exécutable final `0b39ded028cc4c0495182713b23f34d2fab70f91e6b62f6780a7a7a4b5d972e8`
- SHA-256 ZIP final `7c3bf0eb593a8d692d6327d1571509456bc40439cb93aa721d9717b94bee6343`

### Captures

- [Invitation expirée, mode sombre](illustrations/admin-invitations-expirees/invitation-expiree.png)
- [Confirmation du renouvellement](illustrations/admin-invitations-expirees/confirmer-renouvellement.png)
- [Nouveau lien valable 24 heures, mode clair](illustrations/admin-invitations-expirees/24-heures.png)
- [Activation dans le navigateur indépendant](illustrations/admin-invitations-expirees/activation.png)

## Préparation PROD

Le réglage **Email OTP Expiration** concerne aussi les confirmations, récupérations de mot de passe, changements d’adresse par e-mail et Magic Links. Un jeton transmis expose donc le même flux pendant une période plus longue. La durée des sessions JWT, les refresh tokens, les limites de débit et le mode sur invitation restent en place. [Guide Supabase](https://supabase.com/docs/guides/auth/auth-email-passwordless#enabling-email-otp).

Après autorisation distincte, ouvrir **Paramètres → Durée des liens d’activation**, suivre le lien vers le projet fixe et régler le fournisseur Email à 86 400 secondes. Relire la valeur avec **Vérifier la durée** à l’aide d’un jeton de gestion limité à la lecture Auth. Le jeton reste en mémoire pendant l’ouverture. Cette lecture passe par la Management API, avec une identité distincte de la clé `sb_secret_`. Une fois la valeur confirmée et la sauvegarde vérifiée, le compte existant pourra être repris via **Récupérer un compte**. Le renouvellement réel relève d’une décision de l’exploitant après validation de la PR. [Lecture de la configuration](https://supabase.com/docs/reference/api/v1-get-auth-service-config).

La configuration hébergée n’a été ni relue avec un jeton de gestion du projet ni changée pendant la recette. Une réponse perdue sans payload authentifiable reste bloquante. L’API identifie sa cible par adresse et le verrou couvre le dossier administratif partagé sur le poste. Les mutations depuis d’autres consoles ou postes doivent rester suspendues pendant l’opération. Les preuves historiques sont conservées et la suppression PROD reste désactivée.

### Reproduire

Avec Docker Desktop et la CLI Supabase 2.121.0, lancer une campagne fictive à 60 secondes puis une à 86 400 secondes. Arrêter le collecteur et la stack précédente avec conservation de ses volumes avant de réutiliser les ports. Dans les trois commandes, utiliser la même valeur pour la campagne.

```powershell
./tools/mon-bprea-admin/qualification/start-local.ps1 -CliPath CHEMIN_CLI -RenewalOtpSeconds 60
node tools/mon-bprea-admin/qualification/server.mjs --renewal-otp=60
powershell.exe -NoProfile -STA -File tools/mon-bprea-admin/qualification/renewal-ui.ps1 -Executable CHEMIN_EXE -OtpSeconds 60
```

Avec le collecteur de la seconde campagne encore actif, `-RecoveryOnly` rejoue les trois récupérations sur le compte fictif activé. Les captures de recette n’exposent ni clé ni lien d’activation.
