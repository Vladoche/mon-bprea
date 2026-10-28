# Exception personnelle ou domestique — analyse préparatoire

**PROJET NON VALIDÉ — 28 octobre 2026. Qualification juridique ouverte.** Méthode A–F : [cadrage](CADRAGE-MON-BPREA-SIX-ADULTES.md). Décisions existantes D01/D02/D03/D09/D11 ; aucune exemption générale déclarée.

## Sources officielles consultées le 28/10/2026 (C)

| Source | Point vérifié et limite |
| --- | --- |
| [CNIL, les particuliers doivent-ils respecter le RGPD ?](https://www.cnil.fr/fr/cnil-direct/question/1817) | Le cadre strictement familial ou amical peut relever de l'exception ; un particulier peut aussi être responsable du traitement. Cette réponse ne qualifie pas Mon BPREA. |
| [RGPD sur CNIL, chapitre I](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre1) | Art. 2 §2 c : exception personnelle/domestique ; art. 4 §7 : responsable pouvant être une personne physique. L'absence de société n'exclut donc pas ce rôle. |
| [RGPD, chapitre II](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2) | Principes et licéité à examiner par finalité si applicable. |
| [CNIL, consentement](https://www.cnil.fr/fr/les-bases-legales/consentement), [intérêt légitime](https://www.cnil.fr/fr/les-bases-legales/interet-legitime) | Consentement libre/spécifique/éclairé/univoque et retrait démontrables ; intérêt légitime soumis à nécessité, attentes et mise en balance. Aucun n'est un fondement automatique. |
| [RGPD, chapitre III](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3), [information CNIL](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence) | Information accessible au bon moment et droits selon leurs conditions ; distinguer collecte directe et indirecte. |
| [RGPD, chapitre IV](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4) | Organisation proportionnée (art. 24), prestataires, sécurité, incidents, AIPD et critères DPO ; aucune obligation de créer une équipe institutionnelle déduite. |

L'accès [EUR-Lex au règlement](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32016R0679), y compris la route ELI, a été bloqué par une vérification antirobot. Les articles ont été lus sur CNIL ; aucune lecture du considérant 18 via EUR-Lex n'est revendiquée. Aucun avis CNIL ou arrêt propre à Mon BPREA n'a été trouvé ni n'est supposé.

## Appréciation des faits : deux branches, sans assimilation

| Critère | Éléments favorables à une sphère personnelle | Incertitude ou limite |
| --- | --- | --- |
| Auteur et but | B : développement personnel indépendant, révision de sa propre formation avec cinq camarades. | E : confirmer l'absence d'activité professionnelle/commerciale dans ce traitement ; « personnel » dans le langage courant n'est pas la qualification de l'art. 2. |
| Cercle | B : six adultes maximum, invitations, usage facultatif. | E : nature réellement privée/amicale de la relation non établie ; une promotion n'est pas automatiquement un cercle amical. Aucun questionnaire intime n'est recommandé. |
| Diffusion | B : résultats privés, aucun accès formateur ni remontée officielle prévus. A : RLS par UUID dans les migrations. | A : dépôt public et fichiers Pages publics distincts des comptes. F : accès effectifs, absence de partage de liens/fichiers privés et réglages hébergés à contrôler. |
| Portée et durée | B : fin de formation juin 2027, petit effectif. | Ni six personnes, ni gratuité éventuelle, ni durée limitée ne suffisent isolément. Les visiteurs publics et leurs flux doivent être examinés séparément. |
| Hébergement | A : Auth/PostgreSQL Supabase prévus, Pages et messagerie ; pas d'annuaire de résultats. | Un hébergement tiers ne tranche pas seul l'exception. F : contrats et traitements propres des fournisseurs ; leurs obligations ne disparaissent pas avec une éventuelle exemption de l'exploitant. |

### Hypothèse 1 — exception applicable au traitement strictement privé de l'exploitant

D : elle pourrait être défendable si la personne agit exclusivement à titre personnel, avec un cercle réellement privé/amical, sans but professionnel/commercial ni diffusion de données hors de ce cercle, et garde la maîtrise des destinataires. E : établir ces conditions et le périmètre précis ; ne pas étendre une conclusion concernant l'espace personnel à tous les flux du site public. La présence d'un site pédagogique public sans résultats nominatifs ne prouve à elle seule ni l'exemption ni son exclusion pour chaque traitement.

D : conserver information honnête, moindre accès, sécurité des comptes, export/assistance, retrait vérifié et fermeture maîtrisée. Les [P0](DOSSIER-PREOUVERTURE.md) restent les portes de sécurité et d'exploitation ; si une obligation est finalement inapplicable, consigner sa justification dans la décision existante plutôt que l'effacer silencieusement. Examiner séparément accès au terminal et engagements contractuels. Ne pas présenter les procédures volontairement maintenues comme des obligations juridiques déjà qualifiées.

### Hypothèse 2 — RGPD applicable

D : traiter l'exploitant personne physique comme responsable potentiel selon ses décisions effectives ; pas d'établissement gestionnaire présumé. Retenir les cinq fiches R01–R05, une notice courte complétée, un canal de droits et un dossier restreint des décisions et preuves. Le suivi régulier de progression ne bénéficie pas automatiquement d'une dispense de registre par sa petite taille (art. 30 §5). Un registre simple existant suffit de point de départ ; vérifier les conditions, sans exiger un logiciel de conformité.

D : justifier la base de chaque finalité dans le [registre](REGISTRE-TRAITEMENTS.md), fixer des événements/durées, vérifier contrats et transferts effectifs, limiter les accès privilégiés, tester demandes/incidents et restauration. L'[exploitation proposée](PLAN-EXPLOITATION-LEGERE.md) peut être tenue par la même personne ; aucun DPO automatique n'est inféré. D04 doit confronter les critères de l'art. 37 aux usages effectifs ; le conseil extérieur est ciblé sur les doutes, pas un poste inventé.

L'invitation acceptée, le compte créé volontairement, la notice reçue, le consentement juridique éventuel et la nécessité d'une fonctionnalité demandée sont **cinq objets différents**. Un usage facultatif favorise un choix libre sans prouver tous les critères d'un consentement valide. Aucune case « J'accepte le RGPD » ne doit être créée. Les mécanismes de droits restent à rendre effectivement disponibles, au-delà de l'export partiel.

## Recommandation et incertitude (D/E)

**Recommandation : préparer l'exploitation avec le socle simple de l'hypothèse 2 sans revendiquer d'exemption**, tant que le cercle et le caractère exclusivement personnel ne sont pas suffisamment établis. Cela réutilise les protections déjà développées et évite de fonder l'ouverture sur une supposition. Incertitude juridique **significative**, principalement sur la qualification du cercle et l'articulation des traitements publics/privés ; ce n'est pas une mesure probabiliste.

L'exploitant décide D01/D02/D09 avec une motivation interne ; solliciter une clarification compétente si le doute persiste. D03/D04/D07/D08/D11/D12 restent à conclure dans le périmètre retenu. Le [screening AIPD actualisé](DECISIONS-A-VALIDER.md) recommande une appréciation distincte du risque élevé, sans dispense automatique. Aucun essai hébergé, invitation ou traitement réel supplémentaire n'est autorisé par cette analyse.
