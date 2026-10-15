/** Contenus de démonstration : à adapter à la progression et aux supports du centre. */
export const units = [
  { id: 'uc1', code: 'UC 01', title: 'Se situer en tant que professionnel', short: 'Pratiques agricoles, environnement et territoire', icon: 'compass', tone: 'sky' },
  { id: 'uc2', code: 'UC 02', title: 'Piloter le système de production', short: 'Choix techniques, organisation et stratégie', icon: 'chart', tone: 'sand' },
  { id: 'uc3', code: 'UC 03', title: 'Conduire le processus de production', short: 'Sol vivant, agronomie et agroécosystème', icon: 'leaf', tone: 'green' },
  { id: 'uc4', code: 'UC 04', title: 'Assurer la gestion de l’entreprise', short: 'Gestion technique, économique et administrative', icon: 'calculator', tone: 'violet' },
  { id: 'uc5', code: 'UC 05', title: 'Valoriser les produits ou services', short: 'Commercialisation, circuits et valeur ajoutée', icon: 'store', tone: 'rose' },
  { id: 'ucare1', code: 'UCARE 01', title: 'Adaptation régionale à l’emploi', short: 'À personnaliser selon ton parcours', icon: 'puzzle', tone: 'sand' },
  { id: 'ucare2', code: 'UCARE 02', title: 'Adaptation régionale à l’emploi', short: 'À personnaliser selon ton parcours', icon: 'puzzle', tone: 'sky' },
];

export const lessons = [
  {
    id: 'matiere-organique', unit: 'uc3', chapter: 'Le sol vivant', order: 1,
    title: 'Le cycle de la matière organique', minutes: 8, level: 'Fondamentaux',
    summary: 'Comprendre ce que deviennent les résidus végétaux, le rôle des décomposeurs et la formation de l’humus.',
    essentials: ['La matière organique fraîche peut être décomposée, minéralisée et partiellement stabilisée.', 'Les microorganismes sont des acteurs majeurs des transformations.', 'K1 estime la part humifiée d’un apport ; K2 la part du stock humique minéralisée annuellement.'],
    body: `
      <h2>1. D’où vient la matière organique ?</h2>
      <p>Elle provient notamment des racines, des résidus de culture, des couverts végétaux, des organismes morts et des amendements organiques. Elle nourrit les organismes du sol et contribue à ses propriétés physiques, chimiques et biologiques.</p>
      <div class="soil-flow" aria-label="Schéma simplifié du cycle organique">
        <div class="flow-node">Résidus végétaux<br><small>et apports organiques</small></div>
        <div class="flow-arrow">↓</div>
        <div class="flow-node flow-accent">Décomposition par les organismes du sol</div>
        <div class="flow-split"><div>Minéralisation<br><small>CO₂ et nutriments minéraux</small></div><div>Transformation et stabilisation<br><small>matière organique du sol</small></div></div>
      </div>
      <h2>2. Deux processus à distinguer</h2>
      <p><strong>La minéralisation</strong> libère des éléments sous forme minérale, dont une partie devient utilisable par les plantes. <strong>L’humification</strong> désigne historiquement les transformations aboutissant à des composés organiques plus stables. Aujourd’hui, on insiste aussi sur la stabilisation par les minéraux et les agrégats du sol.</p>
      <h2>3. Les coefficients K1 et K2</h2>
      <table><thead><tr><th>Coefficient</th><th>Signification</th><th>Unité usuelle</th></tr></thead><tbody><tr><td><strong>K1</strong></td><td>Part d’un apport organique contribuant au stock humique, selon le modèle utilisé</td><td>Sans unité (fraction)</td></tr><tr><td><strong>K2</strong></td><td>Fraction du stock humique minéralisée pendant une année</td><td>an⁻¹ ou %/an</td></tr></tbody></table>
      <div class="note"><strong>À retenir :</strong> K1 et K2 servent à des bilans simplifiés. Ils varient selon la matière apportée, le sol, le climat et le modèle utilisé : ce ne sont pas des constantes universelles.</div>
      <h2>4. Application en maraîchage</h2>
      <p>Après la récolte, restituer des résidus sains et implanter des couverts peut soutenir l’activité biologique. Mais la décomposition dépend de la température, de l’humidité, de l’aération et de la qualité des matières.</p>
    `,
    quiz: [
      {q:'Que décrit le coefficient K2 ?', options:['La proportion d’un apport immédiatement assimilable','La fraction du stock humique minéralisée annuellement','La densité de vers de terre'], answer:1, why:'K2 correspond à une fraction annuelle du stock humique minéralisé dans les modèles de bilan.'},
      {q:'Quel processus libère des nutriments sous forme minérale ?',options:['La minéralisation','Le tassement','La battance'],answer:0,why:'La minéralisation transforme de la matière organique en composés minéraux.'},
      {q:'Pourquoi K1 ne peut-il pas être unique pour tous les apports ?',options:['La lune modifie K1','Les apports ont des compositions et comportements différents','K1 ne concerne que le sable'],answer:1,why:'La nature de la matière organique et les conditions de transformation influencent son devenir.'},
    ],
  },
  {
    id: 'rapport-cn', unit: 'uc3', chapter: 'Le sol vivant', order: 2,
    title: 'Le rapport carbone / azote (C/N)', minutes: 6, level: 'Fondamentaux',
    summary: 'Interpréter le rapport C/N des matières organiques sans le confondre avec un diagnostic complet du sol.',
    essentials:['Le rapport C/N compare des quantités de carbone et d’azote.','Un matériau très carboné peut provoquer une immobilisation temporaire de l’azote minéral.','Le C/N seul ne suffit pas : lignine, cellulose, finesse et conditions du sol comptent aussi.'],
    body: `
      <h2>1. Une relation, pas une note de qualité</h2>
      <p>Le rapport C/N exprime la quantité de carbone rapportée à la quantité d’azote dans une matière organique. Il renseigne sur l’équilibre des ressources disponibles pour les décomposeurs.</p>
      <div class="formula">C/N = masse de carbone ÷ masse d’azote</div>
      <h2>2. Interprétation simplifiée</h2>
      <table><thead><tr><th>Matière organique</th><th>C/N indicatif</th><th>Effet possible</th></tr></thead><tbody><tr><td>Résidus jeunes, verts</td><td>Plutôt faible</td><td>Décomposition relativement rapide</td></tr><tr><td>Résidus plus fibreux</td><td>Intermédiaire</td><td>Comportement variable</td></tr><tr><td>Paille très carbonée</td><td>Élevé</td><td>Immobilisation temporaire possible de l’azote</td></tr></tbody></table>
      <p>Les seuils exacts ne sont pas fixes. Les microorganismes ont besoin d’azote pour utiliser du carbone : si l’apport en contient peu, ils peuvent prélever temporairement l’azote minéral du sol.</p>
      <h2>3. Cas pratique</h2>
      <p>Un apport abondant de paille fraîche juste avant une culture exigeante peut rendre l’azote moins disponible pendant une période. On anticipe donc la date d’incorporation et les autres apports.</p>
      <div class="note"><strong>Piège d’examen :</strong> un C/N élevé ne signifie pas automatiquement « mauvais » ; il décrit une caractéristique du matériau, pas son intérêt agronomique global.</div>
    `,
    quiz:[
      {q:'Un rapport C/N de 40 signifie…',options:['40 unités de carbone pour 1 unité d’azote','40 % de matière organique','40 kg d’azote disponibles'],answer:0,why:'Le rapport exprime une proportion massique de carbone et d’azote.'},
      {q:'Une paille très carbonée incorporée peut entraîner…',options:['Une augmentation immédiate de tous les éléments','Une immobilisation temporaire de l’azote','Une suppression de toute activité microbienne'],answer:1,why:'Les microorganismes peuvent prélever de l’azote minéral pour dégrader un matériau très carboné.'},
      {q:'Le C/N suffit-il à prédire la vitesse de décomposition ?',options:['Oui, toujours','Non, la composition et le milieu comptent aussi','Oui, uniquement en serre'],answer:1,why:'Température, humidité, lignine, taille des particules et autres facteurs interviennent.'}
    ],
  },
  {
    id: 'pedofaune', unit:'uc3', chapter:'Le sol vivant', order:3,
    title:'La pédofaune et les vers de terre', minutes:7, level:'Compréhension',
    summary:'Identifier les rôles des organismes animaux du sol et comprendre pourquoi les vers de terre sont dits « ingénieurs ».',
    essentials:['La pédofaune fragmente et transforme les matières organiques.','Les vers de terre contribuent à la porosité et à l’organisation du sol.','La biodiversité du sol ne se résume pas au comptage des vers.'],
    body:`
      <h2>1. Qu’appelle-t-on pédofaune ?</h2>
      <p>La pédofaune regroupe les animaux vivant dans le sol ou à sa surface. Leur taille et leurs fonctions varient : protozoaires selon certains classements, nématodes, collemboles, acariens, insectes et vers de terre.</p>
      <div class="feature-grid"><div class="feature"><strong>Microfaune</strong><span>Organismes microscopiques, interactions dans les réseaux alimentaires</span></div><div class="feature"><strong>Mésofaune</strong><span>Acariens, collemboles : fragmentation et régulation</span></div><div class="feature"><strong>Macrofaune</strong><span>Vers de terre, larves, arthropodes : galeries et brassage</span></div></div>
      <h2>2. Les vers de terre : ingénieurs de l’écosystème</h2>
      <p>En creusant des galeries, en ingérant de la terre et des résidus, ils modifient physiquement leur milieu : circulation de l’eau et de l’air, agrégation, répartition des matières.</p>
      <table><thead><tr><th>Groupe écologique</th><th>Comportement général</th></tr></thead><tbody><tr><td>Épigés</td><td>Vivent surtout dans la litière et les débris organiques de surface</td></tr><tr><td>Endogés</td><td>Circulent dans les horizons minéraux, avec des galeries souvent horizontales</td></tr><tr><td>Anéciques</td><td>Creusent des galeries plutôt verticales et prélèvent des résidus en surface</td></tr></tbody></table>
      <h2>3. Ce qui favorise leur activité</h2>
      <p>Une alimentation organique régulière, un sol non asphyxié, une humidité suffisante et la limitation des perturbations profondes peuvent favoriser les communautés. Attention : leur abondance dépend aussi de la saison et des conditions de mesure.</p>
      <div class="note"><strong>Observation de terrain :</strong> le nombre de turricules ou de galeries donne des indices, pas une mesure exhaustive de la santé du sol.</div>
    `,
    quiz:[
      {q:'Pourquoi dit-on que les vers de terre sont des « ingénieurs de l’écosystème » ?',options:['Ils construisent des serres','Ils modifient physiquement le milieu par leurs galeries et leurs activités','Ils produisent directement de l’engrais chimique'],answer:1,why:'Leur activité transforme la structure et les flux d’eau, d’air et de matière.'},
      {q:'Quel groupe vit plutôt dans la litière de surface ?',options:['Les épigés','Les anéciques','Les endogés'],answer:0,why:'Les épigés sont surtout associés à la litière et aux débris de surface.'},
      {q:'Un comptage de vers un jour sec et froid permet-il de conclure définitivement ?',options:['Oui','Non, la période et l’humidité influencent les observations','Oui si la parcelle est bio'],answer:1,why:'Les observations biologiques sont sensibles au contexte de mesure.'},
    ],
  },
  {
    id:'pedoflore',unit:'uc3',chapter:'Le sol vivant',order:4,
    title:'Pédoflore et indicateurs biologiques',minutes:9,level:'Approfondissement',
    summary:'Comprendre le rôle des bactéries et champignons et choisir de bons indicateurs d’activité biologique.',
    essentials:['Bactéries et champignons assurent des transformations essentielles.','Biomasse, respiration et activités enzymatiques sont des indicateurs complémentaires.','Aucun indicateur isolé ne caractérise tout le fonctionnement biologique du sol.'],
    body:`
      <h2>1. Les microorganismes du sol</h2>
      <p>La <strong>pédoflore</strong> est un terme historique souvent utilisé pour désigner notamment bactéries, champignons et algues du sol. En biologie actuelle, les bactéries et les champignons ne sont pas regroupés dans un même règne végétal, d’où l’intérêt de parler plus précisément de <strong>communautés microbiennes</strong>.</p>
      <div class="feature-grid"><div class="feature"><strong>Bactéries</strong><span>Transformations du carbone et de l’azote, interactions racinaires</span></div><div class="feature"><strong>Champignons</strong><span>Dégradation de composés complexes, réseaux de filaments, mycorhizes selon les espèces</span></div><div class="feature"><strong>Autres microorganismes</strong><span>Archées, protistes, microalgues : diversité de fonctions</span></div></div>
      <h2>2. Indicateurs utiles</h2>
      <table><thead><tr><th>Indicateur</th><th>Ce qu’il renseigne</th><th>Limite</th></tr></thead><tbody><tr><td>Biomasse microbienne</td><td>Quantité de microorganismes vivants estimée</td><td>Ne dit pas à elle seule quelles fonctions sont réalisées</td></tr><tr><td>Respiration du sol</td><td>Production de CO₂, liée à des activités biologiques et racinaires</td><td>Fortement dépendante des conditions de mesure</td></tr><tr><td>Activités enzymatiques</td><td>Potentiels de transformations biochimiques ciblées</td><td>Dépend du protocole et de l’enzyme mesurée</td></tr><tr><td>Abondance des vers</td><td>Une composante de la macrofaune</td><td>Résultat influencé par saison et méthode</td></tr></tbody></table>
      <h2>3. Interpréter correctement</h2>
      <p>On interprète les mesures à partir de plusieurs indicateurs, du type de sol, de l’usage agricole et de l’évolution dans le temps. L’objectif n’est pas d’obtenir « le plus grand chiffre » pour tout, mais de comprendre un fonctionnement.</p>
      <div class="note"><strong>Approche BPREA :</strong> comparer plusieurs observations à des conditions de prélèvement semblables est souvent plus utile qu’un chiffre isolé.</div>
    `,
    quiz:[
      {q:'La biomasse microbienne mesure principalement…',options:['La quantité estimée de microorganismes','La réserve facilement utilisable','Le pH exact du sol'],answer:0,why:'Il s’agit d’un indicateur de quantité de microorganismes, pas d’un diagnostic complet.'},
      {q:'Pourquoi interpréter la respiration avec prudence ?',options:['Parce qu’elle ne change jamais','Parce qu’elle dépend aussi de l’humidité, de la température et des racines','Parce qu’elle mesure directement le rendement'],answer:1,why:'Le CO₂ mesuré varie selon de nombreux facteurs, indépendamment d’une « qualité » simple.'},
      {q:'Le meilleur diagnostic biologique repose sur…',options:['Un seul indicateur','Une combinaison d’indicateurs et le contexte du sol','Uniquement la couleur de la terre'],answer:1,why:'L’activité et la diversité biologiques ne se résument pas à une seule mesure.'},
    ],
  },
];

export const crops = {
  tomate: {name:'Tomate', family:'Solanacées', type:'plant', baseDensity:2.3, densityRange:'2 à 3 plants/m² sous abri ; à adapter au système', weeks:[-7,-2,0,2,5,9,15], tasks:[
    ['Semis de plants','Préparer les plants en pépinière protégée ; vérifier la température de germination.'],
    ['Préparation du sol','Vérifier structure, amendements et disponibilité en eau ; éviter le travail en sol trop humide.'],
    ['Plantation','Mettre en place seulement si le risque de froid est maîtrisé. Arroser à la plantation.'],
    ['Palissage et surveillance','Installer ou ajuster le tuteurage et suivre l’état sanitaire.'],
    ['Suivi nutrition et irrigation','Observer la croissance ; ajuster les apports aux observations et analyses.'],
    ['Début de récolte indicatif','Observer la maturité, commencer les passages de récolte.'],
    ['Récoltes successives','Poursuivre récoltes et tri ; date de fin variable selon climat et conduite.']
  ], window:{serre:[3,4,5],plein:[5,6]}, varieties:['Marmande','Roma','Cœur de bœuf','Autre / non précisée'],warning:'Le groupe variétal (précoce/tardif, déterminé/indéterminé) change fortement le palissage et la durée du cycle.'},
  laitue:{name:'Laitue',family:'Astéracées',type:'plant',baseDensity:9,densityRange:'8 à 12 plants/m² selon calibre et saison', weeks:[-4,-1,0,2,5,8],tasks:[
    ['Semis en mottes','Planifier une pépinière courte, vérifier températures et qualité de germination.'],
    ['Préparer la planche','Lit de plantation fin, sol ressuyé et irrigation prête.'],
    ['Plantation','Planter sans enterrer le collet et arroser pour assurer la reprise.'],
    ['Surveillance','Suivre humidité, limaces et maladies foliaires selon la météo.'],
    ['Contrôle maturité','Observer volume, qualité et homogénéité avant récolte.'],
    ['Récolte indicative','Récolter au stade commercial souhaité ; cycle variable selon saison.']
  ],window:{serre:[2,3,4,9,10,11],plein:[3,4,5,9,10]},varieties:['Batavia','Feuille de chêne','Laitue pommée','Autre / non précisée'],warning:'La sensibilité à la montaison et les résistances aux maladies dépendent de la variété et de la saison.'},
  carotte:{name:'Carotte',family:'Apiacées',type:'direct',baseDensity:90,densityRange:'70 à 120 plants/m² en ordre de grandeur, à ajuster au calibre',weeks:[-2,0,2,5,10,15],tasks:[
    ['Préparation fine','Éviter les mottes et les obstacles ; viser une levée homogène.'],
    ['Semis direct','Semer en lignes, à profondeur adaptée au sol ; maintenir l’humidité de surface.'],
    ['Contrôle de levée','Observer levée et croûte de battance ; intervenir sans dégrader les plantules.'],
    ['Désherbage et éclaircissage','Désherber précocement et ajuster la densité si nécessaire.'],
    ['Contrôle du calibre','Évaluer croissance, état sanitaire et humidité du sol.'],
    ['Récolte indicative','Récolter selon calibre, débouché et état du sol.']
  ],window:{serre:[2,3,4,8,9],plein:[3,4,5,6,7]},varieties:['Nantaise','Touchon','Carotte de conservation','Autre / non précisée'],warning:'La catégorie précoce ou de conservation modifie la durée prévisionnelle et les choix de récolte.'},
  courgette:{name:'Courgette',family:'Cucurbitacées',type:'plant',baseDensity:1,densityRange:'0,8 à 1,2 plant/m² selon port et conduite',weeks:[-4,-1,0,2,6,11],tasks:[
    ['Semis de plants','Démarrer en godets sans anticiper excessivement la plantation.'],
    ['Préparer la planche','Vérifier fertilité, accès à l’eau et espace de développement.'],
    ['Plantation','Planter après maîtrise du risque de gel, avec arrosage de reprise.'],
    ['Observation sanitaire','Surveiller ravageurs, croissance et pollinisation.'],
    ['Début de récolte indicatif','Passages fréquents selon calibre commercial recherché.'],
    ['Récoltes régulières','Récolter régulièrement et surveiller qualité et état du feuillage.']
  ],window:{serre:[4,5],plein:[5,6]},varieties:['Black Beauty','Ronde de Nice','Courgette verte (type)','Autre / non précisée'],warning:'Le port de la plante et la forme du fruit conditionnent les écarts de plantation et la fréquence de récolte.'}
};
