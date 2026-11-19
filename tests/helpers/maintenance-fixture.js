const path = '/mon-bprea/profil.html';
const fragment = '#fixture-maintenance';
const installed = new WeakSet();

/** Mount the reference tools only inside a Playwright context that opts in. */
export async function openMaintenanceFixture(page) {
  const context = page.context();
  if (!installed.has(context)) {
    // Keep the real local HTTP navigation for Chromium Local Network Access.
    // The fragment alone has no effect without this Playwright init script.
    await context.addInitScript(({ path, fragment }) => {
      if (location.pathname !== path || location.hash !== fragment) return;
      document.addEventListener('DOMContentLoaded', async () => {
        for (const name of ['export', 'restore', 'erasure']) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = `assets/${name}.css`;
          document.head.append(link);
        }
        const app = new URL(document.querySelector('script[src*="assets/app.js"]').src);
        const load = name => {
          const url = new URL(name, app);
          url.search = app.search;
          return import(url.href);
        };
        const [{ getAuthService }, { initExportUI }, { initErasureUI }] = await Promise.all([
          load('./auth-service.js'), load('./export-ui.js'), load('./erasure-ui.js'),
        ]);
        const auth = await getAuthService();
        const copies = document.createElement('div');
        const erasure = document.createElement('div');
        document.querySelector('main').after(copies, erasure);
        await initExportUI(copies, { auth });
        await initErasureUI(erasure, { auth });
      }, { once: true });
    }, { path, fragment });
    installed.add(context);
  }
  const sameDocument = new URL(page.url()).pathname === path;
  await page.goto(path + fragment);
  if (sameDocument) await page.reload();
}
