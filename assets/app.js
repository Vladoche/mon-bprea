import { units, lessons, crops } from './content.js';
import { resourceLinks, resourceFiles } from './resources.js';

const params = new URLSearchParams(location.search);
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const BASE = './';
const STORE_KEY = 'bprea-demo-progress-v1';
const ITK_KEY = 'bprea-demo-itk-v1';
const THEME_KEY = 'bprea-demo-theme-v1';
const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
let progress = safeRead(STORE_KEY, {});
const saveProgress = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch {} };
const clean = value => String(value).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const normalizeSearch = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
const unitUrl = id => `uc.html?id=${encodeURIComponent(id)}`;
const lessonUrl = id => `cours.html?id=${encodeURIComponent(id)}`;
const quizUrl = id => `exercices.html?id=${encodeURIComponent(id)}`;
const isDone = id => !!progress[id]?.done;
const countDone = () => lessons.filter(x => isDone(x.id)).length;
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
function setupThemeToggle() {
  const button = $('#theme-toggle');
  function update() {
    const dark = document.documentElement.dataset.theme === 'dark';
    button.querySelector('.theme-icon').innerHTML = icon(dark ? 'sun' : 'moon', 18);
    button.querySelector('.theme-label').textContent = dark ? 'Mode clair' : 'Mode sombre';
    button.setAttribute('aria-label', dark ? 'Activer le mode clair' : 'Activer le mode sombre');
    button.setAttribute('aria-pressed', String(dark));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#101a15' : '#184e39');
  }
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    update();
  });
  update();
}
function header() {
  const page = document.body.dataset.page;
  const title = document.title;
  $('#app-header').innerHTML = `<div class="header-in wrap"><a class="brand" href="index.html" aria-label="Revenir à l'accueil"><span class="brand-symbol">${icon('leaf', 20)}</span><span class="brand-copy"><b>BPREA<span class="brand-dot">.</span></b><small>Mon espace de révision</small></span></a><nav class="top-nav" aria-label="Navigation principale"><a class="${page === 'home' || page === 'uc' || page === 'course' || page === 'quiz' ? 'active' : ''}" href="index.html">Mes cours</a><a class="${page === 'itk' ? 'active' : ''}" href="itk.html">Générateur ITK</a><a class="${page === 'resources' ? 'active' : ''}" href="ressources.html">Ressources documentaires</a></nav><span class="header-badge">Etat - W.I.P</span><button class="theme-toggle" id="theme-toggle" type="button"><span class="theme-icon" aria-hidden="true"></span><span class="theme-label"></span></button></div>`;
  setupThemeToggle();
  $('#app-footer').innerHTML = `<div class="wrap footer-in"><span>© ${new Date().getFullYear()} · Mon BPREA</span><span>Contenus de démonstration non officiels · Données conservées sur cet appareil</span></div>`;
  document.title = `${title} · Mon BPREA`;
}
function unitCard(u) {
  const ls = lessons.filter(l=>l.unit===u.id), done = ls.filter(l=>isDone(l.id)).length;
  return `<a class="unit-card" href="${unitUrl(u.id)}"><span class="unit-icon tone-${u.tone}">${icon(u.icon,24)}</span><div class="unit-card-meta"><span class="eyebrow">${u.code}</span>${ls.length?'<span class="pill status-ready">Cours disponibles</span>':'<span class="pill">À compléter</span>'}</div><h3>${clean(u.title)}</h3><p>${clean(u.short)}</p><div class="unit-card-bottom"><span>${ls.length ? `${ls.length} cours · ${done} terminé${done>1?'s':''}` : 'En attente des cours'}</span><span class="arrow-disc">${icon('arrow',17)}</span></div>${ls.length?`<div class="thin-track"><span style="width:${pct(done,ls.length)}%"></span></div>`:''}</a>`;
}
function home() {
  const total = lessons.length, done = countDone();
  $('#app-main').innerHTML = `<section class="hero wrap"><div class="hero-content"><div class="section-kicker"><span class="kicker-line"></span> TON CARNET DE RÉVISION</div><h1>Faire pousser<br><em>ses connaissances.</em></h1><p>Un espace clair pour retrouver tes cours de BPREA, tester ce que tu as retenu et préparer des itinéraires techniques.</p><div class="hero-actions"><a class="btn btn-primary" href="${unitUrl('uc3')}">Reprendre les cours ${icon('arrow',18)}</a><a class="btn btn-outline" href="itk.html">Créer un ITK ${icon('flask',18)}</a></div></div><div class="hero-visual" aria-hidden="true"><div class="soil-panel"><span class="diagram-label top-label">LE SAVOIR PREND RACINE</span><svg viewBox="0 0 410 340" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke="#aecdb4" stroke-width="1"><path d="M0 178H410" stroke-dasharray="5 7"/><path d="M0 226H410M0 274H410" opacity=".33"/></g><path d="M205 182C207 131 200 86 197 39" stroke="#255f42" stroke-width="7" stroke-linecap="round"/><path d="M201 139C160 132 126 112 113 75c48 0 81 21 88 64Z" fill="#87ae74"/><path d="M207 110c28-45 51-56 88-57-10 44-40 67-88 57Z" fill="#52875b"/><path d="M199 71c-13-15-17-31-16-52 24 13 30 30 16 52Z" fill="#afca94"/><path d="M207 179c-19 23-20 36-26 57m25-57c21 24 32 36 45 57m-46-56c-1 55-8 91-17 121m17-81c-29 6-46 29-55 48m54-29c23 3 38 23 46 54m-63-33c-20-3-34 6-45 21m111-19c14 1 29 11 35 25" stroke="#b88652" stroke-width="4" stroke-linecap="round"/><g fill="#b88652"><circle cx="150" cy="269" r="4"/><circle cx="241" cy="291" r="4"/><circle cx="187" cy="300" r="4"/></g></svg><span class="diagram-label bottom-label">SOL • CULTURE • PRATIQUE</span></div><div class="hero-float">${icon('book',21)}<span><b>04</b><small>Cours pour commencer</small></span></div></div></section>
  <section class="wrap summary-row"><div class="summary-intro"><span class="eyebrow">TABLEAU DE BORD</span><h2>Ton parcours, à ton rythme.</h2></div><div class="summary-stat"><span class="summary-number">${done}<span>/${total}</span></span><span>Cours terminés</span></div><div class="summary-stat"><span class="summary-number">${pct(done,total)}<span>%</span></span><span>Progression de la démo</span></div><div class="summary-progress"><div class="progress-ring" style="--value:${pct(done,total)}"><div>${pct(done,total)}%</div></div></div></section>
  <section class="wrap units-section"><div class="section-heading"><div><span class="eyebrow">TON PROGRAMME</span><h2>Les unités capitalisables</h2><p>5 UC nationales et 2 UCARE. Commence par l’UC 03 : elle contient les cours de démonstration.</p></div><span class="section-count">7 unités</span></div><div class="unit-grid">${units.map(unitCard).join('')}</div></section>
  <section class="wrap resource-spotlight"><div class="resource-spotlight-icon">${icon('book',29)}</div><div><span class="eyebrow">BIBLIOTHÈQUE BPREA</span><h2>Ressources documentaires</h2><p>Liens utiles, sites de référence et fiches PDF réunis au même endroit.</p></div><a href="ressources.html" class="btn btn-outline">Parcourir les ressources ${icon('arrow',17)}</a></section>
  <section class="wrap next-section"><div class="next-panel"><div><span class="eyebrow">PASSER DE LA THÉORIE AU TERRAIN</span><h2>Un légume, une contrainte, un itinéraire.</h2><p>Teste le prototype ITK sur la tomate, la laitue, la carotte ou la courgette. Calendrier indicatif et opérations exportables.</p><a href="itk.html" class="btn btn-primary">Explorer le générateur ${icon('arrow',17)}</a></div><div class="next-art" aria-hidden="true"><span class="crop-circle">🍅</span><span class="crop-circle">🥬</span><span class="crop-circle">🥕</span><span class="crop-circle">🥒</span></div></div></section>`;
}
function crumbs(items) { return `<div class="crumbs"><a href="index.html">Accueil</a>${items.map((x,i)=>`<span>/</span>${x.href?`<a href="${x.href}">${clean(x.label)}</a>`:`<span>${clean(x.label)}</span>`}`).join('')}</div>`; }
function lessonsList(list) {return list.map((l,i)=>`<a href="${lessonUrl(l.id)}" class="lesson-row"><span class="lesson-number">${String(i+1).padStart(2,'0')}</span><div class="lesson-details"><strong>${clean(l.title)}</strong><span>${clean(l.summary)}</span></div><div class="lesson-right"><span>${l.minutes} min</span>${isDone(l.id)?'<span class="completed-label">✓ Terminé</span>':''}${icon('arrow',18)}</div></a>`).join('');}
function unit() {
  const u=units.find(x=>x.id===params.get('id'))||units[2];const list=lessons.filter(x=>x.unit===u.id);
  $('#app-main').innerHTML=`<section class="page-top wrap">${crumbs([{label:u.code}])}<div class="page-eyebrow">${u.code} · BPREA</div><h1>${clean(u.title)}</h1><p>${clean(u.short)}. <span class="soft-text">Démo indépendante à adapter à ta formation.</span></p></section><section class="wrap content-layout"><div class="content-panel"><div class="panel-heading"><div><span class="eyebrow">SOMMAIRE DES COURS</span><h2>${list.length?'Le sol vivant':'Contenu à construire'}</h2></div><span class="pill">${list.length} cours</span></div>${list.length?`<p class="panel-subtitle">Notions introductives sur la biologie du sol, avec exercices interactifs.</p>${lessonsList(list)}`:`<div class="empty-state"><div class="empty-icon">${icon(u.icon,32)}</div><h3>Cette unité attend tes ressources.</h3><p>La navigation est prête. Tu pourras y ajouter chapitres, cours, schémas et exercices lorsque tu auras rassemblé les supports.</p><a class="text-link" href="${unitUrl('uc3')}">Voir un exemple de cours ${icon('arrow',17)}</a></div>`}</div><aside class="aside-stack"><div class="aside-card aside-highlight"><span class="eyebrow">MON AVANCEMENT</span><div class="big-ratio">${list.filter(l=>isDone(l.id)).length}<span> / ${list.length} cours</span></div><div class="thick-track"><span style="width:${pct(list.filter(l=>isDone(l.id)).length,list.length)}%"></span></div><p>La progression est enregistrée sur cet appareil.</p></div><div class="aside-card"><span class="eyebrow">À SAVOIR</span><h3>Ce n’est pas un support officiel.</h3><p>Les intitulés nationaux correspondent au BPREA, mais les chapitres de la démo sont libres et doivent être ajustés à ta formation.</p></div></aside></section>`;
}
function course() {
  const l=lessons.find(x=>x.id===params.get('id'))||lessons[0], index=lessons.indexOf(l), next=lessons[index+1];
  $('#app-main').innerHTML=`<section class="page-top wrap">${crumbs([{label:'UC 03',href:unitUrl('uc3')},{label:l.title}])}<div class="page-eyebrow">UC 03 <span class="dot-spacer">·</span> ${clean(l.chapter)} <span class="dot-spacer">·</span> ${l.minutes} min</div><h1>${clean(l.title)}</h1><p>${clean(l.summary)}</p><div class="course-labels"><span class="pill status-ready">Cours de démonstration</span><span class="pill">${clean(l.level)}</span></div></section><section class="wrap content-layout course-layout"><article class="content-panel course-article">${l.body}<div class="finish-box"><div><span class="eyebrow">PRÊT À VÉRIFIER TES ACQUIS ?</span><h3>Passer aux exercices</h3><p>Trois questions corrigées sur ce cours, avec un résultat conservé localement.</p></div><a class="btn btn-primary" href="${quizUrl(l.id)}">Faire le QCM ${icon('arrow',17)}</a></div><div class="done-box"><label class="done-toggle"><input type="checkbox" id="mark-done" ${isDone(l.id)?'checked':''}/><span class="check-visual">${icon('check',14)}</span><span>Marquer ce cours comme terminé</span></label><span class="mini-muted" id="done-state">${isDone(l.id)?'Terminé ✓':'Pas encore terminé'}</span></div>${next?`<a class="next-lesson" href="${lessonUrl(next.id)}"><span>PROCHAIN COURS <strong>${clean(next.title)}</strong></span>${icon('arrow',19)}</a>`:''}</article><aside class="aside-stack"><div class="aside-card aside-highlight"><span class="eyebrow">L’ESSENTIEL</span><ul class="essentials">${l.essentials.map(x=>`<li>${icon('check',16)}<span>${clean(x)}</span></li>`).join('')}</ul></div><div class="aside-card"><span class="eyebrow">OUTILS DE RÉVISION</span><a class="aside-link" href="${quizUrl(l.id)}">${icon('flask',18)} Exercices de ce cours ${icon('arrow',16)}</a><a class="aside-link" href="${unitUrl('uc3')}">${icon('book',18)} Tous les cours UC 03 ${icon('arrow',16)}</a></div></aside></section>`;
  $('#mark-done').addEventListener('change',event=>{progress[l.id]={...(progress[l.id]||{}),done:event.target.checked};saveProgress();$('#done-state').textContent=event.target.checked?'Terminé ✓':'Pas encore terminé';});
}
function quizzes() {
  const l=lessons.find(x=>x.id===params.get('id'))||lessons[0];
  let answers={};let submitted=false;
  $('#app-main').innerHTML=`<section class="page-top wrap">${crumbs([{label:'UC 03',href:unitUrl('uc3')},{label:l.title,href:lessonUrl(l.id)},{label:'Exercices'}])}<div class="page-eyebrow">TEST DE CONNAISSANCES · 3 QUESTIONS</div><h1>Vérifie ce que tu as retenu.</h1><p>${clean(l.title)} — réponds aux questions, puis découvre le corrigé et les explications.</p></section><section class="wrap content-layout quiz-layout"><div class="content-panel"><div id="quiz-questions">${l.quiz.map((q,i)=>`<fieldset class="question" data-question="${i}"><legend><span>QUESTION ${String(i+1).padStart(2,'0')}</span>${clean(q.q)}</legend>${q.options.map((option,j)=>`<label class="option"><input type="radio" name="q${i}" value="${j}"/><span class="option-letter">${String.fromCharCode(65+j)}</span><span>${clean(option)}</span></label>`).join('')}<div class="explanation" id="explain-${i}" hidden></div></fieldset>`).join('')}</div><div class="quiz-controls"><button id="check-quiz" class="btn btn-primary" disabled>Corriger mes réponses ${icon('check',18)}</button><button id="retry-quiz" class="btn btn-outline" hidden>Recommencer</button></div><div id="quiz-result" aria-live="polite"></div></div><aside class="aside-stack"><div class="aside-card aside-highlight"><span class="eyebrow">CONSEIL</span><h3>Ne révise pas en pilotage automatique.</h3><p>Essaie de justifier ta réponse avant de regarder la correction. C’est plus utile que de mémoriser seulement la lettre.</p></div><div class="aside-card"><span class="eyebrow">MEILLEUR SCORE</span><div class="big-ratio">${progress[l.id]?.score===undefined?'—':progress[l.id].score}<span> / ${l.quiz.length}</span></div><p>Ton meilleur score est conservé sur ce navigateur.</p></div></aside></section>`;
  const form=$('#quiz-questions'), check=$('#check-quiz'), retry=$('#retry-quiz');
  form.addEventListener('change',e=>{if(submitted)return;let match=e.target.name?.match(/^q(\d+)$/);if(match)answers[Number(match[1])]=Number(e.target.value);check.disabled=Object.keys(answers).length!==l.quiz.length;});
  check.addEventListener('click',()=>{submitted=true;let score=0;l.quiz.forEach((q,i)=>{const ok=answers[i]===q.answer;if(ok)score++;const fs=$(`[data-question="${i}"]`);$$('.option',fs).forEach((el,j)=>{if(j===q.answer)el.classList.add('correct');if(j===answers[i]&&!ok)el.classList.add('incorrect');});let expl=$(`#explain-${i}`);expl.hidden=false;expl.innerHTML=`<strong>${ok?'Bonne réponse':'À corriger'}</strong> — ${clean(q.why)}`;});$$('input',form).forEach(x=>x.disabled=true);check.hidden=true;retry.hidden=false;const previous=progress[l.id]||{};progress[l.id]={...previous,score:Math.max(previous.score||0,score),done:score===l.quiz.length?true:previous.done||false};saveProgress();$('#quiz-result').innerHTML=`<div class="quiz-result-box">${icon('trophy',28)}<div><strong>${score} / ${l.quiz.length} bonnes réponses</strong><p>${score===l.quiz.length?'Sans faute ! Cours marqué comme terminé.':'Relis les corrections et recommence quand tu veux.'}</p></div></div>`;});
  retry.addEventListener('click',()=>{answers={};submitted=false;$$('input',form).forEach(x=>{x.checked=false;x.disabled=false;});$$('.option',form).forEach(x=>x.classList.remove('correct','incorrect'));$$('.explanation',form).forEach(x=>x.hidden=true);check.hidden=false;check.disabled=true;retry.hidden=true;$('#quiz-result').innerHTML='';});
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
  const saved=safeRead(ITK_KEY,{});const data={crop:saved.crop||'tomate',cover:saved.cover||'serre',variety:saved.variety||'Marmande',area:saved.area||'100',month:saved.month||'5',year:saved.year||'2028',soil:saved.soil||'limoneux',water:saved.water||'standard'};
  $('#app-main').innerHTML=`<section class="page-top wrap itk-top">${crumbs([{label:'Générateur ITK'}])}<div class="page-eyebrow">LABORATOIRE AGRONOMIQUE · PROTOTYPE</div><h1>Construire un itinéraire technique.</h1><p>Choisis une culture et ses contraintes pour obtenir un calendrier d’opérations. Les résultats sont des hypothèses de travail, pas une fiche technique validée.</p></section><section class="wrap itk-layout"><div class="itk-form-panel"><div class="panel-heading"><div><span class="eyebrow">PARAMÈTRES</span><h2>Ta culture</h2></div>${icon('leaf',25)}</div><form id="itk-form"><label for="crop">Espèce cultivée</label><select name="crop" id="crop">${Object.entries(crops).map(([key,c])=>`<option value="${key}" ${data.crop===key?'selected':''}>${clean(c.name)}</option>`).join('')}</select><label for="variety">Variété ou type</label><select name="variety" id="variety"></select><div class="form-columns"><div><label for="cover">Conduite</label><select name="cover" id="cover"><option value="serre" ${data.cover==='serre'?'selected':''}>Sous abri</option><option value="plein" ${data.cover==='plein'?'selected':''}>Plein champ</option></select></div><div><label for="area">Surface cultivée (m²)</label><input name="area" id="area" type="number" min="1" max="100000" step="1" required value="${clean(data.area)}"></div></div><div class="form-columns"><div><label for="month">Mois de départ</label><select name="month" id="month">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${data.month===String(i+1)?'selected':''}>${new Intl.DateTimeFormat('fr-FR',{month:'long'}).format(new Date(2027,i,1))}</option>`).join('')}</select></div><div><label for="soil">Texture dominante</label><select name="soil" id="soil"><option value="leger" ${data.soil==='leger'?'selected':''}>Légère / sableuse</option><option value="limoneux" ${data.soil==='limoneux'?'selected':''}>Intermédiaire / limoneuse</option><option value="lourd" ${data.soil==='lourd'?'selected':''}>Lourde / argileuse</option></select></div></div><label for="year">Année de culture</label><select name="year" id="year">${Array.from({length:8},(_,i)=>2026+i).map(y=>`<option value="${y}" ${data.year===String(y)?'selected':''}>${y}</option>`).join('')}</select><label for="water">Accès à l’eau</label><select name="water" id="water"><option value="standard" ${data.water==='standard'?'selected':''}>Irrigation à dimensionner</option><option value="limitee" ${data.water==='limitee'?'selected':''}>Ressource limitée / incertaine</option></select><button type="submit" class="btn btn-primary full">Générer mon itinéraire ${icon('arrow',18)}</button><p class="form-caption">Aucune donnée transmise à un serveur. Tes derniers paramètres restent dans ton navigateur.</p></form></div><div class="itk-result-panel" id="itk-output"><div class="placeholder-result"><span class="placeholder-icon">${icon('calendar',38)}</span><h2>Ton calendrier apparaîtra ici.</h2><p>Sélectionne une espèce, une variété, une surface et un mois de départ, puis génère l’itinéraire.</p><div class="placeholder-lines"><span></span><span></span><span></span></div></div></div></section>`;
  const form=$('#itk-form'),varSelect=$('#variety');let selectedCrop=data.crop;
  function updateVariety(prefer){const options=crops[selectedCrop].varieties;varSelect.innerHTML=selectOptions(options,options.includes(prefer)?prefer:options[0]);}
  updateVariety(data.variety);
  $('#crop').addEventListener('change',e=>{selectedCrop=e.target.value;updateVariety(null);});
  $('#area').addEventListener('input',e=>e.target.setCustomValidity(''));
  form.addEventListener('submit',event=>{event.preventDefault();const raw=Object.fromEntries(new FormData(form));const area=Number(raw.area);if(!Number.isFinite(area)||area<1||area>100000){$('#area').setCustomValidity('Saisis une surface entre 1 et 100 000 m².');$('#area').reportValidity();return;}$('#area').setCustomValidity('');try{localStorage.setItem(ITK_KEY,JSON.stringify(raw));}catch{};const result=$('#itk-output');result.innerHTML=itkResult(raw);result.classList.add('has-result');const crop=crops[raw.crop],date=dateForMonth(Number(raw.month),Number(raw.year));const rows=crop.tasks.map(([name,detail],i)=>[monthLabel(moveWeeks(date,crop.weeks[i])),name,detail]);$('#csv-export').addEventListener('click',()=>{const dataCSV=[['Période','Opération','Description'],...rows].map(row=>row.map(cell=>'"'+String(cell).replaceAll('"','""')+'"').join(';')).join('\r\n');const blob=new Blob(['\uFEFF'+dataCSV],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`itk-${raw.crop}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});$('#print-itk').addEventListener('click',()=>window.print());});
}
function validExternalUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol); } catch { return false; }
}
function validDocumentPath(path) {
  // Pas de chemin absolu ni de remontée hors du site ; dossier documents uniquement.
  return /^documents\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.pdf$/i.test(path);
}
function resourceCard(entry) {
  const isFile = entry.kind === 'pdf';
  if (isFile && !validDocumentPath(entry.file)) return '';
  if (!isFile && !validExternalUrl(entry.url)) return '';
  const href = isFile ? entry.file : entry.url;
  const label = isFile ? 'Télécharger le PDF' : 'Consulter le site';
  return `<article class="resource-card" data-kind="${isFile ? 'pdf' : 'link'}" data-search="${clean(normalizeSearch(`${entry.title} ${entry.description} ${entry.category} ${(entry.tags || []).join(' ')}`))}">
    <span class="resource-icon ${isFile ? 'resource-icon-pdf' : ''}">${icon(isFile ? 'file' : 'external',23)}</span>
    <div class="resource-body"><div class="resource-card-top"><span class="eyebrow">${clean(entry.category)}</span><span class="pill">${isFile ? 'PDF' : 'Site externe'}</span></div>
    <h3>${clean(entry.title)}</h3><p>${clean(entry.description)}</p>
    <div class="resource-tags">${(entry.tags || []).map(tag => `<span>${clean(tag)}</span>`).join('')}</div>
    <a class="resource-open" href="${clean(href)}" ${isFile ? `download="${clean(href.split('/').pop())}"` : 'target="_blank" rel="noopener noreferrer"'}>${label} ${icon(isFile ? 'download' : 'arrow', 17)}</a></div></article>`;
}
function resources() {
  const all = [
    ...resourceLinks.map(x=>({...x,kind:'link'})),
    ...resourceFiles.map(x=>({...x,kind:'pdf'}))
  ];
  $('#app-main').innerHTML = `<section class="page-top wrap resource-intro">${crumbs([{label:'Ressources documentaires'}])}
    <div class="page-eyebrow">BIBLIOTHÈQUE PÉDAGOGIQUE</div><h1>Ressources documentaires.</h1><p>Des sites à consulter et des documents à conserver pour réviser. Cette sélection est personnelle et évolutive.</p>
    </section><section class="wrap resource-layout"><div class="resource-toolbar">
      <label class="resource-search">${icon('search',19)}<span class="sr-only">Rechercher une ressource</span><input id="resource-search" type="search" placeholder="Rechercher par thème, titre ou mot-clé…" autocomplete="off" /></label>
      <div class="resource-filters" role="group" aria-label="Filtrer les ressources"><button type="button" class="resource-filter active" data-filter="all" aria-pressed="true">Tout voir <span>${all.length}</span></button><button type="button" class="resource-filter" data-filter="link" aria-pressed="false">Sites utiles <span>${resourceLinks.length}</span></button><button type="button" class="resource-filter" data-filter="pdf" aria-pressed="false">Documents PDF <span>${resourceFiles.length}</span></button></div>
    </div><div class="resource-overview"><span id="resource-count" role="status" aria-live="polite"></span><span class="resource-info">Une ressource manque ? Ajoute-la dans <code>assets/resources.js</code>.</span></div>
    <div class="resource-grid" id="resource-grid">${all.map(resourceCard).join('')}</div>
    <div class="resource-empty" id="resource-empty" hidden><h3>Aucune ressource trouvée.</h3><p>Essaie une autre recherche ou un filtre différent.</p></div>
    <aside class="resource-help"><div class="resource-help-icon">${icon('file',25)}</div><div><h2>Tu veux ajouter un PDF ?</h2><p>Dépose-le dans le dossier <code>documents/</code>, puis ajoute sa fiche dans <code>assets/resources.js</code>. Son téléchargement sera disponible sans connexion ni backend. Ne publie que des documents que tu as le droit de partager.</p></div></aside>
    </section>`;
  const search = $('#resource-search');
  const filters = $$('.resource-filter');
  let selected = 'all';
  function refresh() {
    const query = normalizeSearch(search.value.trim());
    let visible = 0;
    $$('.resource-card').forEach(card => {
      const show = (selected === 'all' || card.dataset.kind === selected) && card.dataset.search.includes(query);
      card.hidden = !show;
      if (show) visible += 1;
    });
    $('#resource-count').textContent = `${visible} ressource${visible > 1 ? 's' : ''} affichée${visible > 1 ? 's' : ''}`;
    $('#resource-empty').hidden = visible !== 0;
  }
  search.addEventListener('input', refresh);
  filters.forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.filter;
    filters.forEach(b => {const current = b === button; b.classList.toggle('active', current); b.setAttribute('aria-pressed', String(current));});
    refresh();
  }));
  refresh();
}
function init(){header();const page=document.body.dataset.page;({home,uc:unit,course,quiz:quizzes,itk,resources}[page]||home)();}
init();
