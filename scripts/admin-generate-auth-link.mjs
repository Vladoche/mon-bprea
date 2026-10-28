// CLI privée interactive. Aucun mode batch/--yes, fichier de sortie ou presse-papiers.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { generateManualAuthLink, LocalAuthLinkError, parseOperation, safeAdminMessage, validateLocalEnvironment } from './auth-link-local.mjs';

let terminal;
stdout.on('error', () => { process.exitCode = 1; });
try {
  const type = parseOperation(process.argv.slice(2));
  if (!stdin.isTTY || !stdout.isTTY || process.env.CI) throw new LocalAuthLinkError('interactive');
  validateLocalEnvironment(process.env);
  terminal = createInterface({ input: stdin, output: stdout });
  const email = await terminal.question('Adresse unique confirmée du destinataire synthétique local : ');
  await generateManualAuthLink({ env: process.env, type, email,
    confirm: async ({ target, project }) => {
      stdout.write(`\nProjet : ${project}\nAPI : http://127.0.0.1:54321\nDemande : ${type}\nCible minimisée : ${target}\n`);
      stdout.write(type === 'invite'
        ? 'Cette opération peut créer immédiatement un compte Auth et son profil. Accord et adresse doivent être confirmés.\n'
        : 'Identité à vérifier par un canal déjà connu. Ce lien peut remplacer une récupération précédente.\n');
      stdout.write('Secret temporaire affiché une fois ; il peut rester dans l’historique du terminal. Aucun enregistrement, capture, partage public ou redirection de sortie.\n');
      return await terminal.question(`Pour confirmer cible, accord/identité et affichage privé, saisir CONFIRMER ${type} : `) === `CONFIRMER ${type}`;
    },
    present: async link => {
      await new Promise((resolve, reject) => {
        stdout.write(`\nLien personnel local (usage unique, validité locale 60 secondes) :\n${link}\n`, error => error ? reject(error) : resolve());
      });
    },
  });
} catch (error) {
  // Aucun objet SDK/stack trace/argument/secret n'est sérialisé.
  console.error(safeAdminMessage(error));
  process.exitCode = 1;
} finally { terminal?.close(); }
