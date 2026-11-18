import { crops } from './content.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { bindItkPersonal, itkDisplayParameters } from './itk-personal-ui.js';

const clean = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function selectOptions(options,selected){return options.map(x=>`<option value="${clean(x)}" ${selected===x?'selected':''}>${clean(x)}</option>`).join('');}
function dateForMonth(month,year){return new Date(year,month-1,15,12);}
function moveWeeks(date,w){const d=new Date(date.getTime());d.setDate(d.getDate()+w*7);return d;}
const fmt = new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'});
function monthLabel(date){return fmt.format(date);}
function itkResult(data, icon) {
  const crop=crops[data.crop];const month=Number(data.month);const date=dateForMonth(month,Number(data.year));const area=Number(data.area);const cover=data.cover;const soil=data.soil;const water=data.water;const within=crop.window[cover].includes(month);
  let density=crop.baseDensity*(cover==='plein'&&data.crop==='tomate'?.85:1);
  const plants=Math.round(area*density);
  const rows=crop.tasks.map(([name,detail],i)=>({name,detail,date:monthLabel(moveWeeks(date,crop.weeks[i])),offset:crop.weeks[i]}));
  const flags=[];
  const varietyTips={
    tomate:{'Marmande':'Marmande : confirmer le port, la précocité et les besoins de tuteurage à partir de la fiche semencier.','Roma':'Roma : vérifier le caractère déterminé ou non du cultivar précis, qui conditionne le palissage et le calendrier de récolte.','Cœur de bœuf':'Cœur de bœuf : anticiper le poids des fruits dans le choix du tuteurage et vérifier la précocité du cultivar.'},
    laitue:{'Batavia':'Batavia : contrôler le type de pomme et la sensibilité à la montaison selon la saison.','Feuille de chêne':'Feuille de chêne : adapter le stade de récolte au format commercial choisi.','Laitue pommée':'Laitue pommée : suivre la formation de la pomme et les risques de montaison.'},
    carotte:{'Nantaise':'Nantaise : contrôler le calibre et la longueur commerciale ciblés.','Touchon':'Touchon : vérifier la précocité annoncée par le fournisseur ; la date de récolte peut être plus courte.','Carotte de conservation':'Carotte de conservation : prévoir un contrôle de maturité et des conditions de stockage, le cycle pouvant être plus long.'},
    courgette:{'Black Beauty':'Black Beauty : surveiller fréquemment le calibre des fruits allongés.','Ronde de Nice':'Ronde de Nice : définir le calibre de récolte des fruits ronds avec le débouché.','Courgette verte (type)':'Courgette verte : confirmer port de la plante et conditions de récolte selon la variété exacte.'}
  };
  flags.push(varietyTips[data.crop]?.[data.variety] || 'Variété non caractérisée : obtenir une fiche technique du fournisseur avant de fixer dates, densités et conduite.');
  if(!within)flags.push(`Le mois de départ (${monthLabel(date)}) est hors de la fenêtre indicative retenue pour ${crop.name.toLowerCase()} en ${cover==='serre'?'culture sous abri':'plein champ'}. Revoir le calendrier selon météo, variété et protection.`);
  if(water==='limitee')flags.push('Accès à l’eau limité : la réussite de cette culture dépend d’une stratégie d’irrigation fiable. Ne pas considérer l’ITK comme réalisable sans vérification.');
  if(soil==='lourd')flags.push('Sol lourd : attendre un ressuyage suffisant et adapter le travail du sol pour limiter tassement et battance.');
  if(data.crop==='carotte')flags.push('Pour la carotte, la densité estimée représente des plants visés après levée, pas un nombre garanti de graines ni une quantité exacte de semences.');
  return {
    rows,
    markup: `
      <header class="result-header">
        <p class="itk-result-kind">Scénario pédagogique</p>
        <h2 id="itk-result-title" tabindex="-1">${clean(crop.name)} · ${clean(data.variety)}</h2>
        <dl class="itk-culture-summary">
          <div><dt>Conduite</dt><dd>${cover === 'serre' ? 'Sous abri' : 'Plein champ'}</dd></div>
          <div><dt>Surface</dt><dd>${area} m²</dd></div>
          <div><dt>Départ</dt><dd>${clean(monthLabel(date))}</dd></div>
        </dl>
        <div class="itk-result-links">
          <a href="#crop" data-itk-return>Modifier les paramètres</a>
          <a href="#csv-export">Aller aux exports</a>
        </div>
      </header>
      <dl class="metric-grid">
        <div class="metric">
          <dt>Densité de référence</dt>
          <dd><strong>${density.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</strong><span>plants/m² (estimation)</span></dd>
        </div>
        <div class="metric">
          <dt>Nombre théorique</dt>
          <dd><strong>${plants.toLocaleString('fr-FR')}</strong><span>plants pour ${area} m² cultivés</span></dd>
        </div>
        <div class="metric">
          <dt>Opérations</dt>
          <dd><strong>${rows.length}</strong><span>jalons à adapter</span></dd>
        </div>
      </dl>
      <p class="subtle-explainer"><strong>Plage de référence :</strong> ${clean(crop.densityRange)}. La surface saisie correspond à une surface <em>réellement cultivée</em>, hors allées et espaces techniques.</p>
      <section class="warning-block" aria-labelledby="itk-warning-title">
        ${icon('warning', 20)}
        <div>
          <h3 id="itk-warning-title">Points de vigilance</h3>
          <ul>${[...flags, crop.warning, 'Vérifier analyses de sol, fertilisation, disponibilité en eau, pression sanitaire et références techniques locales avant application.'].map(text => `<li>${clean(text)}</li>`).join('')}</ul>
        </div>
      </section>
      <section class="itk-calendar" aria-labelledby="itk-calendar-title">
        <h3 id="itk-calendar-title">Calendrier indicatif des interventions</h3>
        <p>Les semaines sont comptées par rapport au mois de départ.</p>
        <ol class="timeline" role="list">
          ${rows.map(row => `
            <li class="timeline-entry">
              <div class="timeline-date">
                <strong class="itk-month">${clean(row.date)}</strong>
                <span>${row.offset === 0 ? 'Départ' : row.offset > 0 ? `S +${row.offset}` : `S ${row.offset}`}</span>
              </div>
              <div class="timeline-content">
                <h4>${clean(row.name)}</h4>
                <p>${clean(row.detail)}</p>
              </div>
            </li>`).join('')}
        </ol>
      </section>
      <div class="export-row" role="group" aria-label="Exporter l’itinéraire">
        <button class="btn btn-surface" id="csv-export" type="button">${icon('download', 20)} Exporter le calendrier CSV</button>
        <button class="btn btn-surface" id="print-itk" type="button">${icon('file', 20)} Imprimer / PDF</button>
      </div>
      <p class="result-disclaimer">Données synthétiques construites pour une démonstration du logiciel. Aucune prescription agronomique individualisée. Les échéances sont arrondies au mois, non au jour.</p>`,
  };
}

export function initItk(root, icon) {
  const $ = (selector, parent = root) => parent.querySelector(selector);
  const data = itkDisplayParameters();
  const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long' });
  const placeholder = `
    <div class="itk-empty">
      <span class="itk-section-icon">${icon('calendar', 26)}</span>
      <h2>Ton itinéraire technique</h2>
      <p>Génère l’itinéraire pour retrouver ici les éléments de ton scénario.</p>
      <ul class="itk-empty-list" role="list">
        <li>${icon('leaf', 20)} Synthèse de la culture et indicateurs</li>
        <li>${icon('warning', 20)} Points de vigilance agronomiques</li>
        <li>${icon('calendar', 20)} Calendrier indicatif des interventions</li>
        <li>${icon('download', 20)} Export CSV et impression</li>
      </ul>
    </div>`;
  root.innerHTML = `
    <header class="page-top wrap itk-top">
      ${renderBreadcrumbs('itk')}
      <h1>Construire un itinéraire technique</h1>
      <p>Choisis ta culture et ses paramètres pour obtenir un calendrier indicatif des interventions.</p>
      <p class="itk-intro-note">Outil pédagogique de démonstration, sans prescription agronomique.</p>
    </header>
    <div class="wrap itk-layout">
      <section class="itk-form-panel" aria-labelledby="itk-form-title">
        <div class="itk-form-heading">
          <span class="itk-section-icon">${icon('leaf', 22)}</span>
          <h2 id="itk-form-title">Paramètres de culture</h2>
        </div>
        <form id="itk-form">
          <fieldset>
            <legend>Culture</legend>
            <div class="itk-fields itk-fields-culture">
              <div>
                <label for="crop">Espèce cultivée</label>
                <select name="crop" id="crop">${Object.entries(crops).map(([key, crop]) =>
                  `<option value="${key}" ${data.crop === key ? 'selected' : ''}>${clean(crop.name)}</option>`).join('')}</select>
              </div>
              <div>
                <label for="variety">Variété ou type</label>
                <select name="variety" id="variety"></select>
              </div>
            </div>
          </fieldset>
          <fieldset>
            <legend>Conditions de production</legend>
            <div class="itk-fields">
              <div>
                <label for="cover">Conduite</label>
                <select name="cover" id="cover">
                  <option value="serre" selected>Sous abri</option>
                  <option value="plein">Plein champ</option>
                </select>
              </div>
              <div>
                <label for="area">Surface cultivée (m²)</label>
                <input name="area" id="area" type="number" min="1" max="100000" step="1" required value="${data.area}" aria-describedby="itk-area-help itk-area-error">
                <p class="itk-field-help" id="itk-area-help">Hors allées et espaces techniques.</p>
                <p class="itk-field-error" id="itk-area-error" hidden></p>
              </div>
              <div class="itk-field-wide">
                <label for="soil">Texture dominante</label>
                <select name="soil" id="soil">
                  <option value="leger">Légère / sableuse</option>
                  <option value="limoneux" selected>Intermédiaire / limoneuse</option>
                  <option value="lourd">Lourde / argileuse</option>
                </select>
              </div>
              <div class="itk-field-wide">
                <label for="water">Accès à l’eau</label>
                <select name="water" id="water">
                  <option value="standard" selected>Irrigation à dimensionner</option>
                  <option value="limitee">Ressource limitée / incertaine</option>
                </select>
              </div>
            </div>
          </fieldset>
          <fieldset>
            <legend>Calendrier</legend>
            <div class="itk-fields">
              <div>
                <label for="month">Mois de départ</label>
                <select name="month" id="month">${Array.from({ length: 12 }, (_, i) =>
                  `<option value="${i + 1}" ${data.month === String(i + 1) ? 'selected' : ''}>${monthFormat.format(new Date(2027, i, 1))}</option>`).join('')}</select>
              </div>
              <div>
                <label for="year">Année de culture</label>
                <select name="year" id="year">${Array.from({ length: 8 }, (_, i) => 2026 + i).map(year =>
                  `<option value="${year}" ${data.year === String(year) ? 'selected' : ''}>${year}</option>`).join('')}</select>
              </div>
            </div>
          </fieldset>
          <button type="submit" class="btn btn-surface btn-surface--accent">Générer mon itinéraire ${icon('arrow', 20)}</button>
        </form>
        <section class="itk-sync-panel" id="itk-sync-panel" aria-labelledby="itk-sync-title"></section>
      </section>
      <section class="itk-result-panel" id="itk-output" aria-label="Résultat de l’itinéraire">${placeholder}</section>
    </div>`;

  const form = $('#itk-form');
  const cropInput = form.elements.crop;
  const areaInput = form.elements.area;
  const areaError = $('#itk-area-error');
  const result = $('#itk-output');
  let selectedCrop = data.crop;
  function updateVariety(prefer) {
    const options = crops[selectedCrop].varieties;
    form.elements.variety.innerHTML = selectOptions(options, options.includes(prefer) ? prefer : options[0]);
  }
  function clearAreaError() {
    areaInput.setCustomValidity('');
    areaInput.removeAttribute('aria-invalid');
    areaError.hidden = true;
    areaError.textContent = '';
  }
  updateVariety(data.variety);
  const binding = bindItkPersonal(form, $('#itk-sync-panel'), {
    applyValues(value) {
      selectedCrop = value.crop;
      cropInput.value = value.crop;
      updateVariety(value.variety);
      for (const key of ['cover', 'area', 'month', 'year', 'soil', 'water']) form.elements.namedItem(key).value = value[key];
      clearAreaError();
    },
    clearResult() {
      result.innerHTML = placeholder;
    }
  });
  cropInput.addEventListener('change', () => {
    selectedCrop = cropInput.value;
    updateVariety(null);
  });
  areaInput.addEventListener('input', clearAreaError);
  areaInput.addEventListener('invalid', () => {
    areaInput.setAttribute('aria-invalid', 'true');
    areaError.textContent = 'Saisis une surface entière entre 1 et 100 000 m².';
    areaError.hidden = false;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const { crop, variety, cover, area: areaValue, month, soil, year, water } = Object.fromEntries(new FormData(form));
    const raw = { crop, variety, cover, area: areaValue, month, soil, year, water };
    const area = Number(areaValue);
    if (!Number.isFinite(area) || area < 1 || area > 100000) {
      areaInput.setCustomValidity('Saisis une surface entre 1 et 100 000 m².');
      areaInput.reportValidity();
      return;
    }
    clearAreaError();
    binding.save(raw);
    const { markup, rows } = itkResult(raw, icon);
    result.innerHTML = markup;
    $('[data-itk-return]', result).addEventListener('click', event => {
      event.preventDefault();
      cropInput.focus();
    });
    $('#csv-export').addEventListener('click', () => {
      const dataCSV = [['Période', 'Opération', 'Description'], ...rows.map(({ date, name, detail }) => [date, name, detail])]
        .map(row => row.map(cell => '"' + String(cell).replaceAll('"', '""') + '"').join(';')).join('\r\n');
      const blob = new Blob(['\uFEFF' + dataCSV], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `itk-${raw.crop}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $('#print-itk').addEventListener('click', () => window.print());
    const title = $('#itk-result-title');
    requestAnimationFrame(() => {
      if (title.isConnected) title.focus();
    });
  });
}
