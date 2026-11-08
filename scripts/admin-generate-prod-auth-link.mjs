// CLI Node privée distincte du générateur local. Aucun mode non interactif.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { parseOperation, validateProdEnvironment, safeProdMessage, PROD_PROJECT, PROD_API, PROD_CALLBACK } from './prod-auth/environment.mjs';
import { checkProdConfiguration, generateProdAuthLink } from './prod-auth/generator.mjs';
import { createPrivateStore, verifyPrivateDirectory } from './prod-auth/private-store.mjs';

let terminal;
stdout.on('error', () => { process.exitCode = 1; });
try {
  const type = parseOperation(process.argv.slice(2));
  const configuration = validateProdEnvironment(process.env);
  verifyPrivateDirectory(configuration.privateDirectory);
  terminal = createInterface({ input: stdin, output: stdout });
  stdout.write(`Projet : Mon BPREA PROD (${PROD_PROJECT})\nAPI : ${PROD_API}\nCallback : ${PROD_CALLBACK}\n`);
  if (type === 'check') {
    const result = await checkProdConfiguration({ env: process.env });
    stdout.write(`Lecture administrative authentifiée : ${result.accounts}/${result.capacity} comptes, invitations en attente comprises. Place exploitant réservée : ${result.operatorPlaceReserved ? 'oui' : 'déjà occupée'}. Aucun jeton généré.\n`);
    stdout.write('Réglages du service relus : inscription et anonymat fermés, seul e-mail actif, confirmation requise.\n');
    stdout.write('Ce contrôle ne prouve pas les URL Dashboard, le minimum de mot de passe, les expirations, la livraison Pages ou les prérequis de préouverture.\n');
  } else {
    stdout.write('Utilisation interdite sans accord spécifique au destinataire et prérequis de préouverture satisfaits. Aucun envoi automatique.\n');
    const email = await terminal.question('Adresse unique vérifiée par un canal privé déjà connu : ');
    const store = createPrivateStore(configuration.privateDirectory);
    await generateProdAuthLink({ env: process.env, type, email, store,
      confirm: async ({ email: target, count, operatorPlaceReserved }) => {
        stdout.write(`\nOpération : ${type}\nDestinataire : ${target}\nComptes présents : ${count}/7, invitations en attente comprises.\n`);
        if (operatorPlaceReserved) stdout.write('Une place supplémentaire reste réservée au compte de l’exploitant.\n');
        stdout.write(type === 'invite'
          ? 'ATTENTION : une invitation peut créer immédiatement un compte Auth et son profil. Aucun mot de passe ou rôle ne sera choisi par l’opérateur.\n'
          : 'ATTENTION : cette récupération peut remplacer un lien précédent. Vérifier l’identité par le canal connu ; aucun compte ne sera recréé.\n');
        stdout.write('En confirmant, vous attestez votre habilitation, l’accord individuel, l’identité/adresse, les prérequis et le canal privé.\n');
        return terminal.question(`Saisir exactement CONFIRMER PROD ${type} ${target} : `);
      },
      deliver: async (link, details) => {
        const path = await store.deliver(link, details);
        stdout.write(`Fichier secret individuel créé dans le dossier protégé : ${path}\n`);
        stdout.write('Aucun lien affiché. Ouvrir privativement ce fichier et remettre manuellement au seul destinataire ; conserver hors logs/captures et retirer la copie après usage ou expiration selon la procédure.\n');
        if (await terminal.question('Pour acquitter la remise locale du fichier, saisir RECU : ') !== 'RECU') throw new Error();
      },
    });
    stdout.write('Génération acquittée dans le stockage privé. Aucun envoi effectué ; aucune ouverture du service déduite.\n');
  }
} catch (error) {
  // Jamais d’objet SDK, pile, adresse, clé, jeton ou URL sensible dans les erreurs.
  console.error(safeProdMessage(error)); process.exitCode = 1;
} finally { terminal?.close(); }
