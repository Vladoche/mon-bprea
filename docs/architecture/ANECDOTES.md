# Anecdote quotidienne

Le bandeau « Tu savais que… ? » utilise exclusivement `assets/daily-facts.json` ; aucune API externe n’est appelée. Les liens documentaires sont ouverts uniquement à la demande. La première banque contient dix faits reformulés à partir des références INRAE, Ephytia et FAO indiquées dans chaque entrée.

## Rotation et masquage

La date civile est calculée par `Intl.DateTimeFormat` dans le fuseau **Europe/Paris**, quel que soit le fuseau du navigateur. Le nombre de jours civils depuis le **1er janvier 2026** détermine l’index : `((jours % nombreDeFaits) + nombreDeFaits) % nombreDeFaits`. Le 1er janvier correspond à la première entrée ; la rotation reprend à la première après la dernière. L’arithmétique se fait sur les dates civiles converties en UTC, sans variation lors des changements d’heure.

Tous les visiteurs utilisant la même version de la banque voient donc le même fait le même jour. L’ordre du tableau `facts` est l’ordre de rotation. Ajouter, retirer ou déplacer une entrée peut modifier le calendrier des faits après la mise à jour : conserver les identifiants et préférer les ajouts en fin de tableau. Une ancienne banque encore en cache peut temporairement donner un autre fait.

La date est revérifiée chaque minute lorsque la page est visible, au retour sur l’onglet et à l’événement `pageshow`. Le nouveau jour apparaît sans déploiement et sans rechargement, au plus tard à la vérification suivante. Cela utilise l’horloge de l’appareil, sans serveur de temps.

Le bouton de fermeture écrit uniquement la date `AAAA-MM-JJ` dans la clé `bprea-demo-daily-fact-dismissed-v1`. Une date ancienne n’a aucun effet : le bandeau revient le lendemain. Cette clé est indépendante des exercices, statistiques et préférences ; aucune clé n’est supprimée. Le masquage se synchronise entre onglets du même site par l’événement `storage`. Si le stockage est bloqué, le choix reste valable dans la page courante ; sa conservation après navigation ou rechargement ne peut pas être garantie.

## Ajouter un fait

Ajouter un objet dans le tableau `facts`, en conservant `version: 1` :

```json
{
  "id": "identifiant-stable-en-minuscules",
  "text": "Un fait court, vérifié et reformulé pour la lecture.",
  "theme": "Biologie du sol",
  "source": "Organisme — Titre précis du document",
  "url": "https://adresse-du-document-source",
  "lessonId": "pedofaune"
}
```

`id`, `text`, `theme` et `source` sont obligatoires. `id` utilise des lettres minuscules, chiffres et tirets et doit être unique. Vérifier le fait dans une source documentaire identifiée avant l’ajout. `url` est facultatif ; seules les URL HTTP/HTTPS sans identifiants sont acceptées. Une URL invalide est ignorée, en conservant le texte et sa source. Ne pas placer de HTML dans les champs : ils sont affichés avec `textContent`.

`lessonId` est facultatif et doit correspondre à un cours de `assets/content.js`. Il ajoute « Voir le cours » vers `cours.html?id=…`. `resourceId` peut aussi référencer l’identifiant d’une entrée de `assets/resources.json` : « Voir la ressource » ouvre la bibliothèque avec son titre comme recherche. Les références inconnues sont ignorées sans interrompre la rotation. Le catalogue n’est chargé pour cette association que si au moins un fait comporte `resourceId`.

Les entrées obligatoires invalides et les doublons sont exclus, dans l’ordre du JSON. Les avertissements sont disponibles dans la console du navigateur. Un fichier absent, illisible ou vide masque ce bandeau facultatif et laisse les outils pédagogiques accessibles.

## Intégration et vérification ponctuelle

`initDailyFact(root)` reçoit un élément `<section>` déjà placé par l’application et retourne une promesse contenant une fonction de nettoyage optionnelle. Sur l’accueil, placer la section dans `<main>`, **après la préparation aux examens** ; ailleurs, la placer immédiatement après le header, avant `<main>`, pour préserver le bandeau lors des rendus asynchrones des pages. Charger `assets/daily-fact.css`. Le module applique la classe `daily-fact`, un nom accessible et l’attribut `hidden` selon le contenu ou le masquage. Après fermeture au clavier, le focus revient au contenu principal.

Les exports `getParisDay(date)`, `selectDailyFact(facts, dateCivile)` et `normalizeDailyFacts(document, ressources)` sont utilisés par le site et peuvent être exercés directement par les tests du lot 5.1 ; voir [../TESTS.md](../TESTS.md). Pour la vérification visuelle, contrôler deux instants autour de minuit à Paris, deux dates consécutives, le passage du dernier au premier fait, puis la fermeture et le rechargement. Vérifier aussi « En savoir plus », les liens de cours, le clavier et un écran mobile. Les réglages de thème utilisent les tokens CSS communs ; le bandeau n’ajoute pas d’animation et respecte `prefers-reduced-motion`.
