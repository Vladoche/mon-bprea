# Qualification de la première invitation PROD

**18 novembre 2026 — GO — PREMIÈRE INVITATION PROD AUTORISABLE.**
**Sauvegarde applicative PROD restaurée et vérifiée.** Le binaire 2.1 a
renouvelé le point restauré et retrouve l’historique administratif d’origine.
Le nouveau point arrive à échéance le **25 novembre 2026 à 13:09:16 CET**.

## Référence et distribution

| Élément | Résultat |
| --- | --- |
| Base du chantier | `e5607415b6cc8409d7b7cd1c2957338a4fcacf7e`, fusion [#67](https://github.com/Vladoche/mon-bprea/pull/67) |
| Revue du changement | [PR #68](https://github.com/Vladoche/mon-bprea/pull/68) et [checks de la PR](https://github.com/Vladoche/mon-bprea/pull/68/checks) |
| Sources du binaire final testé | `7a8948411826eec6196cbf049c7989d75b3ebd88` |
| Distribution | Mon BPREA Admin **2.1.0.0**, Windows x64 autonome, SDK .NET 10.0.404, exécutable de 116 576 602 octets, signature Authenticode absente |
| SHA-256 exécutable | `89dc0db56984456d98b35ecc327e0bfc92621953a0b43a470c3b2d4fb1bb543c` |
| SHA-256 ZIP local | `2ac273c1752498d3ecd3d091c77a60e72d186bf3b42becdf69dc347af6fb9f0d` |
| Poste | Windows NT 10.0.26300.0, profil opérateur vérifié pour les contrôles réels et espaces isolés pour la recette fictive |

La V2 de référence avait déjà les trois actions, le coffre Windows, DPAPI et le
verrou administratif partagé. La 2.1 retrouve et raccorde l’ancien historique,
reprend les contrats de preuve applicative, met les accès en coffre et contrôle
la préparation avant création. Les régressions à couvrir sont le contournement
du garde, l’altération d’un journal, une restauration faussement validée et la
perte de la dernière génération valide. [Architecture](../../tools/mon-bprea-admin/DEVELOPPEMENT.md).

## Poste Windows et PROD en lecture seule

- **Historique.** Un candidat valide, une réservation V1 au même projet dans
  l’état « remis privativement », zéro réservation incertaine et aucun ancien
  exécuteur observé lors du raccordement. Le dossier a été repris sur place sous
  verrou. Propriétaire Windows, ACL limitées au profil courant et à SYSTEM,
  fichier de lien lisible et DPAPI vérifiés. Ce lien du contrat Node V1 bénéficie
  d’une protection ACL. Les empreintes et dates d’écriture de tous les fichiers
  d’origine concordent après le raccordement et la réouverture.
- **Sauvegarde initiale examinée.** Point du **8 novembre à 21:48:37 CET**,
  génération EFS hors dépôt, archive et preuve associée relues et concordantes.
  Son échéance était le **15 novembre à 21:48:37 CET**. Le journal courant
  examiné contient zéro entrée.
- **Nouvelle génération retenue.** Capture PostgreSQL 17.11 du **18 novembre à
  13:09:16.682 CET**, terminée à **13:09:19.296 CET**, pour **141 222 octets**.
  Restauration effective et preuve à **13:09:41.577 CET**. Les dix tables,
  données, structures et droits concordent. Une racine UUID Auth minimale
  correspond au profil et aux dépendances SQL. Le cluster isolé est arrêté et
  ses checksums sont conformes. Le vérificateur Node existant a recalculé les
  empreintes du manifeste, de l’archive et du journal courant et a confirmé
  l’objectif RPO applicatif. Les preuves et empreintes privées restent sur le
  stockage Windows chiffré EFS, hors dépôt.
- **Incident de fraîcheur.** Le dépassement opérationnel a duré du
  **15 novembre à 21:48:37 CET** au **18 novembre à 13:09:41 CET**.
  Une première nouvelle archive a été restaurée à **13:02:19 CET**, avec
  comparaison réussie. Le vérificateur indépendant a refusé ses dates au format
  Windows. Le correctif a rétabli le format UTC du contrat et l’application a
  produit une génération distincte, restaurée à son tour. Les archives du 8
  novembre et de la première tentative ainsi que leurs preuves sont conservées.
- **Connexion et réouverture.** L’exploitant a renseigné les deux accès dans des
  champs masqués. Le Gestionnaire d’identifiants Windows a conservé les accès dans
  deux entrées distinctes après validation. Le binaire final a repris l’historique
  et a renouvelé la sauvegarde à l’ouverture, avec les accès mémorisés. Une nouvelle
  ouverture a retrouvé les trois actions et l’état prêt sans ressaisie.
- **Préflight PROD à 13:11:16 CET.** Projet fixe actif. Les protections Auth
  confirment l’inscription publique et anonyme fermées, avec confirmation par
  e-mail. Un seul compte confirmé, reconnu comme exploitant par l’historique, un
  profil associé, zéro doublon ou compte ambigu, six places disponibles. La
  concordance Auth/PostgreSQL, des migrations, du catalogue et des droits
  applicatifs est vérifiée. Les dix tables ont RLS et 24 politiques. Les
  privilèges de lecture de `anon` et `service_role` et d’écriture de
  `profiles.id` sont conformes au périmètre attendu. Les contrôles PROD sont
  restés en lecture seule.

Le point historique a été restauré le 8 novembre dans un cluster PostgreSQL
isolé. Son périmètre est `public` et `bprea_private`, avec les dix tables,
contenus, index, contraintes, routines, triggers applicatifs, RLS et droits.
Les UUID locaux servent aux dépendances SQL. Auth, identités, sessions, jetons,
Storage, Vault, secrets, réglages hébergés, journaux fournisseur et données non
synchronisées restent hors portée. Le RTO hébergé reste à qualifier.
[Preuve et rétention historiques](../deploiement/EXPLOITATION-PRIVEE.md#point-de-reprise-applicatif-du-8-novembre-2026).

## Recette du code et du binaire

| Contrôle | Résultat vérifié |
| --- | --- |
| Vecteurs Node et tests historiques | 87 vecteurs de contrat. Suite Node complète 640 réussis et un ignoré, dont les journaux V1/V1.1/V2 et les scénarios d’incertitude |
| .NET et stockage réel Windows | 2 573 assertions. Coffre, DPAPI, ACL, EFS, historiques V1/V1.1/V2, réservation ouverte, reçu illisible, fichier manquant, conflit, pointeur périmé et reprise interrompue. Tests du garde avant réservation et POST |
| PostgreSQL natif Windows | 18 assertions au premier passage avec préparation de l’archive EDB 17.12 selon son empreinte. 18 assertions sur le correctif avec outils existants, dont la régression du format de date UTC. Archives synthétiques restaurées dans des clusters SCRAM en boucle locale. Archive corrompue, contenu divergent et journal modifié refusés. L’archive valide reste disponible. Horloge contrôlée à 144 h et 168 h |
| WinForms et paquet | 33 contrôles WinForms, inspection de la distribution, ZIP à trois fichiers et fenêtre de l’exécutable autonome observée |
| Binaire x64 et stack locale réelle | Champ de clé masqué, configuration initiale, trois actions, fermeture et réouverture sans ressaisie. Les trois récupérations ont conservé l’UUID et les données des dix tables. Création puis activation rejouées avec le binaire corrigé dans un navigateur neuf, profil lié et données des autres comptes fictifs préservées |
| Suppression PROD | Garde testé avant envoi d’un DELETE et réservation. Aucun parcours destructif sur le service hébergé |

Le premier essai natif a révélé que le processus PostgreSQL gardait le flux de
contrôle Windows ouvert. Le binaire corrigé sépare ce flux. La recette PostgreSQL
a ensuite réussi, y compris la lecture des empreintes et le refus des tentatives
invalides. Les captures d’état prêt, de réouverture et d’activation concernent
le binaire final. La capture du blocage garde la trace de l’état initial.
La stack fictive a été arrêtée après la recette, ses deux volumes sont conservés.
Le contrôle de fin de livraison `npm run delivery:complete` a réussi après
arrêt des tests. Il a libéré **0 Mo** et conservé **7 738,03 Mo** sous `.tmp`.
Le plafond de 500 Mo reste dépassé. La liste blanche ne comportait aucun
candidat.

- [Première ouverture en qualification](illustrations/premiere-invitation-prod/01-premiere-ouverture.png)
- [Trois actions après réouverture](illustrations/premiere-invitation-prod/03-reouverture-sombre.png)
- [État réel du système avant configuration des accès](illustrations/premiere-invitation-prod/04-etat-reel-bloque.png)
- [État du système après la qualification réelle](illustrations/premiere-invitation-prod/05-etat-reel-pret.png)
- [Activation fictive dans un navigateur isolé](illustrations/premiere-invitation-prod/participant-activate.png)

Les horloges simulées couvrent les seuils. Le redémarrage physique du poste,
le rattrapage après un arrêt de plusieurs jours et le futur renouvellement
planifié restent hors recette. L’accès refusé à un fichier EFS de test exerce le
garde de lecture. La récupération après perte du certificat ou du profil Windows
reste à qualifier. La preuve reste limitée au périmètre applicatif. L’isolation
entre futurs participants n’a été testée qu’en environnement local. Toute
création réelle est une décision individuelle après ce préflight.

## Matrice de décision

| Contrôle | Statut | Preuve ou limite |
| --- | --- | --- |
| Première configuration graphique | PASS | Champs masqués, compte Windows et configuration reconnus sur le poste |
| Clé mémorisée automatiquement | PASS | Relecture et connexion avec la clé réelle après réouverture |
| Accès PostgreSQL de sauvegarde | PASS | Coffre Windows distinct, connexion directe TLS et lecture seule |
| Nouvelle sauvegarde PROD | PASS | Point du 18 novembre à 13:09:16 CET, empreinte contrôlée |
| Restauration de cette sauvegarde | PASS | Archive réelle restaurée en isolation, cluster arrêté et checksums conformes |
| Comparaison des données et schémas | PASS | Dix tables, contenu, schéma, droits et dépendances concordants |
| Journal d’effacement cohérent | PASS | Journal courant vide, relu et lié à la nouvelle preuve |
| Maintenance locale configurée | PASS | Renouvellement et restauration déclenchés automatiquement à l’ouverture |
| Historique administratif retrouvé | PASS | Un candidat et une opération V1 |
| Historique raccordé à V2 | PASS | Pointeur durable, réouverture et empreintes d’origine vérifiés sur le poste |
| Absence d’opération incertaine | PASS | Historique relu sous verrou |
| Stockage Windows conforme | PASS | Propriétaire, ACL, DPAPI, EFS de sauvegarde et périmètre local contrôlés |
| Inventaire PROD conforme | PASS | Inventaires Auth et SQL concordants. Exploitant reconnu et protégé |
| Inscriptions publiques fermées | PASS | Réglages Auth publics relus, inscription anonyme également fermée |
| Capacité disponible | PASS | Un compte sur sept au relevé SQL |
| Création/activation E2E locale | PASS | Exécutable publié et compte fictif activé dans un vrai navigateur |
| Première invitation bloquée si RPO dépassé | PASS | Expiration vérifiée par la suite native et garde avant réservation et POST. État réel bloqué observé |
| Aucune mutation PROD non autorisée | PASS | Contrôles de la campagne limités aux lectures Auth/SQL. Écritures de recette en local |
| Utilisation sans terminal | PASS | Configuration, renouvellement et relecture depuis l’exécutable Windows |

L’exploitant peut ouvrir le binaire qualifié et consulter l’état avant sa
première invitation. Le programme vérifie à nouveau l’archive, l’historique et
l’inventaire au moment de la création. La suppression PROD reste bloquée
jusqu’à sa qualification indépendante.
