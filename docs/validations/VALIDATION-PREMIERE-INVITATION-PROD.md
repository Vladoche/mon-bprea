# Qualification de la première invitation PROD

**18 novembre 2026 — NO GO — CONDITIONS NON SATISFAITES.** Le poste retrouve
l’historique administratif d’origine. Le point applicatif du 8 novembre est
intègre et sa limite est dépassée depuis le **15 novembre à 21:48:37 CET**.
La qualification opérationnelle reste suspendue à la validation des accès dans
l’assistant et à une nouvelle archive PROD restaurée sur ce poste.

## Référence et distribution

| Élément | Résultat |
| --- | --- |
| Base du chantier | `e5607415b6cc8409d7b7cd1c2957338a4fcacf7e`, fusion [#67](https://github.com/Vladoche/mon-bprea/pull/67) |
| Sources du binaire testé | `35b7375b87369c6ede90ca4362367bf95d4d92b5` |
| Distribution | Mon BPREA Admin **2.1.0.0**, Windows x64 autonome, SDK .NET 10.0.404, exécutable de 116 576 602 octets, signature Authenticode absente |
| SHA-256 exécutable | `c1dcd0d8d95b88e41da90a93ccca1aae27c13f9d52029c6037779ec53edf9c48` |
| SHA-256 ZIP local | `7e040c9c3b877083b0ceb354406767a2ff9bcc90fc0e3e847d3649f23a9ee49f` |
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
- **Sauvegarde.** Point du **8 novembre à 21:48:37 CET**, génération EFS hors
  dépôt, archive et preuve associée relues et concordantes. Le journal courant
  examiné contient zéro entrée. Le vérificateur pour opérateur a refusé la
  preuve courante et l’exécutable a identifié l’expiration de l’archive qualifiée.
  L’intervalle RPO dépassé est ouvert depuis le **15 novembre à 21:48:37 CET**.
  Nouvelle extraction, restauration et prochaine échéance valides en attente.
- **Connexion.** Le Gestionnaire d’identifiants Windows réserve une entrée à
  Auth et une autre à PostgreSQL. Les deux entrées PROD sont absentes au relevé.
  Le point d’accès PostgreSQL direct répond en TLS vérifié et exige le mot de
  passe. La version 2.1 a démarré, retrouvé l’historique et affiché les états
  d’expiration et de blocage.
- **PROD.** Projet fixe vérifié actif. L’endpoint public des réglages Auth
  indique l’inscription publique et anonyme fermées, e-mail activé et confirmation
  requise. Une transaction SQL en lecture seule a relevé un compte confirmé,
  un seul UUID et une seule adresse distincte, un profil associé et zéro compte
  ambigu. Six places administratives restent disponibles à ce relevé. Les dix
  tables applicatives ont RLS et 24 politiques. La lecture de tables applicatives
  par `anon` et `service_role` est refusée selon le contrôle de privilèges.
  `authenticated` ne peut ni renseigner ni modifier `profiles.id`. La lecture
  avec la clé administrative de l’application et la comparaison PostgreSQL
  détaillée du préflight restent à effectuer avec les accès du poste.

Le point historique a été restauré le 8 novembre dans un cluster PostgreSQL
isolé. Son périmètre est `public` et `bprea_private`, avec les dix tables,
contenus, index, contraintes, routines, triggers applicatifs, RLS et droits.
Les UUID locaux servent aux dépendances SQL. Auth, identités, sessions, jetons,
Storage, Vault, secrets, réglages hébergés, journaux fournisseur et données non
synchronisées restent hors portée. Le RTO hébergé reste à qualifier.
[Preuve et rétention historiques](../deploiement/EXPLOITATION-PRIVEE-SIX-ADULTES.md#point-de-reprise-applicatif-du-8-novembre-2026).

## Recette du code et du binaire

| Contrôle | Résultat vérifié |
| --- | --- |
| Vecteurs Node et tests historiques | 87 vecteurs de contrat. Suite Node complète 640 réussis et un ignoré, dont les journaux V1/V1.1/V2 et les scénarios d’incertitude |
| .NET et stockage réel Windows | 2 573 assertions. Coffre, DPAPI, ACL, EFS, historiques V1/V1.1/V2, réservation ouverte, reçu illisible, fichier manquant, conflit, pointeur périmé et reprise interrompue. Tests du garde avant réservation et POST |
| PostgreSQL natif Windows | 18 assertions. Archive EDB 17.12 vérifiée et préparée automatiquement. Archive synthétique restaurée dans un second cluster SCRAM en boucle locale. Comparaisons et arrêt vérifiés. Archive corrompue, contenu divergent et journal modifié refusés. L’archive valide reste disponible. Échéance sous horloge contrôlée à 144 h et 168 h |
| WinForms et paquet | 33 contrôles WinForms, inspection de la distribution, ZIP à trois fichiers et fenêtre de l’exécutable autonome observée |
| Binaire x64 et stack locale réelle | Champ de clé masqué, configuration initiale, trois actions, fermeture et réouverture sans ressaisie. Création puis activation avec un navigateur neuf et profil lié. Mot de passe seul, e-mail seul et les deux. Connexions réelles sur comptes fictifs, UUID et données des dix tables préservés |
| Suppression PROD | Garde testé avant envoi d’un DELETE et réservation. Aucun parcours destructif sur le service hébergé |

Le premier essai natif a révélé que le processus PostgreSQL gardait le flux de
contrôle Windows ouvert. Le binaire corrigé sépare ce flux. La recette PostgreSQL
a ensuite réussi, y compris la lecture des empreintes et le refus des tentatives
invalides. Les captures d’application concernent le binaire référencé ci-dessus.
La stack fictive a été arrêtée après la recette, ses deux volumes sont conservés.

- [Première ouverture en qualification](illustrations/premiere-invitation-prod/01-premiere-ouverture.png)
- [Trois actions après réouverture](illustrations/premiere-invitation-prod/03-reouverture-sombre.png)
- [État réel du système avant configuration des accès](illustrations/premiere-invitation-prod/04-etat-reel-bloque.png)
- [Activation fictive dans un navigateur isolé](illustrations/premiere-invitation-prod/participant-activate.png)

Contrôles non exécutés sur PROD et le poste à l’heure du rapport. Validation de
la clé réelle, authentification PostgreSQL réelle, nouvelle archive et restauration,
préflight complet, renouvellement automatique effectif après une absence du
poste et déblocage de l’invitation. Les horloges simulées couvrent les seuils,
le redémarrage physique du poste reste hors recette. L’accès refusé à un fichier
EFS de test exerce le garde de lecture. La récupération après perte d’un certificat
ou du profil Windows reste hors recette.

## Matrice de décision

| Contrôle | Statut | Preuve ou limite |
| --- | --- | --- |
| Première configuration graphique | BLOQUÉ | Parcours fictif réussi. Sur le poste, clés PROD à renseigner |
| Clé mémorisée automatiquement | BLOQUÉ | Redémarrage avec clé fictive réussi. Entrée PROD absente |
| Accès PostgreSQL de sauvegarde | BLOQUÉ | Entrée PostgreSQL PROD absente |
| Nouvelle sauvegarde PROD | BLOQUÉ | Extraction en attente de l’accès |
| Restauration de cette sauvegarde | NON TESTÉ | Archive réelle en attente. Restauration synthétique exécutée |
| Comparaison des données et schémas | NON TESTÉ | Comparaison de la nouvelle archive PROD en attente |
| Journal d’effacement cohérent | PASS | Journal courant vide, lié à la preuve historique et relu sur le poste |
| Maintenance locale configurée | PASS | Contexte protégé raccordé et statut d’échéance lu par l’application. Exécution réelle dépendante des accès |
| Historique administratif retrouvé | PASS | Un candidat et une opération V1 |
| Historique raccordé à V2 | PASS | Pointeur durable, réouverture et empreintes d’origine vérifiés sur le poste |
| Absence d’opération incertaine | PASS | Historique relu sous verrou |
| Stockage Windows conforme | PASS | Propriétaire, ACL, DPAPI, EFS de sauvegarde et périmètre local contrôlés |
| Inventaire PROD conforme | PASS | Inventaire SQL récent complet et sans doublon. Inventaire avec la clé de l’application en attente |
| Inscriptions publiques fermées | PASS | Réglages Auth publics relus, inscription anonyme également fermée |
| Capacité disponible | PASS | Un compte sur sept au relevé SQL |
| Création/activation E2E locale | PASS | Exécutable publié et compte fictif activé dans un vrai navigateur |
| Première invitation bloquée si RPO dépassé | PASS | Expiration vérifiée par la suite native et garde avant réservation et POST. État réel bloqué observé |
| Aucune mutation PROD non autorisée | PASS | Contrôles de la campagne limités aux lectures Auth/SQL. Écritures de recette en local |
| Utilisation sans terminal | PASS | Les manipulations du parcours opérateur passent par l’interface. Les suites de développement gardent leurs lanceurs propres |

**Action indispensable.** Ouvrir **Paramètres → État du système → Finaliser la
configuration** et renseigner les accès dans les champs masqués. L’assistant
enchaîne contrôle, extraction en lecture seule et restauration. Le verdict pourra
être réévalué après la vérification de la nouvelle preuve et de l’inventaire dans
l’application. La suppression PROD relève de sa qualification indépendante.
