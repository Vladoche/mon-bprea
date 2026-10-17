import { units } from './content.js';

export const eventTypes = {
  cours: 'Cours',
  stage: 'Stage',
  vacances: 'Vacances',
  examen: 'Examen',
};

/** Les dates du calendrier sont des journées civiles locales, sans fuseau UTC. */
export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function dateKey(date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const todayKey = () => dateKey(new Date());

/** Écart de journées civiles : reste exact lors des changements d'heure. */
export function daysBetween(start, end) {
  const dayNumber = value => {
    const date = typeof value === 'string' ? parseDate(value) : value;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return NaN;
    const utc = new Date(0);
    utc.setUTCHours(0, 0, 0, 0);
    utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    return utc.getTime() / 86400000;
  };
  return dayNumber(end) - dayNumber(start);
}

export async function loadCalendar() {
  try {
    const response = await fetch(new URL('./calendar-events.json', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error('unavailable');
    const data = await response.json();
    if (!data || typeof data !== 'object' || !Array.isArray(data.events)) {
      return { events: [], error: 'Le calendrier ne peut pas être affiché : ses informations ne sont pas au format attendu.', warnings: [] };
    }

    const warnings = [];
    const events = [];
    const usedIds = new Set();
    data.events.forEach((entry, index) => {
      const label = `Événement ${index + 1}`;
      const reject = message => warnings.push(`${label} non affiché : ${message}.`);
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return reject('informations invalides');
      if (typeof entry.id !== 'string' || !entry.id.trim()) return reject('identifiant manquant');
      const id = entry.id.trim();
      if (usedIds.has(id)) return reject('identifiant déjà utilisé');
      if (typeof entry.title !== 'string' || !entry.title.trim()) return reject('titre manquant');
      if (typeof entry.type !== 'string' || !Object.prototype.hasOwnProperty.call(eventTypes, entry.type)) return reject('catégorie inconnue');
      if (!parseDate(entry.start)) return reject('date de début invalide');
      const end = entry.end === undefined || entry.end === '' ? entry.start : entry.end;
      if (!parseDate(end) || end < entry.start) return reject('date de fin invalide ou antérieure au début');
      if (entry.example !== undefined && typeof entry.example !== 'boolean') return reject('le statut d’exemple doit être vrai ou faux');

      let unit = entry.unit || null;
      if (unit && !units.some(item => item.id === unit)) {
        warnings.push(`${label} : l’UC indiquée est inconnue ; l’événement reste affiché sans lien vers une UC.`);
        unit = null;
      }
      const optionalText = field => {
        if (entry[field] === undefined || entry[field] === null) return '';
        if (typeof entry[field] === 'string') return entry[field].trim();
        warnings.push(`${label} : ${field === 'description' ? 'la description' : 'le lieu'} n’a pas pu être affiché.`);
        return '';
      };
      usedIds.add(id);
      events.push({ id, title: entry.title.trim(), type: entry.type, start: entry.start, end, unit,
        description: optionalText('description'), location: optionalText('location'), example: entry.example === true });
    });
    events.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title, 'fr'));
    return { events, error: null, warnings };
  } catch {
    return { events: [], error: 'Le calendrier est momentanément indisponible. Réessaie dans un instant.', warnings: [] };
  }
}
