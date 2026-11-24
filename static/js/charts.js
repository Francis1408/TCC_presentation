const DATA_ROOT = 'data';
const DEFAULT_FILE = 'position_rank.csv';
const POSITIONS = ['front', 'back', 'left', 'right'];
const CAPTION = ['good', 'regular', 'bad'];
const POS_COLORS = { front: '#2c4553', back: '#dc7856', left: '#4f9a8f', right: '#e3c375' };
const CAPTION_COLORS = { good: '#5cb85c', regular: '#f0c040', bad: '#d9534f' };


/* ==========================================================================
   SHARED HELPERS
   ========================================================================== */

const cache = new Map();   // url → Promise<table>  (each file is loaded once)

// Any CSV with a header row → [{ column: value, ... }, ...]  (values are strings)
function loadCsv(url) {
  if (cache.has(url)) return cache.get(url);
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
      return res.text();
    })
    .then((text) => {
      const [header, ...lines] = text.trim().split(/\r?\n/);
      const cols = header.split(',').map((c) => c.trim());
      return lines
        .filter((line) => line.trim())
        .map((line) => {
          const cells = line.split(',').map((c) => c.trim());
          return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
        });
    });
  promise.catch(() => cache.delete(url));   // a failed load can be retried later
  cache.set(url, promise);
  return promise;
}

// colours of the deck, so the charts match the theme
function theme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return { text: v('--text', '#e8eaf0'), muted: v('--muted', '#8b92a5'), grid: v('--border', '#2b3040') };
}

const percentLabels = (min = 5) => ({
  color: '#fff',
  font: { weight: 'bold', size: 13 },
  formatter: (v) => (v >= min ? `${Math.round(v)}%` : ''),
});


/* ==========================================================================
   1. SINGLE GRAPHS
   ========================================================================== */

/* ---------- SteamDB: games released per year ---------- */

function steamGraph(canvas) {
  const data = [
    { year: 2006, games: 1 },    { year: 2007, games: 3 },    { year: 2008, games: 1 },
    { year: 2009, games: 8 },    { year: 2010, games: 4 },    { year: 2011, games: 12 },
    { year: 2012, games: 23 },   { year: 2013, games: 33 },   { year: 2014, games: 140 },
    { year: 2015, games: 342 },  { year: 2016, games: 424 },  { year: 2017, games: 507 },
    { year: 2018, games: 657 },  { year: 2019, games: 781 },  { year: 2020, games: 1424 },
    { year: 2021, games: 1962 }, { year: 2022, games: 2356 }, { year: 2023, games: 2634 },
    { year: 2024, games: 3390 }, { year: 2025, games: 4314 },
    { year: 2026, games: 4979, projected: true },
  ];

  const css = getComputedStyle(canvas.closest('.graph') || document.documentElement);
  const c = (n) => css.getPropertyValue(n).trim();
  const FONT = { ticks: 16, axisTitle: 30, values: 20 };

  return new Chart(canvas, {
    type: 'bar',
    plugins: [window.ChartDataLabels].filter(Boolean),
    data: {
      labels: data.map((d) => d.year),
      datasets: [{
        label: 'Games',
        data: data.map((d) => d.games),
        backgroundColor: data.map((d) => (d.projected ? 'transparent' : c('--bar'))),
        borderColor: c('--bar'),
        borderWidth: data.map((d) => (d.projected ? 1.5 : 0)),
        borderDash: [4, 4],
        borderRadius: 4,
        barPercentage: 0.5,
      }],
    },
    options: {
      maintainAspectRatio: false,
      layout: { padding: { top: 24, right: 16 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.parsed.y.toLocaleString('en-US')} games${data[ctx.dataIndex].projected ? ' (projected)' : ''}` },
        },
        datalabels: {
          anchor: 'end', align: 'end', color: c('--text'),
          font: { weight: 'bold', size: FONT.values },
          formatter: (v) => v.toLocaleString('en-US'),
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: c('--text'), font: { size: FONT.ticks } },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Games released per year', color: c('--muted'), font: { size: FONT.axisTitle } },
          grid: { color: c('--grid') },
          grace: '10%',
          ticks: { color: c('--muted'), stepSize: 1000, font: { size: FONT.ticks }, callback: (v) => (v ? v / 1000 + 'k' : 0) },
        },
      },
    },
  });
}

// canvas id → function(canvas) that draws it
const SINGLE_GRAPHS = {
  'steam-graph': steamGraph,
};


/* ==========================================================================
   2. SWITCHER CHARTS
   ========================================================================== */


// rows sorted by score (best first), keeping only the allowed categories
function ranking(table, column, allowed) {
  return table
    .map((r) => ({ item: r.item, score: Number(r.score), position: (r[column] || '').toLowerCase() }))
    .filter((r) => r.item && allowed.includes(r.position))
    .sort((a, b) => a.score - b.score);
}

function positionMix(canvas, table, options = {}) {
  const type = options.type || 'position';
  const contentList = type === 'position' ? POSITIONS : CAPTION;
  const graphColors = type === 'position' ? POS_COLORS : CAPTION_COLORS;
  const column = options.column || (type === 'position' ? 'position' : 'caption');

  const rows = ranking(table, column, contentList);
  const t = theme();
  const n = rows.length;

  // 4 bins of (almost) equal size, by rank
  const bins = [[], [], [], []];
  rows.forEach((r, i) => bins[Math.floor((i * 4) / n)].push(r.position));
  const share = (list, p) => (100 * list.filter((x) => x === p).length) / list.length;

  // overall mix → dashed lines at the cumulative boundaries
  const all = rows.map((r) => r.position);
  const cumulative = [];
  contentList.slice(0, -1).reduce((acc, p) => { acc += share(all, p); cumulative.push(acc); return acc; }, 0);

  const overallLines = {
    id: 'overallLines',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales: { y } } = chart;
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = t.text;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      for (const v of cumulative) {
        const py = y.getPixelForValue(v);
        ctx.beginPath();
        ctx.moveTo(chartArea.left, py);
        ctx.lineTo(chartArea.right, py);
        ctx.stroke();
      }
      ctx.restore();
    },
  };

  return new Chart(canvas, {
    type: 'bar',
    plugins: [window.ChartDataLabels, overallLines].filter(Boolean),
    data: {
      labels: [['Q1', '(best)'], 'Q2', 'Q3', ['Q4', '(worst)']],
      datasets: contentList.map((p) => ({
        label: p,
        data: bins.map((b) => share(b, p)),
        backgroundColor: graphColors[p],
        barPercentage: 0.8,
        categoryPercentage: 1,
      })),
    },
    options: {
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: {
          position: 'right',
          title: { display: true, text: `${type}`, color: t.text },
          labels: { color: t.text, boxWidth: 14 },
        },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y.toFixed(1)}%` } },
        datalabels: percentLabels(),
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: t.text },
          title: { display: true, text: 'image rank bin', color: t.muted },
        },
        y: {
          stacked: true,
          min: 0,
          max: 100,
          grid: { color: t.grid },
          ticks: { color: t.muted, stepSize: 20, callback: (v) => `${v}%` },
        },
      },
    },
  });
}


/* ---------- caption quality ----------
 * CSV: quality,count   (Good / Regular / Bad)
 * Each quality gets a colour and an icon drawn under its name.
 */

const QUALITY = {
  good:    { color: '#5cb85c', icon: 'images/good.png' },
  regular: { color: '#f0c040', icon: 'images/regular.png' },
  bad:     { color: '#d9534f', icon: 'images/bad.png' },
};

// loads an image; resolves to null if it can't be loaded
function loadIcon(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { console.warn(`caption-quality: could not load ${src}`); resolve(null); };
    img.src = src; 
  });
}

async function captionQuality(canvas, table) {
  const t = theme();
  const items = table
    .map((r) => ({ label: r.quality, count: Number(r.count), ...(QUALITY[(r.quality || '').toLowerCase()] ?? { color: t.muted }) }))
    .filter((r) => r.label && !Number.isNaN(r.count));
  const total = items.reduce((a, r) => a + r.count, 0);
  const FACE = 70;   // icon size in px

  const icons = await Promise.all(items.map((r) => loadIcon(r.icon)));

  // icons under the names on the x axis
  const faces = {
    id: 'qualityFaces',
    afterDraw(chart) {
      const { ctx, scales: { x } } = chart;
      items.forEach((r, i) => {
        const img = icons[i];
        if (!img) return;
        const cx = x.getPixelForTick(i), top = x.bottom + 6;
        // fit inside FACE × FACE, keeping proportions, sharp pixels
        const k = FACE / Math.max(img.naturalWidth, img.naturalHeight);
        const w = img.naturalWidth * k, h = img.naturalHeight * k;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, cx - w / 2, top + (FACE - h) / 2, w, h);
        ctx.restore();
      });
    },
  };

  return new Chart(canvas, {
    type: 'bar',
    plugins: [window.ChartDataLabels, faces].filter(Boolean),
    data: {
      labels: items.map((r) => r.label),
      datasets: [{
        data: items.map((r) => r.count),
        backgroundColor: items.map((r) => r.color),
        borderRadius: 4,
        barPercentage: 0.65,
      }],
    },
    options: {
      maintainAspectRatio: false,
      layout: { padding: { top: 28, bottom: FACE + 10 } },
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${c.parsed.y} legendas (${((100 * c.parsed.y) / total).toFixed(1)}%)` } },
        datalabels: {
          anchor: 'end', align: 'end', color: t.text,
          font: { weight: 'bold', size: 20 },
          formatter: (v) => `${v} (${Math.round((100 * v) / total)}%)`,
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: t.text, font: { size: 20, weight: 'bold' } } },
        y: {
          beginAtZero: true,
          grid: { color: t.grid },
          ticks: { color: t.muted },
          title: { display: true, text: 'nº de legendas', color: t.muted, font: { size: 20 } },
        },
      },
    },
  });
}


/* ---------- training curves: 3 runs × (LPIPS, MAE) in one page ----------*/

const TG_METRICS = [
  { key: 'LPIPS', color: '#3a78b5' },
  { key: 'MAE',   color: '#f08a24' },
];
const TG_BEST = '#e0301e';

const argmin = (v) => v.reduce((best, x, i) => (x < v[best] ? i : best), 0);

function trainingSeries(table) {
  const rows = table
    .map((r) => ({ step: Number(r.step), LPIPS: Number(r.LPIPS), MAE: Number(r.MAE) }))
    .filter((r) => Number.isFinite(r.step))
    .sort((a, b) => a.step - b.step);
  return { steps: rows.map((r) => r.step), LPIPS: rows.map((r) => r.LPIPS), MAE: rows.map((r) => r.MAE) };
}

function bestCombined(s) {
  const norm = (v) => {
    const lo = Math.min(...v), hi = Math.max(...v);
    return v.map((x) => (hi > lo ? (x - lo) / (hi - lo) : 0));
  };
  const l = norm(s.LPIPS), m = norm(s.MAE);
  return argmin(l.map((x, i) => x + m[i]));
}

// colours taken from the page itself, so it works on light and dark cards
function pageColours(el) {
  const text = getComputedStyle(el).color;
  const grid = text.replace(/^rgb\((.*)\)$/, 'rgba($1, 0.15)');
  return { text, grid };
}

// red ring on the best point + dashed "best combined" line
const trainingMarkers = {
  id: 'tgMarkers',
  afterDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea: area, scales: { x, y } } = chart;
    ctx.save();

    const cx = x.getPixelForValue(opts.combinedIndex);
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(120, 120, 120, 0.9)';
    ctx.beginPath();
    ctx.moveTo(cx, area.top);
    ctx.lineTo(cx, area.bottom);
    ctx.stroke();

    const px = x.getPixelForValue(opts.bestIndex);
    const py = y.getPixelForValue(opts.bestValue);
    ctx.setLineDash([]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = TG_BEST;
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  },
};

function trainingLine(canvas, { steps, values, metric, range, combinedIndex, showX, c }) {
  const bestIndex = argmin(values);
  return new Chart(canvas, {
    type: 'line',
    plugins: [trainingMarkers],
    data: {
      labels: steps,
      datasets: [{
        label: metric.key,
        data: values,
        borderColor: metric.color,
        backgroundColor: metric.color,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0,
      }],
    },
    options: {
      maintainAspectRatio: false,
      animation: { duration: 400 },
      layout: { padding: { top: 6, right: 8 } },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: { callbacks: { title: (items) => `step ${items[0].label}`, label: (i) => `${metric.key}: ${i.parsed.y.toFixed(4)}` } },
        tgMarkers: { bestIndex, bestValue: values[bestIndex], combinedIndex },
      },
      scales: {
        x: {
          grid: { color: (ctx) => (steps[ctx.index] % 2000 === 0 ? c.grid : 'transparent') },
          ticks: {
            display: showX,
            color: c.text,
            maxRotation: 0,
            autoSkip: false,
            callback: (_v, i) => (steps[i] % 2000 === 0 ? steps[i] : ''),   // 0, 2000, 4000, …
          },
          title: { display: showX, text: 'step', color: c.text },
        },
        y: {
          suggestedMin: range.min,      // same range for every run → nice round ticks
          suggestedMax: range.max,
          grid: { color: c.grid },
          ticks: { color: c.text, maxTicksLimit: 5 },
          title: { display: true, text: metric.key, color: c.text },
        },
      },
    },
  });
}

// whole-page chart: receives the page and a loader instead of one canvas/table
async function trainingGrid(page, load) {
  const files = (page.dataset.files || '').split(',').map((f) => f.trim()).filter(Boolean);
  const names = (page.dataset.names || '').split(',').map((n) => n.trim());
  const runs = (await Promise.all(files.map(load))).map(trainingSeries);

  const ranges = Object.fromEntries(TG_METRICS.map(({ key }) => {
    const all = runs.flatMap((r) => r[key]);
    return [key, { min: Math.min(...all), max: Math.max(...all) }];
  }));

  const grid = page.querySelector('.tg-grid');
  const c = pageColours(page);
  const charts = [];
  grid.replaceChildren();

  runs.forEach((run, r) => {
    const combinedIndex = bestCombined(run);
    TG_METRICS.forEach((metric) => {
      const values = run[metric.key];
      const best = argmin(values);

      const cell = document.createElement('div');
      cell.className = 'tg-cell';
      const title = document.createElement('p');
      title.className = 'tg-title';
      title.innerHTML =
        `<b>${names[r] || files[r]}</b> · ${metric.key}` +
        ` <span class="tg-best">melhor: step ${run.steps[best]} (${values[best].toFixed(3)})</span>`;
      const box = document.createElement('div');
      box.className = 'tg-box';
      const canvas = document.createElement('canvas');
      box.append(canvas);
      cell.append(title, box);
      grid.append(cell);

      charts.push(trainingLine(canvas, {
        steps: run.steps, values, metric, range: ranges[metric.key],
        combinedIndex, showX: r === runs.length - 1, c,
      }));
    });
  });

  return charts;
}
trainingGrid.wholePage = true;


/* ---------- registry: data-chart="…" → function ---------- */

const CHARTS = {
  'position-mix': positionMix,
  'caption-quality': captionQuality,
  'training-grid': trainingGrid,
};


/* ---------- switcher ---------- */

function setupSwitcher(root) {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';

  const pages = [...root.querySelectorAll('.chart-page')];
  const folder = root.dataset.folder;
  const fileUrl = (file) => (folder ? `${DATA_ROOT}/${folder}/${file}` : `${DATA_ROOT}/${file}`);
  const urlFor = (page) => fileUrl(page.dataset.file || DEFAULT_FILE);
  const dotsBox = root.querySelector('.cs-dots');
  const drawn = new Map();               // page → Chart instance(s)
  let index = 0;

  dotsBox?.replaceChildren(...pages.map((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'cs-dot';
    dot.setAttribute('aria-label', `Gráfico ${i + 1}`);
    dot.addEventListener('click', () => show(i));
    return dot;
  }));

  async function draw(page) {
    if (drawn.has(page)) return;
    const render = CHARTS[page.dataset.chart];
    if (!render) return console.warn(`charts: no chart "${page.dataset.chart}"`);
    drawn.set(page, null);               // mark as in progress
    try {
      if (render.wholePage) {            // several CSV files, builds its own canvases
        drawn.set(page, await render(page, (file) => loadCsv(fileUrl(file))));
      } else {
        drawn.set(page, await render(page.querySelector('canvas'), await loadCsv(urlFor(page)), page.dataset));
      }
    } catch (err) {
      console.error(err);
      (page.querySelector('.chart-box, .tg-grid') ?? page).textContent = err.message;
    }
  }

  function show(i) {
    index = (i + pages.length) % pages.length;      // wraps around
    pages.forEach((p, k) => p.classList.toggle('current', k === index));
    dotsBox?.querySelectorAll('.cs-dot').forEach((d, k) => d.classList.toggle('current', k === index));
    draw(pages[index]);
  }

  // blur after click so the deck's ← → keys keep changing slides
  root.querySelector('.cs-prev')?.addEventListener('click', (e) => { show(index - 1); e.currentTarget.blur(); });
  root.querySelector('.cs-next')?.addEventListener('click', (e) => { show(index + 1); e.currentTarget.blur(); });

  show(0);
}


/* ==========================================================================
   RENDER CALLS
   ========================================================================== */

export function renderGraphs() {
  for (const [id, draw] of Object.entries(SINGLE_GRAPHS)) {
    const canvas = document.getElementById(id);
    if (!canvas || Chart.getChart(canvas)) continue;     // not on this slide, or already drawn
    try {
      draw(canvas);
    } catch (err) {
      console.error(err);
    }
  }
}

export function renderEvalCharts() {
  document.querySelectorAll('.chart-switcher').forEach(setupSwitcher);
}

// everything at once
export function renderCharts() {
  renderGraphs();
  renderEvalCharts();
}