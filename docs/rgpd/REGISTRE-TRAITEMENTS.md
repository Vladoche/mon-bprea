# Registre des traitements — fiches R01 à R05

**5 novembre 2026 · lot 6.5.5.D.** Les bases et mises en balance R01–R05 sont approuvées dans le périmètre décrit. Ces fiches préparent le registre interne de l’exploitant, qui conserve les preuves privées et les conditions effectives des prestataires. Les identifiants de données et de flux renvoient à l’[inventaire](INVENTAIRE-DONNEES.md) et aux [flux](FLUX-ET-PRESTATAIRES.md).

L’article 30 distingue les registres du responsable et du sous-traitant. Le suivi couvre les finalités, les données, les destinataires, les transferts, les délais et la sécurité. D01 retient le cadre RGPD pour cette activité régulière. [Registre CNIL](https://www.cnil.fr/fr/RGPD-le-registre-des-activites-de-traitement), [décision D01](ANALYSE-EXCEPTION-PERSONNELLE-PROJET.md).

## En-tête à compléter dans le registre interne (E/F)

| Champ | État et preuve attendue |
| --- | --- |
| Responsable du traitement | D01 approuvée. L’exploitant individuel détermine les finalités et moyens. L’identité et le contact autorisés figurent dans la [notice](POLITIQUE-CONFIDENTIALITE-PROJET.md). |
| Responsables conjoints / donneur d'instructions | B : aucun rôle institutionnel, service imposé, accès formateur ou remontée officielle prévus. B : D02 actée par mandat B ; réexaminer si les pratiques changent ; aucun conjoint ni contrat pédagogique présumé. |
| Point de contact droits | Contact officiel public approuvé et fonctionnement attesté en D04. [Contact sans compte](../../contact.html). |
| Gestionnaire du registre et validation | Exploitant. Tenir les preuves datées et les habilitations en privé. |
| Personnes concernées | A : visiteurs de pages publiques, distincts des comptes. B : sept comptes adultes confirmés, exploitant et six autres participants, facultatif, gratuit, sans publicité/non commercial ; fermeture le 30 juin 2027. D09 actée ; décompte séparé P0-14. |
| Statut des traitements | A : capacités relues sur la fusion #24 `39a5196…`, copie partielle, retrait local et clôture locale éphémère préparés ; Auth publique désactivée. Ni volume ni activité étudiante hébergée vérifiés. |

## D03 — Intérêt légitime et mises en balance approuvées

L’exploitant retient l’**intérêt légitime motivé (article 6 §1 f)** pour R01–R05 le 05/11/2026. Le choix s’appuie sur le besoin de reprise et de sécurité d’un adulte qui demande un outil gratuit de révision privée, la minimisation des données, l’alternative visiteur et l’absence de conséquence officielle. Les cinq fiches conservent le besoin, les alternatives, les risques et les garanties. Le choix de base juridique et la réalisation des garanties techniques sont suivis séparément.

L’article 6 §1 c peut s’appliquer à l’opération précise qu’impose une obligation légale, notamment en matière de droits ou d’incidents. Les prestataires documentent leurs traitements propres. L’opposition à l’intérêt légitime est possible pour des raisons liées à la situation particulière de la personne. Le traitement concerné cesse sauf motifs légitimes impérieux qui prévalent ou nécessité liée à des droits en justice. Le canal reste accessible même en cas de clôture. L’acceptation de la notice et l’accord à un accès facultatif au terminal relèvent de questions distinctes. [Intérêt légitime (CNIL)](https://www.cnil.fr/fr/les-bases-legales/interet-legitime), [RGPD (art. 6 et 21)](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32016R0679), [D12](ANALYSE-STOCKAGES-NAVIGATEUR-D12.md).

Le [calendrier](CALENDRIER-FERMETURE-PROJET.md) et la [politique de conservation approuvée](POLITIQUE-CONSERVATION-PROJET.md) s’appliquent aux cinq fiches. Les délais effectifs des fournisseurs et les garanties opérationnelles font l’objet de preuves séparées.

## R01 — Accéder à un compte personnel et le sécuriser

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : permettre connexion sur invitation, activation, récupération et session personnelle. Capacité développée, Auth publique désactivée. Ne comprend pas la création libre de comptes. |
| Responsable / personnes | B : sept comptes adultes confirmés, exploitant et six autres participants, exploitant indépendant. D01/D02/D09 approuvées. |
| Données et origine | A01–A04/A06–A07 : adresse fournie et confirmée par la personne dans le circuit volontaire prévu, UUID et métadonnées Auth, preuves temporaires, session SDK et marqueur local ; mot de passe saisi directement. F04/F07/F08/F10. D10 prévoit l’information avant collecte directe. Vérifier le circuit effectivement retenu. |
| Base approuvée | D03, art. 6 §1 f : intérêt à fournir et sécuriser l'accès individuel volontairement demandé. E-mail/UUID nécessaires au compte invité et à la récupération ; visiteur sans compte possible mais sans reprise distante. Impact : compte compromis, lien exposé ; garanties : accès propriétaire, liens individuels, aucune réutilisation commerciale, contact et clôture. Le canal est attesté. Les mesures effectives restent suivies dans les autres P0. |
| Destinataires / prestataires | A : titulaire via interface, Auth/SDK, service d'invitation de confiance préparé. F : opérateurs effectivement habilités, chaîne Supabase et remise privée individuelle, avec rôles par flux. Aucun accès formateur aux comptes n'est démontré par le frontend. |
| Transferts | D05/D06 : région/accès support et garanties du canal réel de remise à confirmer ; ne pas annoncer « exclusivement UE ». Matrice des prestataires de référence. |
| Conservation | A : aucune échéance du compte définie dans l'application ; session persistée, retrait SDK lors de signOut local réussi. A documentaire technique : possibilités de configuration [sessions](https://supabase.com/docs/guides/auth/sessions), consultation 28/10/2026 ; F : réglages/plan effectifs inconnus. D07 : paramètres, logs et backups à vérifier. |
| Sécurité | A : configuration publique désactivée, HTTPS requis en hébergé, `getUser`, identités/générations, lien nettoyé et confirmation explicite ; pas de secret administratif côté client. Config locale sans signup/anonyme, état hébergé à revalider au lot 6.5. |
| Suppression/archivage | A : déconnexion conservant la progression ; prototype local de clôture réauthentifiée avec capacité temporaire A08 et cascades. Pas de service hébergé de clôture/droits. D/E/D08 : traiter liens, logs, backups et appareils absents ; aucun JWT instantanément révoqué garanti. |
| Risques / décisions ouvertes | Accès sur appareil partagé, JWT et session SDK accessibles au profil navigateur, liens dans journaux initiaux, invitation adressée à tort ; R01–R03/R09/R10 des [risques](DECISIONS-A-VALIDER.md). D01 à D07/D09/D10. |

## R02 — Personnaliser l'identification affichée du compte

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : retrouver un profil minimal privé et un pseudo facultatif ; pas d'annuaire public ni de classement. |
| Responsable / personnes | B : titulaires des sept comptes confirmés (exploitant inclus). D01/D02/D09 approuvées. |
| Données et origine | A05 : UUID fourni par Auth, pseudo saisi par l'utilisateur, dates serveur. Table `public.profiles`. E-mail affiché depuis Auth, pas dupliqué dans le profil SQL. |
| Base approuvée | D03, art. 6 §1 f : retrouver son profil minimal et l'identification choisie. UUID nécessaire au rattachement ; pseudo facultatif laissé vide ou retirable, sans annuaire. Alternative UUID seul à conserver si le pseudo n'a pas d'utilité demandée. Impact de réidentification limité par absence de diffusion et accès propriétaire ; facultativité et garanties à vérifier en service. |
| Destinataires / prestataires | A : seul compte propriétaire via SELECT propre, Supabase DB ; E/F : administrateurs habilités et chaîne fournisseur. Pas de vue des profils d'autres comptes autorisée par les policies. |
| Transferts | D05/D06 : mêmes inconnues Supabase que R01, hors hypothèse d'usage SMTP du pseudo non observée. |
| Conservation | A : ligne liée au compte, pas de TTL ; pseudo remplaçable, dates créées/mises à jour, pas d'historique de pseudos applicatif. D07 : durée du compte et backups. |
| Sécurité | A : RLS `auth.uid()=id`, UPDATE de la seule colonne `pseudo`, pas INSERT/DELETE étudiant ; trigger privé de création ; [migration profils](../../supabase/migrations/20261022000100_profiles.sql). |
| Suppression/archivage | A : pseudo rectifiable, copie du profil sous UUID vérifié ; cascade depuis Auth exercée par prototype éphémère. E/F : exceptions, copies et sauvegardes à traiter selon règles approuvées et service hébergé autorisé. |
| Risques / décisions ouvertes | Réidentification via pseudo, accès administratif ; R02/R10. D01/D03/D05/D06/D07 et présentation du caractère facultatif D10. |

## R03 — Reprendre son apprentissage et consulter ses résultats

Cette finalité regroupe états de cours, résultats, historiques d'entraînement et leur sauvegarde/synchronisation : ce sont les sources de la même reprise pédagogique personnelle. Les tables, le Dashboard et les caches ne constituent pas autant de finalités séparées. Une future utilisation par un établissement pour évaluer, sanctionner ou suivre une promotion imposera une analyse distincte ; elle n'est pas déduite du schéma présent.

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : conserver cours terminés, premières réponses et entraînements, QCM et botanique, retrouver l'historique, réviser les erreurs et calculer les statistiques descriptives. Visiteur local actif selon code ; personnel synchronisé seulement si configuré. |
| Responsable / personnes | A : visiteur local ou compte, source locale à attribuer ; B : sept adultes envisagés pour l'espace personnel, résultats privés sans accès formateur ni évaluation officielle prévus. D01/D02/D09 approuvées. |
| Données et origine | D01–D07/Q01–Q05/B01–B05 : choix/réponses, états, scores, catégories/UC/questions, dates/durées et identifiants techniques, copies locales/distantes et bruts d'import. Actions du navigateur, calculs et horodatages serveur ; les anciens scores partiels restent partiels. F02/F03/F05/F06/F09. |
| Base approuvée | D03, art. 6 §1 f : intérêt commun à reprendre ses révisions privées entre appareils et consulter son historique. Données de réponses/dates et relations nécessaires à cette fonction demandée ; visiteur local possible mais ne rend pas ce service distant. Impact : exposition d'erreurs et de chronologie, perte ou attribution erronée ; mesures : RLS/portées, pas d'usage officiel ou partage, import volontaire, export/clôture et durée courte. Démontrer les mesures hébergées avant ouverture. Les scores servent à la révision privée. |
| Destinataires / prestataires | A : utilisateur du profil navigateur ; compte propriétaire via RLS et Supabase DB pour synchronisation. F : administrateurs réellement habilités et prestataires ; B : aucun destinataire institutionnel prévu. L'import volontaire n'autorise pas l'envoi de données appartenant à autrui. |
| Transferts | A : local sans API pédagogique distante en visiteur ; compte configuré vers Supabase. D05/D06 : pays/chaîne et accès privilégiés. Pas de transfert des résultats aux sites de ressources identifié. |
| Conservation | A : historiques append-only sans échéance dans le code ; Dashboard recalculé, pas de table de statistiques supplémentaire ; outboxes/conflits/bruts locaux conservés après déconnexion. B : fenêtre d’export le 31/05, fermeture le 30/06 et suppression active au plus tard le 30/07/2027 ; durées résiduelles approuvées par catégorie en D07. |
| Sécurité | A : RLS, contraintes, grants, UUID durable/retry exact, CAS des états modifiables, cache cloisonné par portée, transactions atomiques, imports non implicites et validation. Scores QCM/botaniques déclaratifs, pas résultats d'examen certifiés. |
| Suppression/archivage | A : copie JSON partielle des dix tables et compléments locaux ; bruts/champs inconnus exclus. Retrait local sélectionné des caches/archives/imports et barrière X10 ; cascades via clôture locale seulement. Aucun anonymat des archives ni retrait des copies absentes présumé. D/E : procédure complémentaire de droits et restauration contrôlée. |
| Risques / décisions ouvertes | Mélange A/B, source visiteur étrangère, conservation excessive, pertes hors ligne, export incomplet et réapparition après suppression : R01–R08/R10/R11. D03/D07/D08/D09/D11 ; screening approuvé en D11. |

## R04 — Retrouver ses paramètres d'utilisation

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : reprendre les huit derniers paramètres ITK, les choix saison/luminosité, masquer l'anecdote du jour. Pas de stockage du document ITK complet ni d'historique du rendu automatique. |
| Responsable / personnes | A : visiteurs ; B : sept comptes adultes confirmés (exploitant inclus). D01/D02/D09 approuvées. |
| Données et origine | I01–I03/P01–P05/X01 : saisie formulaire et choix explicites, date facultative de préférence, données techniques de synchronisation/import ; saison et heure de rendu calculées localement. |
| Base approuvée | D03, art. 6 §1 f : retrouver les seuls derniers paramètres ITK et choix d'interface demandés, sans historique du rendu ni document ITK complet. Alternative locale conservée, aucune donnée de localisation/météo supplémentaire. Faible intrusion attendue, mais caches/bruts à limiter ; suppression/rectification des choix possibles. Nécessité et durée de chaque accès au terminal à traiter avec D12. |
| Destinataires / prestataires | A : profil navigateur ; Supabase pour derniers paramètres/choix personnels configurés ; téléchargement/impression utilisateur pour résultats reconstruits. Aucun service météo/solaire constaté. F : admins et copies OS éventuelles. |
| Transferts | A : pas d'envoi de calendrier/CSV/PDF complet ; singletons personnels vers Supabase. D05/D06 pour prestataire. |
| Conservation | A : dernière valeur, anciennes clés visiteur préservées ; bornes en nombre du cache P05, pas de TTL. X01 stocke un jour masqué sans nettoyage journalier de la clé. D07 fixe le retrait volontaire et protège les opérations actives. D12 examine la nécessité des copies. |
| Sécurité | A : validation des huit champs, portée, CAS et outbox ; apparence `auto` préservée, valeurs personnelles appliquées après identité, aucune donnée de compte en attribut CSS. |
| Suppression/archivage | A : copie normalisée et retrait local ITK/apparence séparables si archives attribuables ; clés anciennes visiteur sélectionnées distinctement. Contrôle des singletons dans la clôture locale. Fichiers téléchargés/imprimés hors contrôle ; rétention et compléments de droits à valider. |
| Risques / décisions ouvertes | Copies résiduelles, appareil partagé, outbox incertaine et fichiers exportés sur l'OS : R02–R04/R07/R08. D03/D07/D08/D12. |

## R05 — Fournir le site et assurer son exploitation technique

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : distribuer les contenus publics et gérer les erreurs locales/réseau ; A documentaire technique : GitHub décrit des logs IP de sécurité Pages (source ci-dessous), pas une qualification juridique de son rôle. Traitements propres aux fournisseurs à distinguer de ceux décidés par l'exploitant. |
| Responsable / personnes | D01/D05 ; visiteurs et comptes des futures API, opérateurs d'exploitation éventuels. Le registre peut nécessiter une activité propre au prestataire, sans l'attribuer à l'exploitant par défaut. |
| Données et origine | X03/X05/X07/X09 : requêtes/URLs, IP côté hébergeur selon [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection), relu le 28/10/2026 ; logs API/Auth/Edge/SMTP possibles mais non inspectés. X10 assure la coordination locale par portée UUID. Pas de mesure d'audience applicative identifiée. |
| Base approuvée | D03, art. 6 §1 f pour l'exploitation minimale décidée par l'exploitant : sécurité/disponibilité et assistance, avec journal strictement minimal ; alternative sans log nominatif privilégiée. Impact d'IP/URL/liens et d'accès admin à limiter ; aucun tracking ou résultat pédagogique dans le journal. Traitements propres GitHub/Supabase à qualifier avec D05, sans les attribuer automatiquement à l'exploitant. Art. 6 §1 c seulement pour répondre aux obligations de droits/incidents réellement applicables (art. 12–22/33), pas pour tous les logs. |
| Destinataires / prestataires | GitHub pour Pages ; Supabase et messagerie pour services configurés ; équipes support/administration réellement habilitées à établir. Pas de destinataire analytics ajouté. |
| Transferts | F01/F08/F13 et matrice des prestataires ; D05/D06 : pays et garanties non établis au niveau du projet. |
| Conservation | A : pas de collecte serveur de logs applicatifs développée dans le dépôt ; les capacités décrites dans les guides fournisseur ne prouvent pas le plan réel (F). D07 : contenu, durées et sauvegardes effectifs inconnus. |
| Sécurité | A : séparation configuration publique/secrets, allowlist d'artefact Pages, tests isolés et CI sans déploiement sur PR ; aucune protection des données privées ne doit reposer sur un lien masqué. Contrôles d'administration réels non vérifiés. |
| Suppression/archivage | D08 : distinguer journaux nécessaires, copies en sauvegarde et données actives ; définir rétablissement après restauration et traitement des secrets d'URL sans exposer les logs. |
| Risques / décisions ouvertes | Logs d'identifiants/liens, erreur de configuration, accès privilégiés et fuite par fichier public : R09/R10/R12. D05/D06/D07/D13/D14. |

## Validation et maintenance (D/E/F)

Pour chaque activité, consigner dans le registre interne : personne habilitée à décider, base choisie et justification, destinataires réels, événement/durée d'effacement, garanties de transfert et date de revue. Relier la désignation approuvée aux preuves privées avant ouverture. Garder les contrats et habilitations détaillées en espace restreint.

Toute finalité future (accès formateur, évaluation officielle, recherche, audience, administration de promotion) doit déclencher une revue du registre et de l'information avant mise en œuvre. Les éléments non décidés sont suivis dans [DECISIONS-A-VALIDER](DECISIONS-A-VALIDER.md), les futures preuves dans [PREPARATION-DROITS](PREPARATION-DROITS.md).
