const seasonLabels = { spring: 'Printemps', summer: 'Été', autumn: 'Automne', winter: 'Hiver' };
const timeLabels = { morning: 'matin', day: 'journée', twilight: 'crépuscule', night: 'nuit' };

export function initAppearance() {
  const appearance = window.BpreaAppearance;
  const toggle = document.getElementById('theme-toggle');
  const open = document.getElementById('appearance-open');
  if (!appearance || !toggle || !open) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'appearance-dialog';
  dialog.className = 'appearance-dialog';
  dialog.setAttribute('aria-labelledby', 'appearance-title');
  dialog.setAttribute('aria-describedby', 'appearance-description');
  dialog.innerHTML = `
    <form method="dialog" class="appearance-heading">
      <h2 id="appearance-title">Ton apparence</h2>
      <button class="appearance-close" type="submit" aria-label="Fermer les paramètres d’apparence" autofocus>×</button>
    </form>
    <p id="appearance-description">Choisis la saison et la luminosité qui te conviennent. Ces deux réglages sont indépendants.</p>
    <div class="appearance-fields">
      <label for="appearance-season">Saison
        <select id="appearance-season" aria-describedby="appearance-season-help">
          <option value="auto">Automatique</option>
          <option value="spring">Printemps</option>
          <option value="summer">Été</option>
          <option value="autumn">Automne</option>
          <option value="winter">Hiver</option>
        </select>
      </label>
      <p id="appearance-season-help">En automatique : saisons du calendrier de l’hémisphère nord, à partir des 1er mars, juin, septembre et décembre.</p>
      <label for="appearance-brightness">Luminosité
        <select id="appearance-brightness" aria-describedby="appearance-time-help">
          <option value="auto">Automatique selon l’heure</option>
          <option value="light">Mode clair</option>
          <option value="dark">Mode sombre</option>
        </select>
      </label>
      <p id="appearance-time-help">Heure locale : matin de 6 h à 10 h, journée de 10 h à 18 h, crépuscule de 18 h à 22 h, nuit de 22 h à 6 h. Ce sont des plages conventionnelles.</p>
    </div>
    <p class="appearance-current" id="appearance-current" role="status"></p>
    <p class="appearance-save" id="appearance-save" role="status">Tes préférences sont conservées sur cet appareil.</p>`;
  document.body.append(dialog);
  const season = dialog.querySelector('#appearance-season');
  const brightness = dialog.querySelector('#appearance-brightness');
  const save = dialog.querySelector('#appearance-save');
  function update() {
    const preferences = appearance.getPreferences();
    const state = appearance.getState();
    const dark = state.theme === 'dark';
    season.value = preferences.season;
    brightness.value = preferences.brightness;
    toggle.querySelector('.theme-icon').innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${dark ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>' : '<path d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3Z"/>'}</svg>`;
    toggle.querySelector('.theme-label').textContent = dark ? 'Mode clair' : 'Mode sombre';
    toggle.setAttribute('aria-label', dark ? 'Activer le mode clair' : 'Activer le mode sombre');
    dialog.querySelector('#appearance-current').textContent = `${seasonLabels[state.season]} · ${timeLabels[state.time]} · mode ${dark ? 'sombre' : 'clair'}`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  }
  function change(patch) {
    const saved = appearance.updatePreferences(patch);
    save.textContent = saved ? 'Préférences enregistrées sur cet appareil.' : 'Le stockage local est indisponible. Ce choix reste actif pour cette page seulement.';
  }
  open.addEventListener('click', () => { update(); dialog.showModal(); });
  dialog.addEventListener('close', () => open.focus());
  season.addEventListener('change', () => change({ season: season.value }));
  brightness.addEventListener('change', () => change({ brightness: brightness.value }));
  toggle.addEventListener('click', () => change({ brightness: appearance.getState().theme === 'dark' ? 'light' : 'dark' }));
  window.addEventListener('bprea:appearance-change', update);
  window.addEventListener('bprea:preferences-change', update);
  update();
  document.documentElement.dataset.appearanceReady = 'true';
}
