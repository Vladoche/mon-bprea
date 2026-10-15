# Mon BPREA — Démonstration fonctionnelle

Un site de révision **entièrement statique** (HTML, CSS, JavaScript), prêt pour GitHub Pages. Aucun serveur, aucune installation de dépendances et aucun système de suivi de tests requis.

## Fonctions incluses

- **Accueil** : 5 UC nationales et 2 UCARE, navigation et suivi de progression.
- **UC 03** : quatre cours d'exemple (cycle de la matière organique, C/N, pédofaune, pédoflore et indicateurs).
- **Exercices** : 3 QCM corrigés par cours, soit 12 questions, meilleur score conservé.
- **Suivi** : marquage des cours terminés dans le stockage local du navigateur.
- **Générateur ITK** : tomate, laitue, carotte, courgette, choix de variété/type, abri/plein champ, surface, mois, sol et disponibilité en eau. Calendrier indicatif, alerte selon contraintes, export CSV et impression en PDF via le navigateur.
- Interface responsive (ordinateur et mobile).

## Consulter la démo en local

Le JavaScript utilise des modules ES, qui ne sont pas chargés de façon fiable en ouvrant directement le fichier `index.html` en `file://` dans certains navigateurs. Démarre un mini-serveur local.

Si Python est disponible :

```bash
cd bprea-demo
python -m http.server 8000
```

Puis ouvre <http://localhost:8000>.

Tu peux aussi utiliser l'extension **Live Server** de VS Code.

## Déployer sur GitHub Pages (sans étape de compilation)

1. Crée un dépôt GitHub, par exemple **`mon-bprea`**. Pour GitHub Pages sur un compte GitHub Free, le dépôt doit généralement être **public**.
2. Ajoute **tout le contenu du dossier `bprea-demo` à la racine du dépôt**, y compris le dossier caché `.github/workflows/` et le fichier `.nojekyll`.
3. Dans GitHub, va dans **Settings → Pages → Build and deployment → Source : GitHub Actions**.
4. Pousse les fichiers sur la branche `main` ; le workflow `Publier le site BPREA` publiera automatiquement le site.
5. Le site sera consultable à `https://TON-PSEUDO.github.io/mon-bprea/` (adapte le nom du dépôt).

> Tu n'as **pas** besoin de configurer un « base path ». Tous les liens internes sont relatifs. Aucun nom d'utilisateur ou de dépôt n'est codé en dur.

### Depuis Git en local (exemple)

```bash
cd bprea-demo
git init
git add .
git commit -m "Premiere demo BPREA"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/mon-bprea.git
git push -u origin main
```

Crée d'abord le dépôt vide depuis GitHub. La première publication GitHub Pages peut demander quelques minutes.

## Modifier et enrichir le contenu

- `assets/content.js` : intitulés des UC dans `units`, cours dans `lessons`, questions dans `quiz`, données ITK dans `crops`.
- `assets/style.css` : palette, mise en page et styles responsives.
- `assets/app.js` : navigation, progression, exercices, calcul ITK et export.
- Les pages `index.html`, `uc.html`, `cours.html`, `exercices.html`, `itk.html` sont les points d'entrée.

Chaque objet dans `lessons` comprend `id`, `unit`, `chapter`, `title`, `summary`, `body` (HTML pédagogique), `essentials` et `quiz`. On pourra par la suite passer à un générateur de documentation (Astro/Starlight) si la bibliothèque de cours devient volumineuse. Pour cette V1, la structure sans dépendance évite tout build et fonctionne directement sur GitHub Pages.

## Limites explicites

- **Contenus pédagogiques illustratifs** : les formulations des cours sont simplifiées pour la démonstration ; ne remplacent ni les supports des formateurs ni le référentiel de certification. Les intitulés des UC reprennent la structure nationale du BPREA ; leur affectation aux chapitres reste à valider avec le centre.
- **ITK simplifié et non prescriptif** : les densités, périodes et durées sont des ordres de grandeur pédagogiques, pas des recommandations agronomiques validées pour une parcelle donnée. Les paramètres sol/eau déclenchent des avertissements mais pas de calcul de fertilisation, d'irrigation ou de rendement. Aucune prise en compte automatique de la météo, de l'analyse de sol, de la région, des résistances variétales ou du marché.
- **Variétés** : exemples de noms et types, sans base variétale scientifique. Choisir une variété modifie les **points de vigilance**, mais **pas** les dates ni les densités faute de fiches variétales documentées. À développer avec un catalogue sourcé.
- **Stockage** : progression, score et dernière configuration ITK sont conservés dans `localStorage`, sur ce navigateur uniquement. Pas de synchronisation entre appareils. Effacer les données du navigateur supprime ce suivi.
- **Confidentialité** : GitHub Pages ne protège pas le site par mot de passe ; ne pas publier de supports sous droits ou de données privées.
- **Polices** : polices système (aucun appel à un service tiers).

## Références pour poursuivre

- [Référentiel BPREA et ressources ministérielles — Chlorofil](https://chlorofil.fr/diplomes/secondaire/bp/rea)
- [Présentation des UC nationales — AgriOrientation](https://www.agrorientation.com/trouver-ma-formation/trouver-une-formation/bp-rea-agriculture-biologique)
- [GitHub Pages — Documentation GitHub](https://docs.github.com/en/pages)

---

Projet de démonstration personnel, octobre 2026.
