# Validation du profil, des couleurs et du premier rendu

**20 novembre 2026** · Référence `70de749` · données fictives · Chromium et
Supabase PostgreSQL local.

## Reproduction et contrôle du premier rendu

Avant correction, à midi, l’ouverture d’Outils avec une session personnelle
réglée sur sombre peint le fond en `rgb(248, 242, 236)` pendant la lecture
retardée de l’apparence. Le script synchrone précédait déjà les feuilles CSS.
Il initialisait le choix visiteur ou automatique, puis le compte imposait
le sombre lorsque ses préférences arrivaient.

`tests/e2e/appearance-first-paint.spec.js` ralentit Chromium à 4× CPU, 60 ms
de latence, 600 ko/s descendants et 240 ko/s montants. Le test compare les
pixels de marge des images du compositeur à partir du premier rendu et
capture aussi la page visible pendant les attentes Auth et paramètres. Il
couvre la navigation froide et chaude, les rechargements, un nouvel onglet,
le retour BFCache natif, la reprise d’onglet, l’indisponibilité du stockage,
et les deux transitions de compte A sombre → B clair → A sombre. La première
peinture du compte clair déjà vérifié est elle aussi contrôlée. L’ancien
compte disparaît du profil et sa couleur n’est pas appliquée dans l’intervalle
de vérification. Les PNG et les valeurs RGB sont joints au rapport Playwright.

## Profil et roue chromatique

`appearance-color.spec.js`, `appearance-preferences.spec.js`,
`appearance-navigation.spec.js`, `profile.spec.js` et
`ui-2027-hubs.spec.js` couvrent le profil, les ancres, le pseudo, la
déconnexion, le clavier, les archives, les saisons, les seuils locaux,
la roue au tactile, les curseurs, le code hexadécimal et la palette réversible.
Contrôles des largeurs 320, 390, 768 et 1440 px sur Accueil, Mes cours,
Cours, QCM, Drill, Tableau de bord, Calendrier, ITK, Ressources, Botanique et
Profil. La matrice de contraste mesure 18 couleurs en clair et sombre. Seuils
AA de 4,5:1 pour les rôles textuels et 3:1 pour les repères testés des
contrôles et graphiques. Vérification des noms accessibles via Chromium,
de la tabulation, du contraste forcé et du mouvement réduit.

## Données et compatibilité

- PostgreSQL isolé via Supabase CLI 2.121.0. **416 assertions pgTAP** réussies
  sur les contrats de données et les privilèges.
- **27 groupes données personnelles** et **22 groupes Drill** réussis avec
  de vrais JWT fictifs. Cours, tentatives QCM, reconnaissance botanique,
  ITK, apparence et Drill couvrent historique, CAS, idempotence, refus et
  accès A/B. Les anciens payloads d’apparence gardent leurs réponses
  historiques et la couleur existante. Le CLI a listé la migration locale et
  n’a relevé aucun diagnostic de niveau avertissement ou erreur.
- La reprise assistée cours/QCM est exercée par l’API du service. Une
  prévisualisation ne crée aucune tentative. Deux tentatives métier
  identiques restent distinctes et rejouer la confirmation ne les duplique
  pas. La source visiteur demeure inchangée.

La migration est à appliquer avant publication du frontend. La
[procédure de mise en service et de repli](../architecture/ITK-APPEARANCE-SYNCHRONISATION-CLIENT.md#mise-en-service-et-repli)
préserve les caches et opérations chromatiques. La
[proposition de notice](PROPOSITION-NOTICE-APPARENCE-2027.md) attend
approbation avant publication. Les tests sont locaux. Les technologies
d’assistance natives et le comportement hébergé restent à vérifier.
