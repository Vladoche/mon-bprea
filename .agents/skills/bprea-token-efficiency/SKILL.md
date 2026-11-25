---
name: bprea-token-efficiency
description: Réduire le contexte mobilisé pour une tâche Mon BPREA qui demande des recherches, des diagnostics ou la lecture de sorties volumineuses.
---

# Sobriété dans Mon BPREA

- Partir du résultat attendu et de la référence Git vérifiée. Chercher les symboles, messages d’erreur ou chemins qui peuvent changer la décision. Lister les fichiers utiles avec `rg --files`, puis lire les sections repérées avec `rg -n` ou l’outil équivalent. Utiliser la fiche de reprise pour choisir un contrat et ouvrir l’état du projet si un jalon, une décision ou une version en service compte. Pour une archive, partir d’une référence datée. [Fiche de reprise](../../../docs/developpement/REPRISE-CODEX.md)
- Regrouper les lectures indépendantes et réutiliser les résultats déjà obtenus. Si une piste échoue, formuler une autre hypothèse avant de relancer une recherche ou un test. Pour un test ou une commande bavarde, filtrer la sortie à la source en gardant le code de sortie, l’erreur utile et la référence à la trace. Exclure les valeurs sensibles et les liens Auth du contexte transmis. Conserver les preuves utiles selon la procédure du dépôt.
- Réutiliser une preuve si elle couvre le même comportement et si sa version, son environnement et les données de test restent pertinents. Choisir les contrôles selon le changement et signaler les contrôles manquants. Pour Auth et RLS, distinguer la lecture du code des essais d’isolation sur stack locale dédiée avec comptes fictifs. Préserver l’accès sur invitation et les autorisations propres aux opérations réelles ou hébergées. [Règles du dépôt](../../../AGENTS.md) · [Tests](../../../docs/TESTS.md)
- Pour une notice ou un document administratif, appliquer les contrôles et la traçabilité du dépôt sans ajouter d’approbation documentaire spécifique, y compris lors d’un changement substantiel, de version ou d’empreinte. Pour `.tmp`, appliquer la liste blanche et les protections du guide. Les 500 Mo servent au suivi. [Contrôle de la notice](../../../docs/rgpd/SPECIFICATION-INFORMATION-PUBLIQUE.md) · [Maintenance de .tmp](../../../docs/developpement/MAINTENANCE-DOSSIER-TMP.md)
- Terminer lorsque le résultat et les contrôles requis sont établis, ou lorsqu’un blocage empêche de les établir. Indiquer le résultat, les preuves et les limites. Si la tâche demande une mesure, distinguer octets, tokens estimés, compteurs réels et cache. Comparer des tâches et contrôles équivalents avant d’annoncer un gain.

Méthode adaptée à Mon BPREA, inspirée des principes de recherche ciblée, de réutilisation des preuves et de mesure de l’Institut du Numérique Responsable. [Green Codex](https://github.com/Institut-du-Numerique-Responsable/green-codex/tree/4570e9dd9dec70ba541a94551983384b97459a87)
