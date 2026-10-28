# Projet de registre des traitements — lot 6.4.1

**PROJET INTERNE NON VALIDÉ — actualisé le 28 octobre 2026, lot 6.5.1.** Ce fichier public ne constitue ni le registre complet de l'exploitant ni la politique de confidentialité. Il en prépare les fiches sans coordonnées personnelles, contrat privé ou information de sécurité confidentielle. Méthode actualisée [A–F du cadrage](CADRAGE-MON-BPREA-SIX-ADULTES.md) ; identifiants techniques de données inchangés. Identifiants des données/flux dans l'inventaire et [Flux et prestataires](FLUX-ET-PRESTATAIRES.md). Aucune base légale ou durée approuvée par cette actualisation.

**C :** l'article 30 distingue le registre du responsable de celui du sous-traitant. Le projet rassemble finalités, personnes, données, destinataires, transferts, délais et sécurité ; les bases légales et risques complètent ce socle. Source : [CNIL — registre](https://www.cnil.fr/fr/RGPD-le-registre-des-activites-de-traitement), consultée le 27/10/2026. La qualification personnelle/domestique et la désignation de la personne physique exploitante restent à valider (D01) ; ne pas invoquer automatiquement la dérogation des petites structures pour des traitements pédagogiques réguliers.

## En-tête à compléter dans le registre interne (E/F)

| Champ | État et preuve attendue |
| --- | --- |
| Responsable du traitement / représentant éventuel | B : exploitant personnel indépendant déterminant le service ; responsable potentiel comme personne physique si le RGPD s'applique. E : D01 doit acter ce rôle, identité/contact autorisés et territoire en interne, sans publication automatique d'adresse personnelle. Voir l'analyse des deux branches. |
| Responsables conjoints / donneur d'instructions | B : aucun rôle institutionnel, service imposé, accès formateur ou remontée officielle prévus. E : D02 doit acter l'indépendance, réexaminer si les pratiques changent ; aucun conjoint ni contrat pédagogique présumé. |
| DPO / point de contact droits | Désignation éventuelle et canal opérationnel à confirmer (D04), aucun contact inventé. |
| Gestionnaire du registre et validation | Personne/fonction à désigner ; date/version et décisions approuvées à tenir hors données confidentielles du dépôt. |
| Personnes concernées | A : visiteurs de pages publiques, distincts des comptes. B : espace personnel pour l'exploitant et cinq camarades majeurs, six adultes maximum, facultatif sans compte imposé ; fin de formation juin 2027. E : validation de périmètre D09, gratuité/non-commercial et après-formation à confirmer. |
| Statut des traitements | A : capacités relues sur la fusion #24 `39a5196…`, copie partielle, retrait local et clôture locale éphémère préparés ; Auth publique désactivée. Ni volume ni activité étudiante hébergée vérifiés. |

## Options de licéité à instruire si RGPD applicable (C/D/E)

Les options de l'article 6 ne sont pas interchangeables : **contrat** seulement pour un traitement objectivement nécessaire à la prestation convenue ; **mission d'intérêt public** avec fondement et mandat établis ; **obligation légale** avec texte précis ; **intérêt légitime** après nécessité et mise en balance, sans appliquer cette option aux autorités publiques dans leurs missions ; **consentement** libre, spécifique, éclairé et retirable, sans conséquence injustifiée dans une relation de dépendance. Source : [RGPD, chapitre II, art. 6–7](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2), consultation 28/10/2026.

**D03 :** l'exploitant doit retenir et justifier une base **par finalité**, après qualification D01/D02 et prise en compte des faits déclarés D09. Aucune case « J'accepte le RGPD », acceptation de notice ou décision d'import n'en tient lieu. Les pistes ci-dessous sont des **options à évaluer**, pas des fondements déjà valides. L'exemption éventuelle d'un accès au terminal est une analyse distincte ([traceurs](FLUX-ET-PRESTATAIRES.md)).

La qualification reste ouverte dans l'[analyse personnelle/domestique](ANALYSE-EXCEPTION-PERSONNELLE-PROJET.md). Les options ci-dessous ne s'activent juridiquement qu'après D01/D03 ; le périmètre B ne prouve ni contrat de service ni consentement. Export, rectification, assistance et suppression soutiennent R01–R05 ; si le RGPD s'applique, leurs obligations sont à qualifier avec D04, sans base de consentement générale. Le dossier minimal de demande et la sécurité ont leurs propres nécessités et durées. Le [calendrier](CALENDRIER-FERMETURE-PROJET.md) et la [politique de conservation](POLITIQUE-CONSERVATION-PROJET.md) s'appliquent à chacune des cinq fiches ; aucun délai résiduel n'est approuvé.

## R01 — Accéder à un compte personnel et le sécuriser

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : permettre connexion sur invitation, activation, récupération et session personnelle. Capacité développée, Auth publique désactivée. Ne comprend pas la création libre de comptes. |
| Responsable / personnes | B : six adultes invités au maximum, exploitant indépendant ; E : rôle juridique D01/D02 et périmètre D09 à acter. |
| Données et origine | A01–A04/A06–A07 : adresse transmise par l'invitant, UUID et métadonnées Auth, preuves temporaires, session SDK et marqueur local ; mot de passe saisi directement. F04/F07/F08/F10. Source de l'adresse et relation avec l'invitant : D10, importante pour information indirecte. |
| Base envisagée | E/D03 : contrat seulement si un service convenu et la nécessité objective de l'accès/synchronisation sont établis, sans contrat de formation inventé. Intérêt légitime possible pour accès/sécurité après nécessité et mise en balance ; consentement distinct seulement si ses conditions sont démontrées. Aucune mission publique présumée. Invitation demandée/acceptée ≠ consentement juridique général. |
| Destinataires / prestataires | A : titulaire via interface, Auth/SDK, service d'invitation de confiance préparé. F : opérateurs effectivement habilités, chaîne Supabase/SMTP/messagerie et rôles. Aucun accès formateur aux comptes n'est démontré par le frontend. |
| Transferts | D05/D06 : région/accès support et relais e-mail non vérifiés ; ne pas annoncer « exclusivement UE ». Matrice des prestataires de référence. |
| Conservation | A : aucune échéance du compte définie dans l'application ; session persistée, retrait SDK lors de signOut local réussi. A documentaire technique : possibilités de configuration [sessions](https://supabase.com/docs/guides/auth/sessions), consultation 28/10/2026 ; F : réglages/plan effectifs inconnus. D07 : paramètres, logs et backups à vérifier. |
| Sécurité | A : configuration publique désactivée, HTTPS requis en hébergé, `getUser`, identités/générations, lien nettoyé et confirmation explicite ; pas de secret administratif côté client. Config locale sans signup/anonyme, état hébergé à revalider au lot 6.5. |
| Suppression/archivage | A : déconnexion conservant la progression ; prototype local de clôture réauthentifiée avec capacité temporaire A08 et cascades. Pas de service hébergé de clôture/droits. D/E/D08 : traiter liens, logs, backups et appareils absents ; aucun JWT instantanément révoqué garanti. |
| Risques / décisions ouvertes | Accès sur appareil partagé, JWT et session SDK accessibles au profil navigateur, liens dans journaux initiaux, invitation adressée à tort ; R01–R03/R09/R10 des [risques](DECISIONS-A-VALIDER.md). D01 à D07/D09/D10. |

## R02 — Personnaliser l'identification affichée du compte

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : retrouver un profil minimal privé et un pseudo facultatif ; pas d'annuaire public ni de classement. |
| Responsable / personnes | B : titulaires des six comptes maximum ; E : D01/D02/D09 à acter. |
| Données et origine | A05 : UUID fourni par Auth, pseudo saisi par l'utilisateur, dates serveur. Table `public.profiles`. E-mail affiché depuis Auth, pas dupliqué dans le profil SQL. |
| Base envisagée | E/D03 : rattacher le profil UUID nécessaire à R01 ; pour le pseudo facultatif, examiner nécessité du service demandé ou intérêt légitime documenté ; consentement seulement spécifique et retirable si retenu. D : réexaminer toute collecte sans utilité. Le caractère facultatif seul ne vaut pas consentement. |
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
| Responsable / personnes | A : visiteur local ou compte, source locale à attribuer ; B : six adultes pour l'espace personnel, résultats privés sans accès formateur ni évaluation officielle prévus ; E : D01/D02/D09 à acter. |
| Données et origine | D01–D07/Q01–Q05/B01–B05 : choix/réponses, états, scores, catégories/UC/questions, dates/durées et identifiants techniques, copies locales/distantes et bruts d'import. Actions du navigateur, calculs et horodatages serveur ; les anciens scores partiels restent partiels. F02/F03/F05/F06/F09. |
| Base envisagée | E/D03 : nécessité d'une sauvegarde/synchronisation expressément demandée si prestation convenue ; sinon examiner intérêt légitime (bénéfice de reprise, alternative visiteur, minimisation et attentes). Un consentement éventuel suppose choix spécifique, preuve et retrait simples. Aucun fondement de mission d'enseignement institutionnelle ; usage volontaire ne vaut pas consentement global. Usage secondaire à réexaminer avant action. |
| Destinataires / prestataires | A : utilisateur du profil navigateur ; compte propriétaire via RLS et Supabase DB pour synchronisation. F : administrateurs réellement habilités et prestataires ; B : aucun destinataire institutionnel prévu. L'import volontaire n'autorise pas l'envoi de données appartenant à autrui. |
| Transferts | A : local sans API pédagogique distante en visiteur ; compte configuré vers Supabase. D05/D06 : pays/chaîne et accès privilégiés. Pas de transfert des résultats aux sites de ressources identifié. |
| Conservation | A : historiques append-only sans échéance dans le code ; Dashboard recalculé, pas de table de statistiques supplémentaire ; outboxes/conflits/bruts locaux conservés après déconnexion. B : horizon juin 2027 ; E/D07 : T et fenêtre du calendrier de fermeture, durée résiduelle motivée par catégorie, aucune archive par défaut. |
| Sécurité | A : RLS, contraintes, grants, UUID durable/retry exact, CAS des états modifiables, cache cloisonné par portée, transactions atomiques, imports non implicites et validation. Scores QCM/botaniques déclaratifs, pas résultats d'examen certifiés. |
| Suppression/archivage | A : copie JSON partielle des dix tables et compléments locaux ; bruts/champs inconnus exclus. Retrait local sélectionné des caches/archives/imports et barrière X10 ; cascades via clôture locale seulement. Aucun anonymat des archives ni retrait des copies absentes présumé. D/E : procédure complémentaire de droits et restauration contrôlée. |
| Risques / décisions ouvertes | Mélange A/B, source visiteur étrangère, conservation excessive, pertes hors ligne, export incomplet et réapparition après suppression : R01–R08/R10/R11. D03/D07/D08/D09/D11 ; examen AIPD à formaliser. |

## R04 — Retrouver ses paramètres d'utilisation

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : reprendre les huit derniers paramètres ITK, les choix saison/luminosité, masquer l'anecdote du jour. Pas de stockage du document ITK complet ni d'historique du rendu automatique. |
| Responsable / personnes | A : visiteurs ; B : six adultes maximum pour les comptes ; E : D01/D02/D09 à acter. |
| Données et origine | I01–I03/P01–P05/X01 : saisie formulaire et choix explicites, date facultative de préférence, données techniques de synchronisation/import ; saison et heure de rendu calculées localement. |
| Base envisagée | E/D03 : nécessité de retrouver ITK/apparence demandés si service convenu, intérêt légitime à justifier ou consentement spécifique si retenu ; ne pas traiter le rendu local automatique comme une finalité de profilage. E/D12 : analyse terminal séparée, anciennes clés et bruts compris ; absence de marketing observé A, intention à confirmer B/E. |
| Destinataires / prestataires | A : profil navigateur ; Supabase pour derniers paramètres/choix personnels configurés ; téléchargement/impression utilisateur pour résultats reconstruits. Aucun service météo/solaire constaté. F : admins et copies OS éventuelles. |
| Transferts | A : pas d'envoi de calendrier/CSV/PDF complet ; singletons personnels vers Supabase. D05/D06 pour prestataire. |
| Conservation | A : dernière valeur, anciennes clés visiteur préservées ; bornes en nombre du cache P05, pas de TTL. X01 stocke un jour masqué sans nettoyage journalier de la clé. D07 : durée utile et copies importées à définir. |
| Sécurité | A : validation des huit champs, portée, CAS et outbox ; apparence `auto` préservée, valeurs personnelles appliquées après identité, aucune donnée de compte en attribut CSS. |
| Suppression/archivage | A : copie normalisée et retrait local ITK/apparence séparables si archives attribuables ; clés anciennes visiteur sélectionnées distinctement. Contrôle des singletons dans la clôture locale. Fichiers téléchargés/imprimés hors contrôle ; rétention et compléments de droits à valider. |
| Risques / décisions ouvertes | Copies résiduelles, appareil partagé, outbox incertaine et fichiers exportés sur l'OS : R02–R04/R07/R08. D03/D07/D08/D12. |

## R05 — Fournir le site et assurer son exploitation technique

| Rubrique | Fiche préparatoire |
| --- | --- |
| Finalité / statut | A : distribuer les contenus publics et gérer les erreurs locales/réseau ; A documentaire technique : GitHub décrit des logs IP de sécurité Pages (source ci-dessous), pas une qualification juridique de son rôle. Traitements propres aux fournisseurs à distinguer de ceux décidés par l'exploitant. |
| Responsable / personnes | D01/D05 ; visiteurs et comptes des futures API, opérateurs d'exploitation éventuels. Le registre peut nécessiter une activité propre au prestataire, sans l'attribuer à l'exploitant par défaut. |
| Données et origine | X03/X05/X07/X09 : requêtes/URLs, IP côté hébergeur selon [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection), relu le 28/10/2026 ; logs API/Auth/Edge/SMTP possibles mais non inspectés. X10 assure la coordination locale par portée UUID. Pas de mesure d'audience applicative identifiée. |
| Base envisagée | E/D03/D05 : intérêt légitime de sécurité/exploitation minimale après nécessité, minimisation et bilan ; obligation légale seulement si texte applicable identifié (notamment gestion des droits si RGPD applicable). Ne pas attribuer automatiquement à l'exploitant les traitements propres des fournisseurs. L'existence de logs ne prouve pas une base. |
| Destinataires / prestataires | GitHub pour Pages ; Supabase et messagerie pour services configurés ; équipes support/administration réellement habilitées à établir. Pas de destinataire analytics ajouté. |
| Transferts | F01/F08/F13 et matrice des prestataires ; D05/D06 : pays et garanties non établis au niveau du projet. |
| Conservation | A : pas de collecte serveur de logs applicatifs développée dans le dépôt ; les capacités décrites dans les guides fournisseur ne prouvent pas le plan réel (F). D07 : contenu, durées et sauvegardes effectifs inconnus. |
| Sécurité | A : séparation configuration publique/secrets, allowlist d'artefact Pages, tests isolés et CI sans déploiement sur PR ; aucune protection des données privées ne doit reposer sur un lien masqué. Contrôles d'administration réels non vérifiés. |
| Suppression/archivage | D08 : distinguer journaux nécessaires, copies en sauvegarde et données actives ; définir rétablissement après restauration et traitement des secrets d'URL sans exposer les logs. |
| Risques / décisions ouvertes | Logs d'identifiants/liens, erreur de configuration, accès privilégiés et fuite par fichier public : R09/R10/R12. D05/D06/D07/D13/D14. |

## Validation et maintenance (D/E/F)

Pour chaque activité, consigner dans le registre interne : personne habilitée à décider, base choisie et justification, destinataires réels, événement/durée d'effacement, garanties de transfert et date de revue. Compléter la ligne de responsable avant ouverture personnelle. Les coordonnées, contrats et habilitations détaillées n'ont pas leur place dans ce dépôt potentiellement public.

Toute finalité future (accès formateur, évaluation officielle, recherche, audience, administration de promotion) doit déclencher une revue du registre et de l'information avant mise en œuvre. Les éléments non décidés sont suivis dans [DECISIONS-A-VALIDER](DECISIONS-A-VALIDER.md), les futures preuves dans [PREPARATION-DROITS](PREPARATION-DROITS.md).
