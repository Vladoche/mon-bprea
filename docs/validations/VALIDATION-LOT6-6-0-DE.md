# Lots 6.6.0.D et E · Préparation de l’installation PROD

Les constats ci-dessous datent du 6 novembre 2026. Les lots D et E concluaient à **`NO_GO`**. Le [guide d’installation](../architecture/RUNBOOK-SUPABASE-PROD-6-6-0.md) fixe les points d’arrêt et les validations à refaire sur la cible autorisée. Les relevés opérateur, journaux bruts et archives sont conservés localement sous accès restreint.

## Acquis

- **Lot D.** Le script préparatoire P et les quatre migrations correspondaient aux fichiers de recette. Le préflight en lecture seule a confirmé l’absence d’objets applicatifs et de registre. L’identité TLS de l’hôte direct a été vérifiée jusqu’au défi d’authentification. La session authentifiée avec les moyens de l’opérateur reste à qualifier.
- **Lot E.** P puis M1 à M4 ont été répétés localement. Après chaque migration, le contrôle a constaté zéro privilège effectif de table ou de colonne pour `service_role` sur les tables applicatives. Après M4, Auth Admin restait opérationnel. Drill a passé 22 groupes de tests avec de vrais JWT. L’invitation et la récupération manuelles ont été exercées localement, avec refus de l’inscription directe et des connexions anonymes.
- **Reprise.** Le [lot C](VALIDATION-LOT6-6-0-C.md) avait restauré un environnement synthétique avec profils et données applicatives. En E, un export synthétique avant P a été restauré sélectivement sur une seconde stack isolée. Le registre, les agrégats, les définitions Auth et les ACL concordaient avec le périmètre répété. Le point de reprise de la base hébergée reste à qualifier.

## Compatibilité PostgREST

Sous PostgREST 14.18, un PATCH ITK direct avec un conflit de révision dépassait le délai client de huit secondes. Sous 16.4, le même cas renvoyait le code `40001` et les données restaient intactes. Le prototype du lot E changeait les deux refus métier de la garde en `PT409`. Les deux PATCH ont renvoyé HTTP 409 sous 14.18 et les 26 groupes de tests personnels ont réussi avec ce prototype. Le propriétaire et les ACL de la garde ont été vérifiés après le changement. [Explication Supabase](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b)

M5 reprend ce delta. Les RPC gardent leur contrat de conflit structuré et les autres chemins de sérialisation gardent leur code. La recette du prototype constitue la preuve historique. La qualification finale doit rejouer le préfixe versionné P et M1–M5 avec PostgREST 14.18 et vérifier le code HTTP, la conservation des données et les permissions.

## Conditions d’ouverture

- **Accès sur invitation uniquement.** Fermer les inscriptions directes et les connexions anonymes, valider les URL et la confirmation d’adresse, puis vérifier les parcours d’invitation, de connexion et de récupération. [Préouverture privée](../deploiement/PLAN-PREOUVERTURE-PRIVEE.md)
- **Exploitation.** Qualifier la connexion directe authentifiée avec l’opérateur. Vérifier et faire accepter le point de reprise avant P. Le préflight de cette PR est un diagnostic en lecture seule. Ses résultats restent dans le dossier opérateur privé.
- **Livraison.** Valider le préfixe et obtenir l’accord d’installation PROD. Valider ensuite l’activation Pages et l’ouverture sur invitation selon leurs procédures. La cible du 13 novembre est de pouvoir activer une invitation, se connecter, utiliser un cours et retrouver sa progression après reconnexion.
