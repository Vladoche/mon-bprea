# Projet de registre des traitements — lot 6.4.1

**PROJET INTERNE NON VALIDÉ — actualisé le 28 octobre 2026, lot 6.4.4.** Ce fichier public ne constitue ni le registre complet de l'exploitant ni la politique de confidentialité. Il en prépare les fiches sans coordonnées personnelles, contrat privé ou information de sécurité confidentielle. A/B/C/D : [méthode de l'inventaire](INVENTAIRE-DONNEES.md). Identifiants des données/flux dans l'inventaire et [Flux et prestataires](FLUX-ET-PRESTATAIRES.md). Aucune base légale ou durée approuvée par cette actualisation.

**B :** l'article 30 distingue le registre du responsable de celui du sous-traitant. Le projet rassemble finalités, personnes, données, destinataires, transferts, délais et sécurité ; les bases légales et risques complètent ce socle. Source : [CNIL — registre](https://www.cnil.fr/fr/RGPD-le-registre-des-activites-de-traitement), consultée le 27/10/2026. Le statut et le rôle de l'organisme restent à établir ; ne pas invoquer automatiquement la dérogation des petites structures pour des traitements pédagogiques réguliers.

## En-tête à compléter dans le registre interne (D)

| Champ | État et preuve attendue |
| --- | --- |
| Responsable du traitement / représentant éventuel | Non identifié. Déterminer qui décide des finalités et moyens essentiels, documenter l'entité légale et ses coordonnées autorisées (D01). Le propriétaire du dépôt, le développeur ou un établissement ne sont pas désignés par défaut. |
| Responsables conjoints / donneur d'instructions | Non déterminés ; rôle d'un éventuel établissement à instruire (D02). Accord et répartition si décision conjointe ; contrat/instructions si sous-traitance. |
| DPO / point de contact droits | Désignation éventuelle et canal opérationnel à confirmer (D04), aucun contact inventé. |
| Gestionnaire du registre et validation | Personne/fonction à désigner ; date/version et décisions approuvées à tenir hors données confidentielles du dépôt. |
| Personnes concernées | A : utilisateurs du navigateur visiteur et comptes préparés. D : étudiants réellement visés, adultes/mineurs, effectifs, établissements et caractère facultatif/obligatoire de l'usage (D09). |
| Statut des traitements | A : capacités relues sur la fusion #23 `1bddaece…`, copie partielle, retrait local et clôture locale éphémère préparés ; Auth publique désactivée. Ni volume ni activité étudiante hébergée vérifiés. |

## Options de licéité à instruire, aucune base retenue (B/D)

Les options de l'article 6 ne sont pas interchangeables : **contrat** seulement pour un traitement objectivement nécessaire à la prestation convenue ; **mission d'intérêt public** avec fondement et mandat établis ; **obligation légale** avec texte précis ; **intérêt légitime** après nécessité et mise en balance, sans appliquer cette option aux autorités publiques dans leurs missions ; **consentement** libre, spécifique, éclairé et retirable, sans conséquence injustifiée dans une relation de dépendance. Source : [RGPD, chapitre II, art. 6–7](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2), consultation 27/10/2026.

**D03 :** l'exploitant doit retenir et justifier une base **par finalité**, après clarification de D01/D02/D09. Aucune case « J'accepte le RGPD », acceptation de notice ou décision d'import n'en tient lieu. Les pistes ci-dessous sont des **options à évaluer**, pas des fondements déjà valides. L'exemption éventuelle d'un accès au terminal est une analyse distincte ([traceurs](FLUX-ET-PRESTATAIRES.md)).

## R01 — Accéder à un compte personnel et le sécuriser

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : permettre connexion sur invitation, activation, récupération et session personnelle. Capacité développée, Auth publique désactivée. Ne comprend pas la création libre de comptes. |
| Responsable / personnes | D01/D02, non attribués ; personnes invitées et titulaires de comptes, public exact D09. |
| Données et origine | A01–A04/A06–A07 : adresse transmise par l'invitant, UUID et métadonnées Auth, preuves temporaires, session SDK et marqueur local ; mot de passe saisi directement. F04/F07/F08/F10. Source de l'adresse et relation avec l'invitant : D10, importante pour information indirecte. |
| Base envisagée | D03 : contrat ou mission fondée si nécessaires à l'accès proposé ; intérêt légitime à évaluer selon exploitant et contexte ; pas de consentement par défaut. Distinguer sécurité et communication d'invitation de toute prospection. |
| Destinataires / prestataires | A : titulaire via interface, Auth/SDK, service d'invitation de confiance préparé. D : opérateurs effectivement habilités, chaîne Supabase/SMTP/messagerie et rôles. Aucun accès formateur aux comptes n'est démontré par le frontend. |
| Transferts | D05/D06 : région/accès support et relais e-mail non vérifiés ; ne pas annoncer « exclusivement UE ». Matrice des prestataires de référence. |
| Conservation | A : aucune échéance du compte définie dans l'application ; session persistée, retrait SDK lors de signOut local réussi. B : durée Auth configurable [sessions](https://supabase.com/docs/guides/auth/sessions), consultation 27/10/2026. D07 : paramètres, logs et backups réels inconnus. |
| Sécurité | A : configuration publique désactivée, HTTPS requis en hébergé, `getUser`, identités/générations, lien nettoyé et confirmation explicite ; pas de secret administratif côté client. Config locale sans signup/anonyme, état hébergé à revalider au lot 6.5. |
| Suppression/archivage | A : déconnexion conservant la progression ; prototype local de clôture réauthentifiée avec capacité temporaire A08 et cascades. Pas de service hébergé de clôture/droits. C/D08 : traiter liens, logs, backups et appareils absents ; aucun JWT instantanément révoqué garanti. |
| Risques / décisions ouvertes | Accès sur appareil partagé, JWT et session SDK accessibles au profil navigateur, liens dans journaux initiaux, invitation adressée à tort ; R01–R03/R09/R10 des [risques](DECISIONS-A-VALIDER.md). D01 à D07/D09/D10. |

## R02 — Personnaliser l'identification affichée du compte

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : retrouver un profil minimal privé et un pseudo facultatif ; pas d'annuaire public ni de classement. |
| Responsable / personnes | D01/D02 ; titulaires de comptes, périmètre D09. |
| Données et origine | A05 : UUID fourni par Auth, pseudo saisi par l'utilisateur, dates serveur. Table `public.profiles`. E-mail affiché depuis Auth, pas dupliqué dans le profil SQL. |
| Base envisagée | D03 : examiner la nécessité du profil technique pour R01 et celle du pseudo pour cette personnalisation ; ne pas supposer que son caractère facultatif vaut consentement. Si pas de finalité utile démontrée, C : réexaminer la collecte. |
| Destinataires / prestataires | A : seul compte propriétaire via SELECT propre, Supabase DB ; D : administrateurs habilités et chaîne fournisseur. Pas de vue des profils d'autres comptes autorisée par les policies. |
| Transferts | D05/D06 : mêmes inconnues Supabase que R01, hors hypothèse d'usage SMTP du pseudo non observée. |
| Conservation | A : ligne liée au compte, pas de TTL ; pseudo remplaçable, dates créées/mises à jour, pas d'historique de pseudos applicatif. D07 : durée du compte et backups. |
| Sécurité | A : RLS `auth.uid()=id`, UPDATE de la seule colonne `pseudo`, pas INSERT/DELETE étudiant ; trigger privé de création ; [migration profils](../../supabase/migrations/20261022000100_profiles.sql). |
| Suppression/archivage | A : pseudo rectifiable, copie du profil sous UUID vérifié ; cascade depuis Auth exercée par prototype éphémère. D : exceptions, copies et sauvegardes à traiter selon règles approuvées et service hébergé autorisé. |
| Risques / décisions ouvertes | Réidentification via pseudo, accès administratif ; R02/R10. D01/D03/D05/D06/D07 et présentation du caractère facultatif D10. |

## R03 — Reprendre son apprentissage et consulter ses résultats

Cette finalité regroupe états de cours, résultats, historiques d'entraînement et leur sauvegarde/synchronisation : ce sont les sources de la même reprise pédagogique personnelle. Les tables, le Dashboard et les caches ne constituent pas autant de finalités séparées. Une future utilisation par un établissement pour évaluer, sanctionner ou suivre une promotion imposera une analyse distincte ; elle n'est pas déduite du schéma présent.

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : conserver cours terminés, premières réponses et entraînements, QCM et botanique, retrouver l'historique, réviser les erreurs et calculer les statistiques descriptives. Visiteur local actif selon code ; personnel synchronisé seulement si configuré. |
| Responsable / personnes | D01/D02 ; utilisateur visiteur ou compte, attribution des sources locales et public D09. Pas de preuve de certification ni d'accès formateur à ces résultats. |
| Données et origine | D01–D07/Q01–Q05/B01–B05 : choix/réponses, états, scores, catégories/UC/questions, dates/durées et identifiants techniques, copies locales/distantes et bruts d'import. Actions du navigateur, calculs et horodatages serveur ; les anciens scores partiels restent partiels. F02/F03/F05/F06/F09. |
| Base envisagée | D03 : nécessité contractuelle ou mission fondée à examiner selon relation de formation ; éventuel intérêt légitime après analyse du public et des attentes. C : ne pas conditionner l'enseignement à un consentement artificiel. Chaque usage secondaire futur doit être décidé séparément. |
| Destinataires / prestataires | A : utilisateur du profil navigateur ; compte propriétaire via RLS et Supabase DB pour synchronisation. D : admins habilités, établissement éventuel et rôle exact. L'import volontaire n'autorise pas l'envoi de données appartenant à autrui. |
| Transferts | A : local sans API pédagogique distante en visiteur ; compte configuré vers Supabase. D05/D06 : pays/chaîne et accès privilégiés. Pas de transfert des résultats aux sites de ressources identifié. |
| Conservation | A : historiques append-only sans échéance dans le code ; Dashboard recalculé, pas de table de statistiques supplémentaire ; outboxes/conflits/bruts locaux conservés après déconnexion. D07 : durée pédagogique utile, fin de formation, éventuelles archives justifiées non définies. |
| Sécurité | A : RLS, contraintes, grants, UUID durable/retry exact, CAS des états modifiables, cache cloisonné par portée, transactions atomiques, imports non implicites et validation. Scores QCM/botaniques déclaratifs, pas résultats d'examen certifiés. |
| Suppression/archivage | A : copie JSON partielle des dix tables et compléments locaux ; bruts/champs inconnus exclus. Retrait local sélectionné des caches/archives/imports et barrière X10 ; cascades via clôture locale seulement. Aucun anonymat des archives ni retrait des copies absentes présumé. C/D : procédure complémentaire de droits et restauration contrôlée. |
| Risques / décisions ouvertes | Mélange A/B, source visiteur étrangère, conservation excessive, pertes hors ligne, export incomplet et réapparition après suppression : R01–R08/R10/R11. D03/D07/D08/D09/D11 ; examen AIPD à formaliser. |

## R04 — Retrouver ses paramètres d'utilisation

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : reprendre les huit derniers paramètres ITK, les choix saison/luminosité, masquer l'anecdote du jour. Pas de stockage du document ITK complet ni d'historique du rendu automatique. |
| Responsable / personnes | D01/D02 ; visiteurs/comptes, public D09. |
| Données et origine | I01–I03/P01–P05/X01 : saisie formulaire et choix explicites, date facultative de préférence, données techniques de synchronisation/import ; saison et heure de rendu calculées localement. |
| Base envisagée | D03 : examiner nécessité pour le service demandé selon options communes ; l'analyse de la persistance terminal doit rester spécifique, y compris anciennes clés et sources brutes. Aucun usage marketing observé. |
| Destinataires / prestataires | A : profil navigateur ; Supabase pour derniers paramètres/choix personnels configurés ; téléchargement/impression utilisateur pour résultats reconstruits. Aucun service météo/solaire constaté. D : admins et copies OS éventuelles. |
| Transferts | A : pas d'envoi de calendrier/CSV/PDF complet ; singletons personnels vers Supabase. D05/D06 pour prestataire. |
| Conservation | A : dernière valeur, anciennes clés visiteur préservées ; bornes en nombre du cache P05, pas de TTL. X01 stocke un jour masqué sans nettoyage journalier de la clé. D07 : durée utile et copies importées à définir. |
| Sécurité | A : validation des huit champs, portée, CAS et outbox ; apparence `auto` préservée, valeurs personnelles appliquées après identité, aucune donnée de compte en attribut CSS. |
| Suppression/archivage | A : copie normalisée et retrait local ITK/apparence séparables si archives attribuables ; clés anciennes visiteur sélectionnées distinctement. Contrôle des singletons dans la clôture locale. Fichiers téléchargés/imprimés hors contrôle ; rétention et compléments de droits à valider. |
| Risques / décisions ouvertes | Copies résiduelles, appareil partagé, outbox incertaine et fichiers exportés sur l'OS : R02–R04/R07/R08. D03/D07/D08/D12. |

## R05 — Fournir le site et assurer son exploitation technique

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : distribuer les contenus publics et gérer les erreurs locales/réseau ; B : sécurité de l'infrastructure chez Pages. Traitements propres aux fournisseurs à distinguer de ceux décidés par l'exploitant. |
| Responsable / personnes | D01/D05 ; visiteurs et comptes des futures API, opérateurs d'exploitation éventuels. Le registre peut nécessiter une activité propre au prestataire, sans l'attribuer à l'exploitant par défaut. |
| Données et origine | X03/X05/X07/X09 : requêtes/URLs, IP côté hébergeur selon [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection), relu le 28/10/2026 ; logs API/Auth/Edge/SMTP possibles mais non inspectés. X10 assure la coordination locale par portée UUID. Pas de mesure d'audience applicative identifiée. |
| Base envisagée | D03/D05 : nécessité de sécurité et éventuel intérêt légitime documenté selon acteur ; obligation légale seulement avec texte identifié. Aucun fondement déduit de la seule existence de logs. |
| Destinataires / prestataires | GitHub pour Pages ; Supabase et messagerie pour services configurés ; équipes support/administration réellement habilitées à établir. Pas de destinataire analytics ajouté. |
| Transferts | F01/F08/F13 et matrice des prestataires ; D05/D06 : pays et garanties non établis au niveau du projet. |
| Conservation | A : pas de collecte serveur de logs applicatifs développée dans le dépôt ; B : capacités fournisseur. D07 : contenu, durées, sauvegardes et plans effectifs inconnus. |
| Sécurité | A : séparation configuration publique/secrets, allowlist d'artefact Pages, tests isolés et CI sans déploiement sur PR ; aucune protection des données privées ne doit reposer sur un lien masqué. Contrôles d'administration réels non vérifiés. |
| Suppression/archivage | D08 : distinguer journaux nécessaires, copies en sauvegarde et données actives ; définir rétablissement après restauration et traitement des secrets d'URL sans exposer les logs. |
| Risques / décisions ouvertes | Logs d'identifiants/liens, erreur de configuration, accès privilégiés et fuite par fichier public : R09/R10/R12. D05/D06/D07/D13/D14. |

## Validation et maintenance (C/D)

Pour chaque activité, consigner dans le registre interne : personne habilitée à décider, base choisie et justification, destinataires réels, événement/durée d'effacement, garanties de transfert et date de revue. Compléter la ligne de responsable avant usage officiel. Les coordonnées, contrats et habilitations détaillées n'ont pas leur place dans ce dépôt potentiellement public.

Toute finalité future (accès formateur, évaluation officielle, recherche, audience, administration de promotion) doit déclencher une revue du registre et de l'information avant mise en œuvre. Les éléments non décidés sont suivis dans [DECISIONS-A-VALIDER](DECISIONS-A-VALIDER.md), les futures preuves dans [PREPARATION-DROITS](PREPARATION-DROITS.md).
