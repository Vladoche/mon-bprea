# Cadrage Mon BPREA — six adultes maximum

**PROJET DE CADRE D'EXPLOITATION — 28 octobre 2026, lot 6.5.1. OUVERTURE NON AUTORISÉE.** Les déclarations ci-dessous sont acquises pour ce cadrage ; elles n'approuvent ni qualification juridique ni configuration hébergée. Suivi unique : [D01–D14](DECISIONS-A-VALIDER.md) et [P0-01 à P0-15](DOSSIER-PREOUVERTURE.md).

## Méthode applicable aux ajouts 6.5.1

| Nature | Sens et source attendue |
| --- | --- |
| A — fait technique vérifié | Dépôt, métadonnée GitHub ou test identifié, avec périmètre et référence. |
| B — fait déclaré par l'exploitant | Déclarations du mandat 6.5.1 reçu le 28/10/2026 ; pas une constatation juridique. |
| C — information réglementaire vérifiée | Source officielle et date de consultation ; application au projet à argumenter. |
| D — recommandation | Proposition proportionnée, sans approbation implicite. |
| E — décision à confirmer | Choix restant à l'exploitant, rattaché à D01–D14. |
| F — vérification extérieure manquante | Pièce privée, contrat, réglage ou preuve hébergée absent du dépôt. |

Les inventaires et bilans historiques 6.4 conservent leur légende A/B/C/D d'origine ; leur B documentaire et leur C de recommandation ne doivent pas être lus comme les B/C de cette méthode. Les documents actualisés précisent leur méthode. Les identifiants de données D01–D07 de l'inventaire sont distincts des **décisions D01–D14**.

## Périmètre déclaré (B)

Mon BPREA est développé et exploité personnellement, indépendamment de l'établissement de formation. Il est destiné à l'exploitant et aux cinq autres membres de sa promotion : **six adultes maximum**. Les cinq camarades sont tous majeurs ; aucune vérification documentaire d'âge ni collecte de date de naissance n'est ajoutée. L'usage est entièrement facultatif et personne ne doit créer de compte.

La finalité est la révision et l'entraînement pendant le BPREA. Les résultats individuels doivent rester privés. Aucun accès enseignant ou formateur, remontée officielle de résultats, notation officielle ou usage institutionnel n'est prévu dans ce modèle. L'accès personnel se fait sur invitation, sans inscription libre. L'horizon annoncé du service personnel est la fin de formation en **juin 2027**, sans jour de fermeture ni purge approuvés.

L'absence d'affiliation déclarée n'est pas une attestation de l'établissement. Aucun partenaire, contrat pédagogique, société, activité commerciale ou rôle de responsable conjoint n'est inventé. Si les pratiques changent (usage imposé, décisions essentielles prises par l'établissement, diffusion des résultats), l'exploitant doit rouvrir D01/D02/D03/D09/D11 avant cet usage.

## Deux périmètres et trois visibilités

| Objet | Fait vérifié A et limite | Conséquence D/E |
| --- | --- | --- |
| Dépôt | API GitHub `get_repo`, 28/10/2026 : `Vladoche/mon-bprea`, visibilité **public**. | Tous les documents Git suivis sont potentiellement publics, même exclus de Pages ; contrats, identités, coordonnées privées et dossiers nominatifs restent hors Git. |
| Site visiteur | `scripts/prepare-pages.py::public_files` publie les HTML racine, ressources autorisées et PDF ; aucun contrôle de connexion pour les consulter. `.github/workflows/deploy.yml` publie sur `main`/déclenchement manuel. | Les six comptes ne rendent pas GitHub Pages privé. La visibilité réelle du site/CDN n'est pas auditée ici (F). Le mode visiteur peut servir à un public de passage, sans étendre le public des comptes. |
| Espace personnel | `assets/auth-config.json` : `enabled:false`, URL/clé vides. Trois migrations sous `supabase/migrations/` : propriété UUID, RLS/grants et cascades ; aucune vue formateur ou classement public dans ce périmètre. Preuves : [matrice 6.4](MATRICE-CONFORMITE-ET-PREUVES.md). | Six comptes est une limite d'exploitation déclarée, **pas un quota serveur implémenté**. Les données sont protégées par les contrôles Supabase, pas par la confidentialité de l'URL. État distant, accès administratifs et réglages à vérifier (F). |

Les cinq finalités R01–R05 du [registre](REGISTRE-TRAITEMENTS.md) couvrent accès/sessions, profil, progression/synchronisation, ITK/apparence et exploitation minimale. Export, assistance et suppression soutiennent ces finalités et l'exercice des droits ; pas de nouvelle utilisation des résultats. Absence de badges et taux calculés sur les exercices réalisés conservés.

## Questions opérationnelles, sans décision présumée (E)

| Question / décision existante | Options et conséquences à valider |
| --- | --- |
| Gratuité, publicité, exploitation commerciale — D01/D03/D09/D12 | D : privilégier gratuité et aucune publicité/audience supplémentaire pour ce périmètre. La gratuité et l'absence d'exploitation commerciale ne sont pas déclarées dans les dix faits. A : aucun outil publicitaire/analytics applicatif détecté par l'inventaire X06 ; F : réglages hébergés non vérifiés. Une autre option impose une nouvelle analyse avant mise en œuvre. |
| Source des adresses — D10 | D : chaque camarade fournit volontairement son adresse après information. E : confirmer ce circuit ; sinon documenter la source indirecte et adapter l'information. Ne pas récupérer une liste institutionnelle par défaut. |
| Après juin 2027 — D07/D08/D14 | Fermer les seuls comptes et garder les contenus publics, ou fermer aussi le site ; la seconde option ne supprime ni caches ni données fournisseur. Voir les trois [scénarios](CALENDRIER-FERMETURE-PROJET.md). |
| Besoin de récupérer l'historique — D07/D08/D10 | Demander aux participants leur besoin avant de fixer la fenêtre ; proposer le JSON et l'assistance complémentaire. Préférer une copie conservée par la personne à une archive centrale indéfinie. Aucun souhait individuel présumé. |

## Organisation proposée (D), décisions restantes (E/F)

Un exploitant peut cumuler invitation, contact, support et interventions autorisées ; aucune direction, équipe pédagogique ou DPO n'est créé. S'il détermine effectivement finalités et moyens et si le RGPD s'applique, la **personne physique exploitante est le responsable potentiel** (D01). Préparer en interne identité de désignation, contact autorisé, périmètre/territoire, capacité à répondre et disponibilité jusqu'à la fermeture ; aucune adresse personnelle n'est publiée automatiquement. Ni société ni convention avec l'établissement n'est un préalable automatique.

Recommandations à décider : [analyse à deux branches](ANALYSE-EXCEPTION-PERSONNELLE-PROJET.md), [exploitation légère et checklist 6.5.2](PLAN-EXPLOITATION-LEGERE.md), [projet court d'information](POLITIQUE-CONFIDENTIALITE-PROJET.md), [conservation](POLITIQUE-CONSERVATION-PROJET.md). Les pièces F (contrats, région, SMTP, MFA, backups/logs, restauration, recette hébergée) restent nécessaires avant invitation selon le dossier P0. Aucun P0 n'est levé par ces seules déclarations.
