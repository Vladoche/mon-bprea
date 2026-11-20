const clamp = value => Math.max(0, Math.min(1, value));
const defaultColor = '#286640';

function hexToHsv(hex, previous) {
  const [r, g, b] = hex.slice(1).match(/../g).map(pair => parseInt(pair, 16) / 255);
  const value = Math.max(r, g, b);
  const delta = value - Math.min(r, g, b);
  if (!delta) return { hue: previous.hue, saturation: value ? 0 : previous.saturation, value };
  const hue = value === r ? (g - b) / delta : value === g ? 2 + (b - r) / delta : 4 + (r - g) / delta;
  return { hue: (60 * hue + 360) % 360, saturation: delta / value, value };
}

function hsvToHex({ hue, saturation, value }) {
  const component = offset => {
    const k = (offset + hue / 60) % 6;
    const channel = value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(255 * channel).toString(16).padStart(2, '0');
  };
  return '#' + component(5) + component(3) + component(1);
}

export function initAppearanceColor(dialog, { preview, commit }) {
  const panel = dialog.querySelector('#appearance-color-picker');
  const wheel = panel.querySelector('.appearance-wheel');
  const cursor = panel.querySelector('.appearance-wheel-cursor');
  const swatch = panel.querySelector('.appearance-swatch');
  const hex = panel.querySelector('#appearance-hex');
  const error = panel.querySelector('#appearance-hex-error');
  const channels = ['hue', 'saturation', 'value'];
  const controls = channels.map(channel => panel.querySelector('#appearance-' + channel));
  let color = defaultColor;
  let hsv = hexToHsv(color, { hue: 0, saturation: 0 });
  let pointer = null;

  function clearError() {
    hex.removeAttribute('aria-invalid');
    error.textContent = '';
  }

  function render({ keepText = false } = {}) {
    const angle = hsv.hue * Math.PI / 180;
    cursor.style.left = (50 + 49 * Math.sin(angle) * hsv.saturation) + '%';
    cursor.style.top = (50 - 49 * Math.cos(angle) * hsv.saturation) + '%';
    swatch.style.backgroundColor = cursor.style.backgroundColor = color;
    controls[0].value = Math.round(hsv.hue) % 360;
    controls[1].value = Math.round(hsv.saturation * 100);
    controls[2].value = Math.round(hsv.value * 100);
    controls[0].setAttribute('aria-valuetext', controls[0].value + ' degrés');
    controls[1].setAttribute('aria-valuetext', controls[1].value + ' %');
    controls[2].setAttribute('aria-valuetext', controls[2].value + ' %');
    if (!keepText) { hex.value = color; clearError(); }
  }

  function fromHsv() {
    color = hsvToHex(hsv);
    render();
    preview(color);
  }
  function selectPoint(event) {
    const bounds = wheel.getBoundingClientRect();
    const radius = bounds.width / 2;
    const x = (event.clientX - bounds.left - radius) / radius;
    const y = (event.clientY - bounds.top - radius) / radius;
    const saturation = clamp(Math.hypot(x, y));
    if (saturation > 0.01) hsv.hue = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
    hsv.saturation = saturation;
    fromHsv();
  }

  wheel.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, color, hsv: { ...hsv } };
    wheel.setPointerCapture(event.pointerId);
    selectPoint(event);
  });
  wheel.addEventListener('pointermove', event => { if (pointer?.id === event.pointerId) selectPoint(event); });
  wheel.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    selectPoint(event);
    pointer = null;
    commit(color);
  });
  wheel.addEventListener('lostpointercapture', () => {
    if (!pointer) return;
    ({ color, hsv } = pointer);
    pointer = null;
    render();
    preview(null);
  });

  controls.forEach((control, index) => {
    control.addEventListener('input', () => {
      hsv[channels[index]] = control.valueAsNumber / (index === 0 ? 1 : 100);
      fromHsv();
    });
    control.addEventListener('change', () => commit(color));
  });

  function readHex() {
    const candidate = hex.value.trim().toLowerCase();
    return /^#?[0-9a-f]{6}$/.test(candidate) ? '#' + candidate.replace(/^#/, '') : null;
  }
  hex.addEventListener('input', () => {
    clearError();
    const candidate = readHex();
    if (!candidate) { preview(null); return; }
    if (candidate !== color) hsv = hexToHsv(candidate, hsv);
    color = candidate;
    render({ keepText: true });
    preview(color);
  });
  function commitHex() {
    const candidate = readHex();
    if (!candidate) {
      hex.setAttribute('aria-invalid', 'true');
      error.textContent = 'Saisis six chiffres ou lettres de 0 à 9 et de A à F.';
      preview(null);
      return;
    }
    if (candidate !== color) hsv = hexToHsv(candidate, hsv);
    color = candidate;
    render();
    commit(color);
  }
  hex.addEventListener('change', commitHex);
  hex.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); commitHex(); }
  });

  return {
    sync(preferences, { reset = false } = {}) {
      panel.hidden = preferences.colorMode !== 'custom';
      const next = preferences.customColor || defaultColor;
      if (!reset && next === color) return;
      if (reset) pointer = null;
      if (reset || next !== color) hsv = hexToHsv(next, reset ? { hue: 0, saturation: 0 } : hsv);
      color = next;
      render();
    },
  };
}

export { defaultColor };
