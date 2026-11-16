import { units, lessons, crops } from './content.js';
import { initResources, initCourseResources, initUnitResources } from './resource-library.js';
import { initCalendar } from './calendar.js';
import { getCourseQuizService } from './course-quiz-service.js';
import { initCourseQuizNotice } from './course-quiz-ui.js';
import { validAttempt } from './course-quiz-model.js';
import { initDrill } from './drill.js';
import { initDashboard } from './dashboard.js';
import { initNavigation } from './navigation.js';
import { renderBreadcrumbs } from './breadcrumbs.js';
import { renderUnit, renderCourse, initCourseReading } from './learning-pages.js';
import { learningOverview } from './learning-overview.js';
import { initHome, initCourseHub, initPracticeHub, initToolsHub, updateLearningOverview } from './section-hubs.js';
import { initAppearance } from './appearance.js';
import { initBotanical } from './botanical.js';
import { initFooter } from './footer.js';
import { initAuthPage } from './auth-pages.js';
import { bindItkPersonal } from './itk-personal-ui.js';

const params = new URLSearchParams(location.search);
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const BASE = './';
let progress = {};
let courseQuizService;
let progressState = { mode: 'blocked', scope: null, view: { progress: {}, error: 'Vérification de la source des cours et QCM…' }, sync: { state: 'loading' } };
let progressEpoch = 0;
let refreshProgressUI = () => {};
const progressAvailable = () => progressState.mode !== 'blocked' && !progressState.view.error && progressState.sync.state !== 'session';
const progressSource = () => progressState.mode === 'personal' ? 'Historique personnel du compte' : 'Historique local de cet appareil';
const clean = value => String(value).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const unitUrl = id => `uc.html?id=${encodeURIComponent(id)}`;
const lessonUrl = id => `cours.html?id=${encodeURIComponent(id)}`;
const quizUrl = id => `exercices.html?id=${encodeURIComponent(id)}`;
const isDone = id => !!progress[id]?.done;
const pct = (a,b) => b ? Math.round(a/b*100) : 0;

const icons = {
  leaf:'<path d="M20 4c-6 0-13 3-14 10-1 4 2 6 5 6 7 0 10-7 9-16Z"/><path d="M4 21c2-6 6-10 12-13"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/>',
  chart:'<path d="M4 19h16M6 16V9m6 7V5m6 11v-5"/>',
  calculator:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2m4 0h2M8 16h2m4 0h2"/>',
  store:'<path d="M4 10h16l-2-6H6l-2 6Zm2 0v10h12V10M9 20v-6h6v6"/>',
  puzzle:'<path d="M4 4h6c-1 3 3 4 4 1a3 3 0 0 0-.1-1H20v6c-3-1-4 3-1 4h1v6h-6c1-3-3-4-4-1v1H4v-6c3 1 4-3 1-4H4V4Z"/>',
  book:'<path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1v-14ZM12 6.5v14"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  trophy:'<path d="M7 4h10v7c0 4-3 6-5 6s-5-2-5-6V4ZM7 6H4v3c0 3 3 4 4 4m9-7h3v3c0 3-3 4-4 4M12 17v4m-4 0h8"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
  warning:'<path d="m12 3 10 18H2L12 3Zm0 7v4m0 4h.01"/>',
  flask:'<path d="M9 2h6m-5 0v7L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L14 9V2m-7 13h10"/>',
  moon:'<path d="M20.4 15.3A8.5 8.5 0 0 1 8.7 3.6 8.5 8.5 0 1 0 20.4 15.3Z"/>',
  file:'<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 2v7h7M8 14h8m-8 4h6"/>',
  external:'<path d="M14 4h6v6m0-6-9 9"/><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 18v3h16v-3"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
};
const icon = (name, size=20) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.book}</svg>`;
function header() {
  const page = document.body.dataset.page;
  const title = document.title;
  $('#app-header').innerHTML = `<a class="skip-link" href="#app-main">Aller au contenu</a><div class="header-in wrap"><a class="brand" href="index.html" aria-label="Revenir à l'accueil"><span class="brand-symbol">${icon('leaf', 20)}</span><span class="brand-copy"><b>BPREA<span class="brand-dot">.</span></b><small>Mon espace de révision</small></span></a><nav class="primary-nav" id="primary-navigation" aria-label="Navigation principale"></nav><div class="header-actions"><button class="theme-toggle" id="theme-toggle" type="button" aria-label="Activer le mode sombre"><span class="theme-icon" aria-hidden="true"></span></button></div></div>`;
  initAppearance();
  initNavigation($('#primary-navigation'), page);
  document.title = `${title} · Mon BPREA`;
}
function home() { initHome($('#app-main')); }
function unit() {
  const u = units.find(item => item.id === params.get('id')) || units[2];
  $('#app-main').innerHTML = renderUnit(u, lessons, icon);
  initUnitResources($('#unit-resources'), u);
}
function course() {
  const l = lessons.find(item => item.id === params.get('id')) || lessons[0];
  const u = units.find(item => item.id === l.unit);
  $('#app-main').innerHTML = renderCourse(l, u, lessons, icon);
  initCourseReading($('#app-main'));
  initCourseResources($('#course-resources'), l);
  const checkbox = $('#mark-done');
  let savingCourse = false, requestedDone = null, savingEpoch = null;
  refreshProgressUI = () => {
    const saved = learningOverview(progressState).courses.find(item => item.lesson.id === l.id);
    const available = progressAvailable() && saved.known;
    const saving = savingCourse && savingEpoch === progressEpoch && available;
    checkbox.checked = saving ? requestedDone : available && saved.done;
    checkbox.disabled = saving || !available;
    $('#done-state').textContent = !available ? 'Progression indisponible' : saved.done ? 'Terminé ✓' : 'Pas encore terminé';
    if (saving) $('#done-state').textContent = 'Enregistrement sur cet appareil…';
  };
  refreshProgressUI();
  checkbox.addEventListener('change', async event => {
    const epoch = progressEpoch;
    const restoreFocus = document.activeElement === checkbox;
    savingCourse = true; requestedDone = event.target.checked; savingEpoch = epoch;
    checkbox.disabled = true;
    $('#done-state').textContent = 'Enregistrement sur cet appareil…';
    const result = await courseQuizService.setCourseDone(l.id, requestedDone);
    savingCourse = false;
    if (epoch !== progressEpoch) return;
    refreshProgressUI();
    if (result.error) $('#done-state').textContent = `Erreur de sauvegarde : ${result.error}`;
    if (restoreFocus && [document.body,checkbox].includes(document.activeElement)) checkbox.focus({ preventScroll: true });
  });
}
function quizzes() {
  const l = lessons.find(x => x.id === params.get('id')) || lessons[0];
  let answers = {}, submitted = false, saving = false, attempt = null;
  let source = `${progressState.mode}:${progressState.scope}`;
  $('#app-main').innerHTML = `<section class="page-top wrap">${renderBreadcrumbs('quiz', { lesson: l })}<div class="page-eyebrow">TEST DE CONNAISSANCES · ${l.quiz.length} QUESTIONS</div><h1>Vérifie ce que tu as retenu.</h1><p>${clean(l.title)} — réponds aux questions, puis découvre le corrigé et les explications.</p></section><section class="wrap content-layout quiz-layout"><div class="content-panel"><div id="quiz-questions">${l.quiz.map((q,i)=>`<fieldset class="question" data-question="${i}"><legend><span>QUESTION ${String(i+1).padStart(2,'0')}</span>${clean(q.q)}</legend>${q.options.map((option,j)=>`<label class="option"><input type="radio" name="q${i}" value="${j}"/><span class="option-letter">${String.fromCharCode(65+j)}</span><span>${clean(option)}</span></label>`).join('')}<div class="explanation" id="explain-${i}" hidden></div></fieldset>`).join('')}</div><div class="quiz-controls"><button id="check-quiz" class="btn btn-primary" disabled>Corriger mes réponses ${icon('check',18)}</button><button id="retry-quiz" class="btn btn-outline" hidden>Recommencer</button></div><div id="quiz-result" aria-live="polite"></div><section class="quiz-history-panel" aria-labelledby="quiz-history-title"><h2 id="quiz-history-title">Mes tentatives QCM</h2><p id="quiz-history-source"></p><div id="quiz-history"></div></section></div><aside class="aside-stack"><div class="aside-card aside-highlight"><span class="eyebrow">CONSEIL</span><h3>Ne révise pas en pilotage automatique.</h3><p>Essaie de justifier ta réponse avant de regarder la correction. C’est plus utile que de mémoriser seulement la lettre.</p></div><div class="aside-card"><span class="eyebrow">MEILLEUR SCORE</span><div class="big-ratio"><span id="quiz-best-score">—</span><span> / ${l.quiz.length}</span></div><p data-progress-source></p></div></aside></section>`;
  const form = $('#quiz-questions'), check = $('#check-quiz'), retry = $('#retry-quiz');
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  let historyMarkup;
  function reset() {
    answers = {}; submitted = false; saving = false; attempt = null;
    $$('input',form).forEach(x => { x.checked = false; x.disabled = !progressAvailable(); });
    $$('.option',form).forEach(x => x.classList.remove('correct','incorrect'));
    $$('.explanation',form).forEach(x => x.hidden = true);
    check.hidden = false; check.disabled = true; retry.hidden = true; $('#quiz-result').replaceChildren();
  }
  refreshProgressUI = () => {
    const nextSource = `${progressState.mode}:${progressState.scope}`;
    if (source !== nextSource || !progressAvailable() && progressState.sync.state === 'session') { source = nextSource; reset(); }
    const available = progressAvailable();
    $$('input',form).forEach(input => input.disabled = submitted || !available);
    check.disabled = submitted || !available || Object.keys(answers).length !== l.quiz.length;
    const saved = progress[l.id];
    $('#quiz-best-score').textContent = available && saved?.score !== undefined ? saved.score : '—';
    $('#quiz-history-source').textContent = available ? progressSource() : progressState.view.error || 'La progression doit être vérifiée.';
    const rows = available && Array.isArray(saved?.quizAttempts) ? saved.quizAttempts : [];
    const valid = rows.filter(validAttempt);
    const markup = !available ? '<p>Historique indisponible pour le moment. Les données enregistrées sont conservées.</p>' : valid.length ? `<ol class="quiz-attempt-list">${valid.map(row => `<li ${row.attemptId || row.id ? `data-attempt-id="${clean(row.attemptId || row.id)}"` : ''}><strong>${row.score} / ${row.total}</strong><time datetime="${clean(row.completedAt)}">${clean(date.format(new Date(row.completedAt)))}</time></li>`).join('')}</ol>` : '<p>Aucune tentative QCM historisée pour ce cours.</p>';
    if (markup !== historyMarkup) { $('#quiz-history').innerHTML = markup; historyMarkup = markup; }
  };
  refreshProgressUI();
  form.addEventListener('change', event => {
    if (submitted || !progressAvailable()) return;
    const match = event.target.name?.match(/^q(\d+)$/);
    if (match) answers[Number(match[1])] = Number(event.target.value);
    check.disabled = Object.keys(answers).length !== l.quiz.length;
  });
  async function saveAttempt() {
    if (saving || !attempt) return;
    saving = true;
    const epoch = progressEpoch;
    const pending = attempt;
    $('#quiz-result').innerHTML = `<div class="quiz-result-box"><div><strong>${pending.score} / ${pending.total} bonnes réponses</strong><p role="status">Enregistrement sur cet appareil…</p></div></div>`;
    $('#quiz-result').tabIndex = -1;
    $('#quiz-result').focus({ preventScroll: true });
    if (courseQuizService.getState().sync.state === 'storage-error') await courseQuizService.retry();
    if (epoch !== progressEpoch) return;
    const result = await courseQuizService.recordQuiz(l.id, pending);
    if (epoch !== progressEpoch) return;
    saving = false;
    $('#quiz-result').innerHTML = `<div class="quiz-result-box">${icon('check',28)}<div><strong>${pending.score} / ${pending.total} bonnes réponses</strong><p>${pending.score === pending.total && !result.error ? 'Sans faute ! Ton choix de terminer le cours a été enregistré sur cet appareil.' : 'Relis les corrections et recommence quand tu veux.'}</p>${result.error ? `<p role="alert">Erreur de sauvegarde : ${clean(result.error)} Cette tentative n’est pas annoncée comme enregistrée.</p><button class="btn btn-outline" type="button" id="retry-quiz-save">Réessayer l’enregistrement</button>` : `<p>Progression enregistrée sur cet appareil.${progressState.mode === 'personal' ? ' Le suivi de synchronisation précise son envoi au compte.' : ' Mode visiteur : sauvegarde locale uniquement.'}</p>`}</div></div>`;
    $('#retry-quiz-save')?.addEventListener('click', saveAttempt);
    refreshProgressUI();
  }
  check.addEventListener('click', async () => {
    if (submitted || !progressAvailable()) return;
    submitted = true;
    let score = 0;
    l.quiz.forEach((q,i) => {
      const ok = answers[i] === q.answer;
      if (ok) score++;
      const fs = $(`[data-question="${i}"]`);
      $$('.option',fs).forEach((el,j) => { if (j === q.answer) el.classList.add('correct'); if (j === answers[i] && !ok) el.classList.add('incorrect'); });
      const explanation = $(`#explain-${i}`); explanation.hidden = false;
      explanation.innerHTML = `<strong>${ok ? 'Bonne réponse' : 'À corriger'}</strong> — ${clean(q.why)}`;
    });
    $$('input',form).forEach(x => x.disabled = true);
    check.hidden = true; retry.hidden = false;
    attempt = { score, total: l.quiz.length, completedAt: new Date().toISOString() };
    await saveAttempt();
  });
  retry.addEventListener('click', () => { if (!saving) { reset(); $('input',form)?.focus({ preventScroll: true }); } });
}
function selectOptions(options,selected){return options.map(x=>`<option value="${clean(x)}" ${selected===x?'selected':''}>${clean(x)}</option>`).join('');}
function dateForMonth(month,year){return new Date(year,month-1,15,12);}
function moveWeeks(date,w){const d=new Date(date.getTime());d.setDate(d.getDate()+w*7);return d;}
const fmt = new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'});
function monthLabel(date){return fmt.format(date);}
function itkResult(data){
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
  const values=[`Espèce : ${crop.name}`,`Variété / type : ${data.variety}`,`Mode : ${cover==='serre'?'Sous abri':'Plein champ'}`,`Surface : ${area} m²`,`Mois de départ : ${monthLabel(date)}`];
  return `<div class="result-header"><div><span class="eyebrow">ITINÉRAIRE GÉNÉRÉ</span><h2>${clean(crop.name)} · ${clean(data.variety)}</h2><p>${clean(values.slice(2).join(' · '))}</p></div><span class="pill status-ready">Scénario pédagogique</span></div><div class="metric-grid"><div class="metric"><small>DENSITÉ DE RÉFÉRENCE</small><strong>${density.toLocaleString('fr-FR',{maximumFractionDigits:1})}</strong><span>plants/m² (estimation)</span></div><div class="metric"><small>NOMBRE THÉORIQUE</small><strong>${plants.toLocaleString('fr-FR')}</strong><span>plants pour ${area} m² cultivés</span></div><div class="metric"><small>OPÉRATIONS</small><strong>${rows.length}</strong><span>jalons à adapter</span></div></div><p class="subtle-explainer"><strong>Plage de référence :</strong> ${clean(crop.densityRange)}. La surface saisie correspond à une surface <em>réellement cultivée</em>, hors allées et espaces techniques.</p><div class="warning-block">${icon('warning',20)}<div><strong>Points de vigilance</strong><ul>${[...flags,crop.warning,'Vérifier analyses de sol, fertilisation, disponibilité en eau, pression sanitaire et références techniques locales avant application.'].map(t=>`<li>${clean(t)}</li>`).join('')}</ul></div></div><h3 class="table-heading">Calendrier indicatif des interventions</h3><div class="timeline">${rows.map((r,i)=>`<div class="timeline-entry"><div class="timeline-date">${clean(r.date)}<span>${r.offset===0?'Départ':(r.offset>0?`S +${r.offset}`:`S ${r.offset}`)}</span></div><div class="timeline-dot"></div><div class="timeline-content"><strong>${clean(r.name)}</strong><p>${clean(r.detail)}</p></div></div>`).join('')}</div><div class="export-row"><button class="btn btn-primary" id="csv-export" type="button">Exporter le calendrier CSV ↓</button><button class="btn btn-outline" id="print-itk" type="button">Imprimer / PDF</button></div><p class="result-disclaimer">Données synthétiques construites pour une démonstration du logiciel. Aucune prescription agronomique individualisée. Les échéances sont arrondies au mois, non au jour.</p>`;
}
function itk(){
  const data={crop:'tomate',cover:'serre',variety:'Marmande',area:'100',month:'5',year:'2028',soil:'limoneux',water:'standard'};
  $('#app-main').innerHTML=`<section class="page-top wrap itk-top">${renderBreadcrumbs('itk')}<div class="page-eyebrow">LABORATOIRE AGRONOMIQUE · PROTOTYPE</div><h1>Construire un itinéraire technique.</h1><p>Choisis une culture et ses contraintes pour obtenir un calendrier d’opérations. Les résultats sont des hypothèses de travail, pas une fiche technique validée.</p></section><section class="wrap itk-layout"><div class="itk-form-panel"><div class="panel-heading"><div><span class="eyebrow">PARAMÈTRES</span><h2>Ta culture</h2></div>${icon('leaf',25)}</div><form id="itk-form"><label for="crop">Espèce cultivée</label><select name="crop" id="crop">${Object.entries(crops).map(([key,c])=>`<option value="${key}" ${data.crop===key?'selected':''}>${clean(c.name)}</option>`).join('')}</select><label for="variety">Variété ou type</label><select name="variety" id="variety"></select><div class="form-columns"><div><label for="cover">Conduite</label><select name="cover" id="cover"><option value="serre" ${data.cover==='serre'?'selected':''}>Sous abri</option><option value="plein" ${data.cover==='plein'?'selected':''}>Plein champ</option></select></div><div><label for="area">Surface cultivée (m²)</label><input name="area" id="area" type="number" min="1" max="100000" step="1" required value="${clean(data.area)}"></div></div><div class="form-columns"><div><label for="month">Mois de départ</label><select name="month" id="month">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${data.month===String(i+1)?'selected':''}>${new Intl.DateTimeFormat('fr-FR',{month:'long'}).format(new Date(2027,i,1))}</option>`).join('')}</select></div><div><label for="soil">Texture dominante</label><select name="soil" id="soil"><option value="leger" ${data.soil==='leger'?'selected':''}>Légère / sableuse</option><option value="limoneux" ${data.soil==='limoneux'?'selected':''}>Intermédiaire / limoneuse</option><option value="lourd" ${data.soil==='lourd'?'selected':''}>Lourde / argileuse</option></select></div></div><label for="year">Année de culture</label><select name="year" id="year">${Array.from({length:8},(_,i)=>2026+i).map(y=>`<option value="${y}" ${data.year===String(y)?'selected':''}>${y}</option>`).join('')}</select><label for="water">Accès à l’eau</label><select name="water" id="water"><option value="standard" ${data.water==='standard'?'selected':''}>Irrigation à dimensionner</option><option value="limitee" ${data.water==='limitee'?'selected':''}>Ressource limitée / incertaine</option></select><button type="submit" class="btn btn-primary full">Générer mon itinéraire ${icon('arrow',18)}</button><p class="form-caption">Le calendrier est calculé sur cet appareil.</p></form></div><div class="itk-result-panel" id="itk-output"><div class="placeholder-result"><span class="placeholder-icon">${icon('calendar',38)}</span><h2>Ton calendrier apparaîtra ici.</h2><p>Sélectionne une espèce, une variété, une surface et un mois de départ, puis génère l’itinéraire.</p><div class="placeholder-lines"><span></span><span></span><span></span></div></div></div></section>`;
  const form=$('#itk-form'),varSelect=$('#variety');let selectedCrop=data.crop;
  function updateVariety(prefer){const options=crops[selectedCrop].varieties;varSelect.innerHTML=selectOptions(options,options.includes(prefer)?prefer:options[0]);}
  updateVariety(data.variety);
  const syncPanel = document.createElement('section');
  syncPanel.id = 'itk-sync-panel'; syncPanel.className = 'itk-sync-panel';
  syncPanel.setAttribute('aria-label', 'Sauvegarde des paramètres ITK');
  form.after(syncPanel);
  const placeholder = $('#itk-output').innerHTML;
  const binding = bindItkPersonal(form, syncPanel, {
    applyValues(value) {
      selectedCrop = value.crop;
      $('#crop').value = value.crop;
      updateVariety(value.variety);
      for (const key of ['cover', 'area', 'month', 'year', 'soil', 'water']) form.elements.namedItem(key).value = value[key];
      form.elements.area.setCustomValidity('');
    },
    clearResult() { $('#itk-output').innerHTML = placeholder; $('#itk-output').classList.remove('has-result'); }
  });
  $('#crop').addEventListener('change',e=>{selectedCrop=e.target.value;updateVariety(null);});
  $('#area').addEventListener('input',e=>e.target.setCustomValidity(''));
  form.addEventListener('submit',event=>{event.preventDefault();const raw=Object.fromEntries(new FormData(form));const area=Number(raw.area);if(!Number.isFinite(area)||area<1||area>100000){$('#area').setCustomValidity('Saisis une surface entre 1 et 100 000 m².');$('#area').reportValidity();return;}$('#area').setCustomValidity('');binding.save(raw);const result=$('#itk-output');result.innerHTML=itkResult(raw);result.classList.add('has-result');const crop=crops[raw.crop],date=dateForMonth(Number(raw.month),Number(raw.year));const rows=crop.tasks.map(([name,detail],i)=>[monthLabel(moveWeeks(date,crop.weeks[i])),name,detail]);$('#csv-export').addEventListener('click',()=>{const dataCSV=[['Période','Opération','Description'],...rows].map(row=>row.map(cell=>'"'+String(cell).replaceAll('"','""')+'"').join(';')).join('\r\n');const blob=new Blob(['\uFEFF'+dataCSV],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`itk-${raw.crop}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});$('#print-itk').addEventListener('click',()=>window.print());});
}
function dashboard(){
  const root=$('#app-main');
  return initDashboard(root).catch(()=>{
    const panel=document.createElement('section');
    panel.className='wrap dashboard-empty';
    panel.setAttribute('role','alert');
    const title=document.createElement('h1');title.textContent='Tableau de bord indisponible';
    const message=document.createElement('p');message.textContent='La source des résultats ne peut pas être vérifiée. Recharge la page pour réessayer. Les données enregistrées sont conservées.';
    panel.append(title,message);root.replaceChildren(panel);
  });
}
function updateProgressElements() {
  const available = progressAvailable();
  for (const u of units) {
    const list = lessons.filter(lesson => lesson.unit === u.id);
    const done = list.filter(lesson => isDone(lesson.id)).length;
    $$(`[data-unit-done="${u.id}"]`).forEach(node => node.textContent = available ? done : '—');
    $$(`[data-unit-track="${u.id}"]`).forEach(node => node.style.width = `${available ? pct(done,list.length) : 0}%`);
  }
  $$('[data-lesson-completed]').forEach(node => node.hidden = !available || !isDone(node.dataset.lessonCompleted));
  $$('[data-progress-source]').forEach(node => node.textContent = available ? progressSource() : 'Progression indisponible : les données doivent être vérifiées.');
  const footer = $('#footer-progress-source');
  if (footer) footer.textContent = `Contenus de démonstration non officiels · ${available ? progressSource() : 'Source des cours et QCM à vérifier'}`;
  updateLearningOverview($('#app-main'), progressState);
  refreshProgressUI();
}
async function init(){
  header();
  const page=document.body.dataset.page;
  const usesProgress = ['home', 'courses', 'uc', 'course', 'quiz'].includes(page);
  if (usesProgress) {
    $('#app-main').innerHTML = '<section class="page-top wrap"><h1>Chargement des cours et QCM</h1><p role="status">Vérification de la source de progression…</p></section>';
    try { courseQuizService = await getCourseQuizService(); progressState = courseQuizService.getState(); }
    catch { progressState.view.error = 'La source de progression est indisponible. Les données enregistrées sont conservées.'; }
    progress = progressAvailable() ? progressState.view.progress : {};
  }
  ({home,courses:()=>initCourseHub($('#app-main')),practice:()=>initPracticeHub($('#app-main')),tools:()=>initToolsHub($('#app-main')),uc:unit,course,quiz:quizzes,itk,resources:()=>initResources($('#app-main')),calendar:()=>initCalendar($('#app-main')),drill:()=>initDrill($('#app-main')),dashboard,botanical:()=>initBotanical($('#app-main')),'auth-login':()=>initAuthPage(),'auth-reset':()=>initAuthPage(),'auth-callback':()=>initAuthPage(),profile:()=>initAuthPage()}[page]||home)();
  // Render the expanded footer after the initial page content. Hydrating it
  // before the course source resolves briefly filled the viewport with footer
  // links, then displaced the whole surface when the page became available.
  initFooter($('#app-footer'), { page });
  if (usesProgress) {
    const notice = document.createElement('section');
    notice.className = 'wrap course-quiz-notice';
    notice.setAttribute('aria-label', 'État de sauvegarde des cours et QCM');
    notice.hidden = true;
    $('#app-main > section')?.after(notice);
    if (courseQuizService) {
      const disposeNotice = initCourseQuizNotice(notice, courseQuizService);
      // The service subscription is independent of the detailed profile panel.
      const unsubscribe = courseQuizService.subscribe(state => {
        if (`${state.mode}:${state.scope}` !== `${progressState.mode}:${progressState.scope}` || state.sync.state === 'session' && progressState.sync.state !== 'session') progressEpoch++;
        progressState = state;
        progress = progressAvailable() ? state.view.progress : {};
        updateProgressElements();
      });
      window.addEventListener('pagehide', () => { disposeNotice(); unsubscribe(); courseQuizService.stop(); }, { once: true });
      window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
    } else {
      notice.textContent = progressState.view.error;
      notice.setAttribute('role', 'status');
      notice.hidden = false;
    }
    updateProgressElements();
  }
  if (page === 'courses') {
    const fact = $('#course-daily-fact');
    // No fact module, bank or optional resource catalog on other pages.
    import('./daily-fact.js').then(({ initDailyFact }) => initDailyFact(fact)).then(dispose => {
      window.addEventListener('pagehide', dispose, { once: true });
    }).catch(() => { /* An optional reading aid never blocks the courses. */ });
  }
}
init();
