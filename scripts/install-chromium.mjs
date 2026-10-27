import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { playwrightCLI, runNode } from './ci-command.mjs';

// Same browser revision and default headless mode as both Playwright projects.
async function exerciseChromium() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<html lang="fr"><body><button>Vérifier Chromium</button><output></output><script>document.querySelector("button").onclick = () => document.querySelector("output").textContent = "Prêt éà🌱";</script></body></html>');
    await page.getByRole('button', { name: 'Vérifier Chromium' }).click();
    assert.equal(await page.locator('output').textContent(), 'Prêt éà🌱');
    assert.ok((await page.screenshot()).length > 0);
    console.log(`Chromium verrouillé lancé, JavaScript et rendu vérifiés : ${browser.version()}`);
  } finally { await browser.close(); }
}

await runNode('Téléchargement Chromium verrouillé', [playwrightCLI, 'install', 'chromium']);
try { await exerciseChromium(); }
catch (error) {
  // A render/assertion/network error must fail, not trigger an environment retry.
  if (process.platform !== 'linux' || !/Host system is missing dependencies|error while loading shared libraries|cannot open shared object file/i.test(error.message)) throw error;
  console.log('Bibliothèques système absentes : installation officielle Playwright, puis nouvelle validation réelle.');
  await runNode('Dépendances système Chromium (repli)', [playwrightCLI, 'install-deps', 'chromium']);
  await exerciseChromium();
}
