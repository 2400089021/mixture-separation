const NS = 'http://www.w3.org/2000/svg';
const lab = document.getElementById('lab');
const samplesEl = document.getElementById('samples');
const toolsEl = document.getElementById('tools');
const stage = document.getElementById('stage');
const feedback = document.getElementById('feedback');
const dropHint = document.getElementById('dropHint');
const separatedEl = document.getElementById('separated');
const meterFill = document.getElementById('meterFill');
const zoomBtn = document.getElementById('zoomBtn');
const zoomLens = document.getElementById('zoomLens');
const zoomSvg = document.getElementById('zoomSvg');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const speedInput = document.getElementById('speed');
const exploreTab = document.getElementById('exploreTab');
const challengeTab = document.getElementById('challengeTab');
const newChallengeBtn = document.getElementById('newChallenge');
const resetChallengeBtn = document.getElementById('resetChallenge');
const starsEl = document.getElementById('stars');

const palette = {
  water: '#56b4e9',
  sand: '#b59d5b',
  salt: '#f7f7f7',
  iron: '#545b66',
  oil: '#e69f00',
  gravel: '#8f7f6b',
  beans: '#cc79a7',
  vapor: '#9bcfe8',
  glass: '#dbe9f1'
};

const materials = {
  water: { label: 'Water', color: palette.water, shape: 'dot', size: 4 },
  sand: { label: 'Sand', color: palette.sand, shape: 'grain', size: 5 },
  salt: { label: 'Salt', color: palette.salt, shape: 'crystal', size: 4 },
  iron: { label: 'Iron', color: palette.iron, shape: 'filing', size: 5 },
  oil: { label: 'Oil', color: palette.oil, shape: 'drop', size: 6 },
  gravel: { label: 'Gravel', color: palette.gravel, shape: 'rock', size: 7 },
  beans: { label: 'Beans', color: palette.violet, shape: 'bean', size: 7 }
};

const mixtures = {
  sandWater: {
    label: 'Sand + Water',
    kind: 'heterogeneous',
    components: ['sand', 'water'],
    tools: ['filter', 'sediment'],
    counts: { sand: 48, water: 58 }
  },
  saltWater: {
    label: 'Salt + Water',
    kind: 'homogeneous',
    components: ['salt', 'water'],
    tools: ['evaporate', 'distill'],
    counts: { salt: 45, water: 70 },
    dissolved: true
  },
  ironSand: {
    label: 'Iron + Sand',
    kind: 'heterogeneous',
    components: ['iron', 'sand'],
    tools: ['magnet'],
    counts: { iron: 44, sand: 48 }
  },
  oilWater: {
    label: 'Oil + Water',
    kind: 'heterogeneous',
    components: ['oil', 'water'],
    tools: ['sediment'],
    counts: { oil: 42, water: 58 }
  },
  gravelSand: {
    label: 'Gravel + Sand',
    kind: 'heterogeneous',
    components: ['gravel', 'sand'],
    tools: ['sieve'],
    counts: { gravel: 34, sand: 56 }
  },
  beansIron: {
    label: 'Beans + Iron',
    kind: 'heterogeneous',
    components: ['beans', 'iron'],
    tools: ['magnet', 'sieve'],
    counts: { beans: 34, iron: 38 }
  }
};

const toolData = {
  filter: { label: 'Filter', short: 'Funnel', keys: ['sandWater'], fail: 'Dissolved salt passes through filter paper.' },
  evaporate: { label: 'Heat', short: 'Burner', keys: ['saltWater'], fail: 'Heating removes liquid, not solid grains.' },
  sieve: { label: 'Sieve', short: 'Mesh', keys: ['gravelSand', 'beansIron'], fail: 'Small grains pass through; magnetic bits need a magnet.' },
  magnet: { label: 'Magnet', short: 'Pull iron', keys: ['ironSand', 'beansIron'], fail: 'Only iron filings respond to a magnet.' },
  sediment: { label: 'Decant', short: 'Cylinder', keys: ['sandWater', 'oilWater'], fail: 'Decanting works when layers or settled solids form.' },
  distill: { label: 'Distill', short: 'Still', keys: ['saltWater'], fail: 'Distillation separates dissolved liquid from solute.' }
};



let mode = 'explore';
let currentMixtureKey = null;
let selectedTool = null;
let particles = [];
let separated = new Set();
let running = false;
let zoomOn = false;
let last = performance.now();
let activeEffect = null;
let challengeKey = null;
let stars = 0;
let audioCtx = null;
let hum = null;

function svg(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

function iconSample(key) {
  const m = mixtures[key];
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 64 64');
  s.setAttribute('aria-hidden', 'true');
  svg('path', { d: 'M20 10 H44 L40 56 H24 Z', fill: '#fff', stroke: '#17202a', 'stroke-width': '2' }, s);
  svg('path', { d: 'M23 28 C30 24 35 32 41 27 L39 54 H25 Z', fill: 'rgba(86,180,233,.55)' }, s);
  m.components.forEach((c, i) => {
    for (let j = 0; j < 8; j++) {
      const x = 25 + ((j * 7 + i * 5) % 16);
      const y = 32 + ((j * 5 + i * 8) % 18);
      drawTinyParticle(s, c, x, y, 1);
    }
  });
  return s;
}

function iconTool(key) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 64 64');
  s.setAttribute('aria-hidden', 'true');
  if (key === 'filter') {
    svg('path', { d: 'M13 11 H51 L38 30 V54 L27 49 V30 Z', fill: '#fff', stroke: '#17202a', 'stroke-width': '2' }, s);
    svg('path', { d: 'M19 16 H45 L36 29 H28 Z', fill: '#dbe9f1', stroke: '#0072b2', 'stroke-width': '2' }, s);
  } else if (key === 'magnet') {
    svg('path', { d: 'M17 14 V35 C17 48 47 48 47 35 V14 H38 V35 C38 40 26 40 26 35 V14 Z', fill: '#d55e00', stroke: '#17202a', 'stroke-width': '2' }, s);
    svg('path', { d: 'M17 14 H26 V22 H17 Z M38 14 H47 V22 H38 Z', fill: '#56b4e9' }, s);
  } else if (key === 'evaporate') {
    svg('path', { d: 'M21 21 H43 L39 45 H25 Z', fill: '#fff', stroke: '#17202a', 'stroke-width': '2' }, s);
    svg('path', { d: 'M24 35 H40 L38 43 H26 Z', fill: 'rgba(86,180,233,.55)' }, s);
    svg('path', { d: 'M25 54 C29 43 35 43 39 54 Z', fill: '#e69f00', stroke: '#17202a', 'stroke-width': '1.5' }, s);
  } else if (key === 'sieve') {
    svg('ellipse', { cx: '32', cy: '25', rx: '23', ry: '10', fill: '#fff', stroke: '#17202a', 'stroke-width': '2' }, s);
    for (let x = 16; x <= 48; x += 8) svg('path', { d: `M${x} 17 V33`, stroke: '#0072b2', 'stroke-width': '1.5' }, s);
    for (let y = 20; y <= 30; y += 5) svg('path', { d: `M12 ${y} H52`, stroke: '#0072b2', 'stroke-width': '1.5' }, s);
    svg('path', { d: 'M12 25 V36 C12 49 52 49 52 36 V25', fill: 'none', stroke: '#17202a', 'stroke-width': '2' }, s);
  } else if (key === 'sediment') {
    svg('path', { d: 'M24 7 H40 L37 57 H27 Z', fill: '#fff', stroke: '#17202a', 'stroke-width': '2' }, s);
    svg('path', { d: 'M27 35 H37 L36 54 H28 Z', fill: 'rgba(86,180,233,.55)' }, s);
    svg('path', { d: 'M28 47 H36 L36 54 H28 Z', fill: '#b59d5b' }, s);
  } else {
    svg('path', { d: 'M13 39 H28 V51 H13 Z M36 39 H51 V51 H36 Z', fill: '#fff', stroke: '#17202a', 'stroke-width': '2' }, s);
    svg('path', { d: 'M28 42 C28 23 36 23 36 42', fill: 'none', stroke: '#0072b2', 'stroke-width': '3' }, s);
    svg('path', { d: 'M17 35 C20 28 24 28 27 35', fill: 'none', stroke: '#d55e00', 'stroke-width': '2' }, s);
    svg('circle', { cx: '44', cy: '35', r: '3', fill: '#56b4e9' }, s);
  }
  return s;
}

function drawTinyParticle(parent, type, x, y, scale) {
  const mat = materials[type];
  if (mat.shape === 'crystal') {
    svg('rect', { x: x - 2 * scale, y: y - 2 * scale, width: 4 * scale, height: 4 * scale, fill: mat.color, stroke: '#17202a', 'stroke-width': .4 }, parent);
  } else if (mat.shape === 'filing') {
    svg('path', { d: `M${x - 3 * scale} ${y + 1 * scale} L${x + 3 * scale} ${y - 1 * scale}`, stroke: mat.color, 'stroke-width': 2 * scale, 'stroke-linecap': 'round' }, parent);
  } else if (mat.shape === 'bean') {
    svg('ellipse', { cx: x, cy: y, rx: 3.5 * scale, ry: 5 * scale, fill: mat.color, stroke: '#17202a', 'stroke-width': .4, transform: `rotate(25 ${x} ${y})` }, parent);
  } else {
    svg('circle', { cx: x, cy: y, r: mat.size * .42 * scale, fill: mat.color, stroke: mat.shape === 'dot' ? 'none' : '#17202a', 'stroke-width': .4 }, parent);
  }
}

function buildButtons() {
  for (const key of Object.keys(mixtures)) {
    const btn = document.createElement('button');
    btn.className = 'sample';
    btn.dataset.key = key;
    btn.draggable = true;
    btn.setAttribute('aria-pressed', 'false');
    btn.appendChild(iconSample(key));
    const label = document.createElement('span');
    label.innerHTML = `<strong>${mixtures[key].label}</strong><small>${mixtures[key].kind}</small>`;
    btn.appendChild(label);
    btn.addEventListener('click', () => loadMixture(key));
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        loadMixture(key);
        stage.focus();
      }
    });
    btn.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', key));
    attachPointerGhost(btn, key, 'sample');
    samplesEl.appendChild(btn);
  }

  for (const key of Object.keys(toolData)) {
    const btn = document.createElement('button');
    btn.className = 'tool';
    btn.dataset.key = key;
    btn.setAttribute('aria-pressed', 'false');
    btn.appendChild(iconTool(key));
    const label = document.createElement('span');
    label.innerHTML = `<strong>${toolData[key].label}</strong><small>${toolData[key].short}</small>`;
    btn.appendChild(label);
    btn.addEventListener('click', () => useTool(key));
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        useTool(key);
      }
    });
    attachPointerGhost(btn, key, 'tool');
    toolsEl.appendChild(btn);
  }
}

function attachPointerGhost(btn, key, type) {
  let ghost = null;
  btn.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    btn.setPointerCapture(e.pointerId);
    ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.appendChild(type === 'sample' ? iconSample(key) : iconTool(key));
    document.body.appendChild(ghost);
    moveGhost(e);
  });
  btn.addEventListener('pointermove', e => ghost && moveGhost(e));
  btn.addEventListener('pointerup', e => {
    if (!ghost) return;
    const hit = isOverStage(e.clientX, e.clientY);
    ghost.remove();
    ghost = null;
    if (hit) type === 'sample' ? loadMixture(key) : useTool(key);
  });
  btn.addEventListener('pointercancel', () => {
    if (ghost) ghost.remove();
    ghost = null;
  });
  function moveGhost(e) {
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
  }
}

function isOverStage(x, y) {
  const r = stage.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

stage.addEventListener('dragover', e => e.preventDefault());
stage.addEventListener('drop', e => {
  e.preventDefault();
  const key = e.dataTransfer.getData('text/plain');
  if (mixtures[key]) loadMixture(key);
});

function loadMixture(key) {
  if (mode === 'challenge' && key !== challengeKey) return;
  currentMixtureKey = key;
  separated = new Set();
  activeEffect = null;
  stopHum();
  makeParticles(mixtures[key]);
  updateButtons();
  drawLab();
  updateSeparated();
  setFeedback('');
  dropHint.style.display = 'none';
  meterFill.style.height = '0%';
}

function makeParticles(mix) {
  particles = [];
  const cx = 450;
  const cy = 286;
  for (const [type, count] of Object.entries(mix.counts)) {
    for (let i = 0; i < count; i++) {
      const layer = mix.label === 'Oil + Water' && type === 'oil' ? -38 : mix.label === 'Oil + Water' ? 32 : 0;
      const soluble = mix.dissolved && type === 'salt';
      particles.push({
        type,
        x: cx + (Math.random() - .5) * 210,
        y: cy + layer + (Math.random() - .5) * 118,
        vx: (Math.random() - .5) * 16,
        vy: (Math.random() - .5) * 16,
        r: materials[type].size + Math.random() * 1.4,
        hidden: soluble,
        state: 'free',
        targetX: null,
        targetY: null,
        phase: Math.random() * Math.PI * 2
      });
    }
  }
}

function drawLab() {
  lab.textContent = '';
  drawGlassware();
  for (const p of particles) {
    if (p.hidden || p.state === 'gone') continue;
    drawParticle(lab, p, 1);
  }
  drawToolEffect();
  drawZoom();
}

function drawGlassware() {
  svg('path', { d: 'M280 115 H620 L575 485 H325 Z', fill: 'rgba(255,255,255,.58)', stroke: '#17202a', 'stroke-width': '4' }, lab);
  svg('path', { d: 'M322 230 C385 205 500 252 582 222 L556 466 H344 Z', fill: 'rgba(86,180,233,.22)', stroke: 'none' }, lab);
  svg('path', { d: 'M325 485 H575', stroke: '#17202a', 'stroke-width': '5', 'stroke-linecap': 'round' }, lab);
  if (currentMixtureKey === 'saltWater') {
    svg('text', { x: '450', y: '515', 'text-anchor': 'middle', fill: '#5d6978', 'font-weight': '800', 'font-size': '18' }, lab).textContent = 'homogeneous';
  } else if (currentMixtureKey) {
    svg('text', { x: '450', y: '515', 'text-anchor': 'middle', fill: '#5d6978', 'font-weight': '800', 'font-size': '18' }, lab).textContent = 'heterogeneous';
  }
}

function drawParticle(parent, p, scale) {
  const mat = materials[p.type];
  const x = p.x;
  const y = p.y;
  const r = p.r * scale;
  if (mat.shape === 'grain' || mat.shape === 'rock') {
    const sides = mat.shape === 'rock' ? 6 : 5;
    let d = '';
    for (let i = 0; i < sides; i++) {
      const a = p.phase + i * Math.PI * 2 / sides;
      const rr = r * (.75 + .25 * ((i % 2) + .4));
      d += (i ? ' L' : 'M') + (x + Math.cos(a) * rr).toFixed(1) + ' ' + (y + Math.sin(a) * rr).toFixed(1);
    }
    svg('path', { d: d + ' Z', fill: mat.color, stroke: '#17202a', 'stroke-width': 1 * scale }, parent);
  } else if (mat.shape === 'crystal') {
    svg('rect', { x: x - r * .65, y: y - r * .65, width: r * 1.3, height: r * 1.3, fill: mat.color, stroke: '#17202a', 'stroke-width': 1 * scale, transform: `rotate(45 ${x} ${y})` }, parent);
  } else if (mat.shape === 'filing') {
    svg('path', { d: `M${x - r} ${y + r * .25} L${x + r} ${y - r * .25}`, stroke: mat.color, 'stroke-width': Math.max(2, 2.5 * scale), 'stroke-linecap': 'round' }, parent);
  } else if (mat.shape === 'drop') {
    svg('path', { d: `M${x} ${y - r} C${x + r} ${y - r * .1} ${x + r * .5} ${y + r} ${x} ${y + r} C${x - r * .5} ${y + r} ${x - r} ${y - r * .1} ${x} ${y - r} Z`, fill: mat.color, stroke: '#17202a', 'stroke-width': .8 * scale }, parent);
  } else if (mat.shape === 'bean') {
    svg('ellipse', { cx: x, cy: y, rx: r * .75, ry: r * 1.1, fill: mat.color, stroke: '#17202a', 'stroke-width': .9 * scale, transform: `rotate(${25 + p.phase * 20} ${x} ${y})` }, parent);
    svg('path', { d: `M${x - r * .2} ${y - r * .65} C${x + r * .3} ${y - r * .1} ${x - r * .3} ${y + r * .25} ${x + r * .15} ${y + r * .65}`, fill: 'none', stroke: '#7a3e69', 'stroke-width': .8 * scale }, parent);
  } else {
    svg('circle', { cx: x, cy: y, r, fill: mat.color, opacity: p.type === 'water' ? '.72' : '1' }, parent);
  }
}

function drawToolEffect() {
  if (!activeEffect) return;
  const t = activeEffect.tool;
  if (t === 'magnet') {
    svg('path', { d: 'M665 115 V235 C665 310 805 310 805 235 V115 H755 V235 C755 265 715 265 715 235 V115 Z', fill: '#d55e00', stroke: '#17202a', 'stroke-width': '4' }, lab);
    svg('path', { d: 'M665 115 H715 V160 H665 Z M755 115 H805 V160 H755 Z', fill: '#56b4e9' }, lab);
  }
  if (t === 'filter') {
    svg('path', { d: 'M345 80 H555 L500 225 V405 L418 365 V225 Z', fill: 'rgba(255,255,255,.76)', stroke: '#17202a', 'stroke-width': '4' }, lab);
    svg('path', { d: 'M375 105 H525 L486 218 H414 Z', fill: 'rgba(219,233,241,.84)', stroke: '#0072b2', 'stroke-width': '3' }, lab);
  }
  if (t === 'evaporate' || t === 'distill') {
    svg('path', { d: 'M350 510 C388 430 430 430 450 510 C482 432 525 432 555 510 Z', fill: '#e69f00', stroke: '#17202a', 'stroke-width': '3' }, lab);
    for (let i = 0; i < 7; i++) {
      const x = 360 + i * 28;
      svg('path', { d: `M${x} ${225 - (activeEffect.progress * 100 + i * 12) % 100} C${x - 18} ${205 - (activeEffect.progress * 100 + i * 12) % 100} ${x + 20} ${183 - (activeEffect.progress * 100 + i * 12) % 100} ${x} ${160 - (activeEffect.progress * 100 + i * 12) % 100}`, fill: 'none', stroke: '#9bcfe8', 'stroke-width': '4', opacity: '.7' }, lab);
    }
    if (t === 'distill') {
      svg('path', { d: 'M545 160 C655 145 705 190 705 285', fill: 'none', stroke: '#17202a', 'stroke-width': '5' }, lab);
      svg('path', { d: 'M688 285 H772 V395 H688 Z', fill: 'rgba(255,255,255,.7)', stroke: '#17202a', 'stroke-width': '4' }, lab);
      svg('circle', { cx: '730', cy: '355', r: '18', fill: 'rgba(86,180,233,.62)' }, lab);
    }
  }
  if (t === 'sieve') {
    svg('ellipse', { cx: '450', cy: '195', rx: '190', ry: '40', fill: 'rgba(255,255,255,.78)', stroke: '#17202a', 'stroke-width': '4' }, lab);
    for (let x = 285; x <= 615; x += 22) svg('path', { d: `M${x} 157 V233`, stroke: '#0072b2', 'stroke-width': '2' }, lab);
    for (let y = 170; y <= 220; y += 15) svg('path', { d: `M270 ${y} H630`, stroke: '#0072b2', 'stroke-width': '2' }, lab);
  }
  if (t === 'sediment') {
    svg('path', { d: 'M630 190 H720 L705 485 H645 Z', fill: 'rgba(255,255,255,.72)', stroke: '#17202a', 'stroke-width': '4', transform: 'rotate(-17 675 337)' }, lab);
    svg('path', { d: 'M308 240 C400 280 498 270 590 228', fill: 'none', stroke: '#56b4e9', 'stroke-width': '8', opacity: '.55' }, lab);
  }
}

function drawZoom() {
  zoomSvg.textContent = '';
  if (!zoomOn || !currentMixtureKey) return;
  const visible = particles.filter(p => p.state !== 'gone').slice(0, 42);
  visible.forEach((p, i) => {
    const copy = { ...p, x: 28 + (i % 7) * 26 + Math.sin(p.phase) * 4, y: 30 + Math.floor(i / 7) * 26 + Math.cos(p.phase) * 4, r: p.hidden ? 5 : p.r * 1.2, hidden: false };
    drawParticle(zoomSvg, copy, 1.3);
  });
  if (mixtures[currentMixtureKey].dissolved) {
    svg('text', { x: '105', y: '196', 'text-anchor': 'middle', fill: '#5d6978', 'font-size': '13', 'font-weight': '800' }, zoomSvg).textContent = 'dissolved particles';
  }
}

function useTool(key) {
  selectedTool = key;
  updateButtons();
  if (!currentMixtureKey) {
    setFeedback('Choose a sample.');
    tickSound(160);
    return;
  }
  const mix = mixtures[currentMixtureKey];
  const works = mix.tools.includes(key);
  if (!works) {
    wrongAttempt(key);
    return;
  }
  applyTool(key);
}

function wrongAttempt(key) {
  tickSound(130);
  const mix = mixtures[currentMixtureKey];
  let msg = toolData[key].fail;
  if (currentMixtureKey === 'ironSand' && key === 'sieve') msg = "Iron filings aren't sorted by mesh; try a magnet.";
  if (currentMixtureKey === 'saltWater' && key === 'filter') msg = 'Salt is dissolved; filter paper cannot catch it.';
  if (currentMixtureKey === 'oilWater' && key === 'filter') msg = 'Oil and water pass through together; let layers settle.';
  if (mode === 'challenge') msg = msg + ' Retry.';
  setFeedback(msg);
}

function applyTool(key) {
  tickSound(420);
  activeEffect = { tool: key, progress: 0 };
  running = true;
  updatePlay();
  if (key === 'evaporate' || key === 'distill') startHum();
  setFeedback(toolData[key].label);
}

function completeTool(key) {
  const mix = mixtures[currentMixtureKey];
  stopHum();
  if (key === 'magnet') {
    separateType('iron');
    markResidue('iron');
    setFeedback('Iron separated.');
  } else if (key === 'filter') {
    separateType('sand');
    markResidue('sand');
    setFeedback('Solid trapped.');
  } else if (key === 'sieve') {
    separateType(mix.components.includes('gravel') ? 'gravel' : 'beans');
    markResidue(mix.components.includes('gravel') ? 'gravel' : 'beans');
    setFeedback('Large pieces separated.');
  } else if (key === 'sediment') {
    if (currentMixtureKey === 'oilWater') {
      separateType('oil');
      markResidue('oil');
      setFeedback('Layer decanted.');
    } else {
      separateType('water');
      markResidue('water');
      setFeedback('Clear liquid poured off.');
    }
  } else if (key === 'evaporate') {
    particles.forEach(p => {
      if (p.type === 'water') p.state = 'gone';
      if (p.type === 'salt') {
        p.hidden = false;
        p.x = 350 + Math.random() * 200;
        p.y = 432 + Math.random() * 28;
      }
    });
    separated.add('water vapor');
    separated.add('salt');
    setFeedback('Salt crystals left.');
  } else if (key === 'distill') {
    particles.forEach(p => {
      if (p.type === 'water') p.state = 'gone';
      if (p.type === 'salt') {
        p.hidden = false;
        p.x = 350 + Math.random() * 200;
        p.y = 432 + Math.random() * 28;
      }
    });
    separated.add('water');
    separated.add('salt');
    setFeedback('Water collected.');
  }
  activeEffect = null;
  updateSeparated();
  meterFill.style.height = Math.min(100, separated.size * 38) + '%';
  if (mode === 'challenge') checkChallenge();
}

function markResidue(removedType) {
  mixtures[currentMixtureKey].components
    .filter(type => type !== removedType)
    .forEach(type => separated.add(type));
}

function separateType(type) {
  particles.forEach(p => {
    if (p.type === type) {
      p.targetX = 120 + Math.random() * 100;
      p.targetY = 405 + Math.random() * 60;
      p.state = 'separating';
    }
  });
  separated.add(type);
}

function checkChallenge() {
  const mix = mixtures[currentMixtureKey];
  const required = new Set(mix.components);
  if (currentMixtureKey === 'sandWater' && separated.has('water')) separated.add('sand');
  const done = [...required].every(c => separated.has(c) || (c === 'water' && separated.has('water vapor')));
  if (done) {
    stars = Math.min(3, stars + 1);
    setFeedback('Challenge complete.');
    tickSound(660);
    updateStars();
  }
}

function updateSeparated() {
  separatedEl.textContent = '';
  if (!separated.size) {
    const empty = document.createElement('span');
    empty.className = 'chip';
    empty.textContent = 'Separated: 0';
    separatedEl.appendChild(empty);
    return;
  }
  for (const type of separated) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const mini = document.createElementNS(NS, 'svg');
    mini.setAttribute('viewBox', '0 0 20 20');
    mini.setAttribute('width', '20');
    mini.setAttribute('height', '20');
    if (materials[type]) drawTinyParticle(mini, type, 10, 10, 1.4);
    else svg('circle', { cx: '10', cy: '10', r: '7', fill: palette.vapor, stroke: '#17202a', 'stroke-width': '1' }, mini);
    chip.appendChild(mini);
    chip.appendChild(document.createTextNode(materials[type]?.label || 'Water vapor'));
    separatedEl.appendChild(chip);
  }
}

function tick(now) {
  const dt = Math.min(0.04, (now - last) / 1000) * Number(speedInput.value);
  last = now;
  if (running) updateParticles(dt);
  drawLab();
  requestAnimationFrame(tick);
}

function updateParticles(dt) {
  const mix = currentMixtureKey ? mixtures[currentMixtureKey] : null;
  for (const p of particles) {
    p.phase += dt * .8;
    if (p.state === 'gone') continue;
    if (p.state === 'separating') {
      p.x += (p.targetX - p.x) * dt * 4;
      p.y += (p.targetY - p.y) * dt * 4;
      if (Math.hypot(p.targetX - p.x, p.targetY - p.y) < 4) p.state = 'gone';
      continue;
    }
    if (!activeEffect) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else {
      const t = activeEffect.tool;
      activeEffect.progress += dt * .22;
      if (t === 'magnet' && p.type === 'iron') {
        p.x += (735 - p.x) * dt * 2.7;
        p.y += (210 - p.y) * dt * 2.7;
      } else if (t === 'filter' && p.type === 'water') {
        p.y += 44 * dt;
      } else if (t === 'sieve' && p.type === 'sand') {
        p.y += 58 * dt;
      } else if (t === 'sediment') {
        if (p.type === 'sand') p.y += (444 - p.y) * dt * 1.4;
        if (p.type === 'oil') p.y += (204 - p.y) * dt * 1.2;
        if (p.type === 'water') p.y += (310 - p.y) * dt * 1.0;
      } else if ((t === 'evaporate' || t === 'distill') && p.type === 'water') {
        p.y -= 70 * dt;
        p.x += Math.sin(p.phase * 3) * 20 * dt;
      } else if ((t === 'evaporate' || t === 'distill') && p.type === 'salt') {
        p.hidden = activeEffect.progress < .42 && mix?.dissolved;
        p.y += (438 - p.y) * dt * 1.3;
      }
    }
    keepInBeaker(p);
  }
  if (activeEffect && activeEffect.progress >= 1) completeTool(activeEffect.tool);
}

function keepInBeaker(p) {
  if (p.state !== 'free') return;
  const minX = 315, maxX = 585, minY = 145, maxY = 466;
  if (p.x < minX || p.x > maxX) {
    p.vx *= -1;
    p.x = Math.max(minX, Math.min(maxX, p.x));
  }
  if (p.y < minY || p.y > maxY) {
    p.vy *= -1;
    p.y = Math.max(minY, Math.min(maxY, p.y));
  }
}

function setFeedback(text) {
  feedback.textContent = text;
}

function updateButtons() {
  document.querySelectorAll('.sample').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.key === currentMixtureKey ? 'true' : 'false');
    b.hidden = mode === 'challenge' && b.dataset.key !== challengeKey;
  });
  document.querySelectorAll('.tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.key === selectedTool ? 'true' : 'false'));
}

function updatePlay() {
  playIcon.setAttribute('d', running ? 'M15 12 H22 V36 H15 Z M27 12 H34 V36 H27 Z' : 'M17 12 L36 24 L17 36 Z');
}

playBtn.addEventListener('click', () => {
  running = !running;
  if (!running) stopHum();
  if (running && activeEffect && (activeEffect.tool === 'evaporate' || activeEffect.tool === 'distill')) startHum();
  updatePlay();
});

zoomBtn.addEventListener('click', () => {
  zoomOn = !zoomOn;
  zoomLens.classList.toggle('on', zoomOn);
  drawZoom();
});

exploreTab.addEventListener('click', () => setMode('explore'));
challengeTab.addEventListener('click', () => setMode('challenge'));
newChallengeBtn.addEventListener('click', newChallenge);
resetChallengeBtn.addEventListener('click', () => loadMixture(challengeKey));

function setMode(next) {
  mode = next;
  document.body.classList.toggle('challenge', mode === 'challenge');
  exploreTab.setAttribute('aria-selected', mode === 'explore' ? 'true' : 'false');
  challengeTab.setAttribute('aria-selected', mode === 'challenge' ? 'true' : 'false');
  if (mode === 'challenge') newChallenge();
  else {
    challengeKey = null;
    currentMixtureKey = null;
    particles = [];
    separated.clear();
    activeEffect = null;
    stopHum();
    dropHint.style.display = 'grid';
    setFeedback('');
    updateSeparated();
  }
  updateButtons();
  drawLab();
}

function newChallenge() {
  const keys = Object.keys(mixtures);
  challengeKey = keys[Math.floor(Math.random() * keys.length)];
  currentMixtureKey = null;
  particles = [];
  separated.clear();
  activeEffect = null;
  stopHum();
  dropHint.style.display = 'grid';
  setFeedback('Challenge sample ready.');
  updateButtons();
  updateSeparated();
  drawLab();
  updateStars();
}

function updateStars() {
  starsEl.textContent = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 32 32');
    s.classList.add('star');
    if (i < stars) s.classList.add('on');
    svg('path', { d: 'M16 3 L20 11 L29 12 L22.5 18.5 L24 28 L16 23.5 L8 28 L9.5 18.5 L3 12 L12 11 Z', fill: 'currentColor', stroke: '#17202a', 'stroke-width': '1.5' }, s);
    starsEl.appendChild(s);
  }
}

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function tickSound(freq) {
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    osc.type = 'triangle';
    gain.gain.setValueAtTime(.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.05, audioCtx.currentTime + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .11);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + .12);
  } catch (e) {}
}

function startHum() {
  try {
    initAudio();
    if (hum) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 95;
    gain.gain.value = .025;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    hum = { osc, gain };
  } catch (e) {}
}

function stopHum() {
  if (!hum) return;
  try {
    hum.gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .08);
    hum.osc.stop(audioCtx.currentTime + .1);
  } catch (e) {}
  hum = null;
}

window.addEventListener('keydown', e => {
  if (e.target.matches('input, button')) return;
  const toolKeys = ['filter', 'magnet', 'evaporate', 'sieve', 'sediment', 'distill'];
  const sampleKeys = Object.keys(mixtures);
  if (/^[1-6]$/.test(e.key)) {
    const idx = Number(e.key) - 1;
    if (e.shiftKey && toolKeys[idx]) useTool(toolKeys[idx]);
    else if (sampleKeys[idx] && mode === 'explore') loadMixture(sampleKeys[idx]);
  }
  if (e.key.toLowerCase() === 'z') zoomBtn.click();
  if (e.key === ' ') {
    e.preventDefault();
    playBtn.click();
  }
});

buildButtons();
updateSeparated();
updateStars();
drawLab();
requestAnimationFrame(tick);
