# Spécification de l'information publique — projet 6.4.4

**NON VALIDÉ — 28 octobre 2026.** La future page `confidentialite.html` n'est ni créée, ni ajoutée à l'artefact, ni publiée comme notice définitive. [Projet de texte](POLITIQUE-CONFIDENTIALITE-PROJET.md), [décisions](DECISIONS-A-VALIDER.md), [portes P0](DOSSIER-PREOUVERTURE.md). Une mention « À VALIDER » ne doit pas être livrée comme information officielle aux étudiants.

## Actualisation de périmètre 6.5.1

Méthode [A–F](CADRAGE-MON-BPREA-SIX-ADULTES.md). B : outil personnel indépendant, six adultes maximum dans l'espace personnel, usage facultatif, résultats privés sans accès formateur ni évaluation officielle prévus, fin de formation juin 2027. Ces faits remplacent les anciennes questions de public dans la présente spécification ; ils ne valident pas D01–D14. D : information courte accessible avant invitation et collecte pertinente, avec les limites administratives/fournisseur. E/F : identité/contact, bases, durées dont fermeture, contrats/transferts effectifs restent à compléter/tester. Aucune publication ici.

## Contenu à approuver avant réalisation publique

| Partie proposée | Fait technique utilisable | Mention/décision encore nécessaire |
| --- | --- | --- |
| Responsable et contact | Aucune identité déduite du dépôt | D01/D02/D04 : personne physique responsable potentielle si RGPD applicable, identité/contact autorisés, critères DPO sans désignation automatique, canal fonctionnel sans compte |
| Finalités et bases | Cinq finalités R01–R05 ; aide à révision sans badges/classement ou sanction automatique implémentée | D03/D09 : base par finalité, périmètre B désormais renseigné, qualifications à approuver ; aucune case d'acceptation générale |
| Mode visiteur | Progression/préférences locales, pas d'API pédagogique Supabase ; IP/logs Pages distincts | Qualification des accès au terminal D12, durées et conseils sur appareil partagé |
| Compte configuré | Auth/e-mail/UUID, profil privé, dix tables, quatre caches v2, session SDK, marqueur de continuité, outboxes/conflits/imports | Informations réellement ouvertes et catégories nécessaires ; aucune promesse de déploiement depuis Git |
| Source des données | Saisies, calculs descriptifs et invitation native préparée ; import visiteur explicite | D10 : origine réelle des adresses, collecte directe/indirecte, caractère obligatoire et conséquences de non-fourniture |
| Export | JSON du compte vérifié avec dix tables et compléments locaux normalisés ; visiteur séparé | Présenter la copie comme partielle : Auth interne, logs/backups, bruts exclus, marqueurs techniques et autres appareils demandent un complément ; portabilité conditionnelle |
| Effacement local | Choix et confirmation par catégorie, serveur conservé, perte possible de non synchronisé | Signaler la barrière personnelle UUID restante, la reprise explicite et la limite des anciens scripts visiteur |
| Clôture | Prototype réauthentifié et strictement éphémère ; aucun service hébergé disponible | D04/D08/D13 : service ou procédure alternative réellement disponible, exceptions et reprise en cas de non-confirmation ; ne pas annoncer le prototype aux étudiants comme opérationnel |
| Limites de suppression | Copies téléchargées/CSV/PDF/impressions, e-mails, autres appareils, logs et backups distincts | Délais fournisseurs, assistance légitime après clôture et traitement des restaurations ; aucun « tout effacé partout » |
| Durées | Pas de purge automatique ; JSON non validé, durées nulles | D07 : horizon juin 2027, T/fenêtre et durées ou critères motivés par catégorie, y compris outboxes/imports/barrières, demandes et preuves ; pas de conservation indéfinie déclarée conforme |
| Destinataires et transferts | Pages, Supabase configuré, chaîne messagerie à préciser ; liens tiers sur clic | D05/D06 : contrats/rôles, chaîne réelle, lieux et garanties ; aucune mention « uniquement UE » sans pièces |
| Droits et recours | Fonctions techniques décrites avec limites, pas de rectification d'historique par invention | D04 : circuit effectif ; information sur accès, rectification, effacement, limitation, opposition et portabilité selon conditions, retrait si consentement applicable, réclamation CNIL |
| Versions et accessibilité | Site statique, thèmes saisonniers/horaires, clair/sombre à préserver | Version/date approuvées, historique d'information proportionné, langage adapté aux six adultes, visiteur public distinct |

Références officielles relues le 28/10/2026 : [CNIL — articles 12–14 et droits](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3), [GitHub Pages — données de visites](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection). Leur consultation ne remplace pas les faits contractuels et décisions de l'exploitant.

## Points d'entrée à réaliser dans un lot autorisé

Les cibles et ancres ci-dessous sont des **spécifications de liens futurs**, pas des fichiers présents. Liens HTML statiques relatifs au préfixe du site ; aucun identifiant, e-mail, token ou URL de retour dans leur query.

| Origine | Accès et cible future | Moment de l'information / contrôle attendu |
| --- | --- | --- |
| Accueil `index.html` | Lien explicite « Confidentialité et données personnelles » vers `confidentialite.html` | Accessible sans compte avant usage des sauvegardes pertinentes ; notice visiteur intelligible |
| Pied de page commun | Même lien sur les 17 pages publiques, y compris états d'erreur | Accessible au clavier/mobile, sans dépendre d'une session ou d'un chargement Supabase ; vérifier le préfixe `/mon-bprea/` |
| Connexion `connexion.html` | Lien près du formulaire vers la partie compte | Visible avant saisie/envoi ; expliquer la persistance de session et le poste partagé |
| Invitation : message et activation | Lien vers la notice validée dans le dispositif d'information **avant invitation**, puis dans le message approuvé et `authentification.html` | D10 : source indirecte de l'adresse et version communiquée. Le seul e-mail technique ne suffit pas à prouver toute l'information préalable |
| Récupération `mot-de-passe-oublie.html` et callback | Lien statique avant envoi et après lien invalide/expiré | Aucune copie de `token_hash` dans le lien ou le référent ; pas de tracking supplémentaire |
| Profil `profil.html` | Lien près de « Mes données personnelles » et « Effacement et clôture » vers sections droits/limites | Disponible aussi lorsque Auth est désactivé ou la session perdue ; le contact sans compte reste trouvable |

## Recette future et publication

1. Faire approuver texte complet, contact, durées, bases, prestataires/transferts, public et analyse AIPD. Publier seulement des coordonnées autorisées ; retirer les notes internes de la version destinée aux personnes.
2. Implémenter dans un lot autorisé une page sans authentification requise, avec HTML sémantique, titres ordonnés, liens explicites, focus visible et paragraphes courts. Garder la notice accessible si JavaScript/Auth échoue ; aucune case générique présentée comme base légale.
3. Tester accueil/footer/formulaires/callback/profil, clavier et zoom, mobile/ordinateur, clair/sombre et saisons/horaires ; vérifier la lisibilité des avertissements et l'absence de débordement. Ces critères ne constituent pas une certification globale d'accessibilité.
4. Préparer l'artefact exact : page et liens publics, aucun `docs/rgpd/`, JSON de conservation, fixture, serveur ou secret ; contrôler version/digest et accès avant toute invitation. Les documents préparatoires peuvent rester publics dans Git avec leur avertissement, sans être la notice du service.
5. Faire décider et tracer séparément publication, configuration hébergée, activation et invitations. Aucune de ces opérations n'est autorisée par la présente spécification ; les P0 ouverts maintiennent l'ouverture bloquée.
