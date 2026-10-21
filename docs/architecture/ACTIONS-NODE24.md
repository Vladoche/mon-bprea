# GitHub Actions et Node.js 24

Vérification des sources officielles le **21 octobre 2026**, pour le lot 5.2. Les deux workflows existants sont `.github/workflows/deploy.yml` et `.github/workflows/quality.yml`.

## Versions retenues

Les workflows suivent les versions majeures stables officielles. Le tableau indique la version stable constatée lors de la vérification et le manifeste qui confirme le moteur de l’action.

| Action | Avant → après | Version stable vérifiée | Moteur vérifié |
| --- | --- | --- | --- |
| `actions/checkout` | `v4` → `v7` | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | [`node24`](https://github.com/actions/checkout/blob/v7/action.yml) |
| `actions/configure-pages` | `v5` → `v6` | [v6.0.0](https://github.com/actions/configure-pages/releases/tag/v6.0.0) | [`node24`](https://github.com/actions/configure-pages/blob/v6/action.yml) |
| `actions/deploy-pages` | `v4` → `v5` | [v5.0.1](https://github.com/actions/deploy-pages/releases/tag/v5.0.1) | [`node24`](https://github.com/actions/deploy-pages/blob/v5/action.yml) |
| `actions/upload-pages-artifact` | `v3` → `v5` | [v5.0.0](https://github.com/actions/upload-pages-artifact/releases/tag/v5.0.0) | [Action composite utilisant `upload-artifact` v7](https://github.com/actions/upload-pages-artifact/blob/v5/action.yml) |
| `actions/setup-node` | `v6` → `v7` | [v7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | [`node24`](https://github.com/actions/setup-node/blob/v7/action.yml) |
| `actions/upload-artifact` | `v4` → `v7` | [v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | [`node24`](https://github.com/actions/upload-artifact/blob/v7/action.yml) |

Le moteur interne de chaque action est distinct de la version installée pour les commandes du projet. `setup-node` conserve `node-version: '24'`, le cache npm et `npm ci`. Aucune variable de forçage d’un ancien moteur Node.js n’est ajoutée. Le site public reste statique, sans Node.js à l’exécution.

## Compatibilité conservée

- **Qualité** conserve son déclenchement sur les pull requests vers `main`, ses permissions `contents: read`, ses délais, ses artefacts d’échec et les identifiants et noms exacts **`unit-integration`** et **`e2e`** requis par le ruleset. Ce workflow ne déploie pas.
- **Publier le site BPREA** conserve ses déclencheurs, la concurrence Pages, l’environnement `github-pages`, les permissions `contents: read`, `pages: write`, `id-token: write`, le SHA transmis au script et l’artefact `site-public`. Le nom implicite `github-pages` demeure commun à l’envoi et au déploiement.
- L’option `include-hidden-files: true` de `upload-pages-artifact` v5 préserve **`.nojekyll`** : cette version exclut les fichiers cachés par défaut. Le dossier envoyé est exclusivement l’artefact préparé, dont le script filtre les sources privées, Git et la configuration des outils. Aucun dossier du dépôt brut n’est envoyé.
- `checkout` v7 introduit un contrôle pour les événements `pull_request_target` et `workflow_run`. Les événements employés ici (`pull_request`, `push`, `workflow_dispatch`) restent adaptés ; aucun contournement `allow-unsafe-pr-checkout` n’est ajouté. Voir le [guide officiel](https://github.com/actions/checkout/blob/v7/README.md).
- `setup-node` v7 supprime un jeton de repli pour certains registres. Le projet ne configure ni `registry-url` ni publication npm ; il conserve le téléchargement des dépendances publiques. Voir les [changements officiels](https://github.com/actions/setup-node/blob/v7/README.md).

Les actions Node.js 24 nécessitent un runner compatible (au moins **2.327.1**, selon [checkout](https://github.com/actions/checkout/blob/v7/README.md) et [setup-node](https://github.com/actions/setup-node/blob/v7/README.md)). Les workflows utilisent les runners hébergés `ubuntu-latest`, sans runner privé à mettre à jour dans ce dépôt.

## Préparation Pages et cache

La maintenance des actions ne modifie pas `scripts/prepare-pages.py`. Sa liste publique autorise déjà les photographies `.jpg`, `.jpeg` et `.webp`, ainsi que les modules et fichiers JSON. Les imports JavaScript littéraux et `new URL('./fichier.json', import.meta.url)` sont versionnés avec le SHA, y compris les dépendances transitives. Les chemins conservent le préfixe GitHub Pages.

Les chemins photographiques stockés dans un JSON ne sont pas réécrits par le script ; les images ne font pas partie des types versionnés. Résoudre ces chemins relativement au module ou à l’URL du catalogue, conserver des chemins relatifs et employer un nouveau nom lors du remplacement d’une photographie permet de conserver le fonctionnement existant. Les garanties et limites restent décrites dans [CACHE.md](CACHE.md).

## Portée de la vérification

La consultation des releases et des manifestes officiels confirme l’existence des versions et leur moteur déclaré. Elle ne constitue pas une exécution des workflows GitHub. Les résultats des tests locaux et de la préparation de l’artefact sont consignés séparément dans [la validation du lot 5.2](../validations/VALIDATION-LOT5-2.md).

Cette maintenance ne modifie aucune protection de `main` et ne déclenche aucun déploiement. Le premier passage réel de **Qualité** sur la PR vérifiera les actions dans l’environnement GitHub. Le workflow de publication exige toujours l’accord de l’utilisateur avant fusion ou lancement manuel.
