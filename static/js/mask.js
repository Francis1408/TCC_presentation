import { listImages } from "./manifets.js";

const FOLDER = 'dataset_masks';  // folder inside static/images
const SAMPLE = null;             // null = random complete sample; or e.g. '064_front'

const COLORS = {
  both:    '#bdbdbd',
  missing: '#d55e00',   // only in truth
  extra:   '#0072b2',   // only in output
  output:  '#0072b2',   // outline of the output mask
  truth:   '#d55e00',   // outline of the truth mask
};


/* ---------- loading ---------- */

async function readContent(folder) {
  const res = await listImages(folder);
  if (!res.length) throw new Error(`No images for images/${folder} in manifest.json`);
  return res;
}

const toUrl = (entry) => entry;

// { '064_front': { snapped: url, truth: url }, ... }  (only complete samples)
function groupSamples(entries) {
  const samples = {};
  for (const entry of entries) {
    const m = entry.split('/').pop().match(/^(.+)_(snapped|truth)_rgba\.png$/i);
    if (m) (samples[m[1]] ??= {})[m[2].toLowerCase()] = toUrl(entry);
  }
  for (const [k, v] of Object.entries(samples)) if (!(v.snapped && v.truth)) delete samples[k];
  return samples;
}

function load(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ctx = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height })
        .getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve({ w: img.width, h: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data });
    };
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}


/* ---------- masks ---------- */

function computeMasks(snapped, truth) {
  const { w, h } = snapped;
  const n = w * h;
  const out = new Uint8Array(n), tru = new Uint8Array(n);
  const counts = { both: 0, missing: 0, extra: 0, output: 0, truth: 0 };
  let x0 = w, y0 = h, x1 = -1, y1 = -1;

  for (let i = 0; i < n; i++) {
    out[i] = snapped.data[i * 4 + 3] > 0 ? 1 : 0;
    tru[i] = truth.data[i * 4 + 3] > 0 ? 1 : 0;
    counts.output += out[i];
    counts.truth += tru[i];
    if (out[i] && tru[i]) counts.both++;
    else if (tru[i]) counts.missing++;
    else if (out[i]) counts.extra++;

    if (out[i] || tru[i]) {
      const x = i % w, y = (i / w) | 0;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return { w, h, out, tru, counts, crop: x1 >= 0 ? { x0, y0, x1, y1 } : null };
}

// which pixels each highlight mode selects
const SELECT = {
  output:  (m, i) => m.out[i],
  truth:   (m, i) => m.tru[i],
  both:    (m, i) => m.out[i] && m.tru[i],
  missing: (m, i) => m.tru[i] && !m.out[i],
  extra:   (m, i) => m.out[i] && !m.tru[i],
};


/* ---------- drawing ---------- */

// paints pixel by pixel: colorAt(i) returns a CSS colour or null (keep background)
function paint(canvas, m, background, colorAt) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width / m.w;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (let i = 0; i < m.w * m.h; i++) {
    const c = colorAt(i);
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect((i % m.w) * s, ((i / m.w) | 0) * s, Math.ceil(s), Math.ceil(s));
  }
  return ctx;
}

const rgbAt = (im, i) => `rgb(${im.data[i * 4]},${im.data[i * 4 + 1]},${im.data[i * 4 + 2]})`;

// outline of a pixel set: a line on every edge between selected / not selected
function outline(ctx, m, selected, color) {
  const s = ctx.canvas.width / m.w;
  const sel = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && selected(y * m.w + x);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'square';
  ctx.beginPath();
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      if (!sel(x, y)) continue;
      const px = x * s, py = y * s;
      if (!sel(x, y - 1)) { ctx.moveTo(px, py);     ctx.lineTo(px + s, py); }
      if (!sel(x, y + 1)) { ctx.moveTo(px, py + s); ctx.lineTo(px + s, py + s); }
      if (!sel(x - 1, y)) { ctx.moveTo(px, py);     ctx.lineTo(px, py + s); }
      if (!sel(x + 1, y)) { ctx.moveTo(px + s, py); ctx.lineTo(px + s, py + s); }
    }
  ctx.stroke();
}

function drawCrop(ctx, m) {
  if (!m.crop) return;
  const s = ctx.canvas.width / m.w;
  const { x0, y0, x1, y1 } = m.crop;
  ctx.setLineDash([s * 1.2, s * 0.8]);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect((x0 - 1) * s, (y0 - 1) * s, (x1 - x0 + 3) * s, (y1 - y0 + 3) * s);
  ctx.setLineDash([]);
}


/* ---------- one display ---------- */

async function setupMaskDisplay(root) {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';

  const el = (id) => root.querySelector(`#${id}`);
  const cv = { snapped: el('mask-snapped'), truth: el('mask-truth'), compare: el('mask-compare') };
  if (Object.values(cv).some((c) => !c)) return console.warn('mask_display: missing a canvas');
  const note = el('mask-compare-note');

  let snapped, truth;
  try {
    const samples = groupSamples(await readContent(FOLDER));
    const names = Object.keys(samples);
    if (!names.length) throw new Error(`No complete sample (snapped_rgba + truth_rgba) in images/${FOLDER}`);
    const name = SAMPLE ?? names[Math.floor(Math.random() * names.length)];
    if (!samples[name]) throw new Error(`Sample "${name}" not found in images/${FOLDER}`);
    [snapped, truth] = await Promise.all([load(samples[name].snapped), load(samples[name].truth)]);
  } catch (err) {
    console.error(err);
    if (note) note.textContent = err.message;
    return;
  }

  const m = computeMasks(snapped, truth);
  const NOTES = {
    output:  `output mask · ${m.counts.output} px`,
    truth:   `truth mask · ${m.counts.truth} px`,
    both:    `character in both · ${m.counts.both} px`,
    missing: `missing · ${m.counts.missing} px`,
    extra:   `extra · ${m.counts.extra} px`,
  };
  
  paint(cv.snapped, m, null, (i) => (m.out[i] ? rgbAt(snapped, i) : null));
  paint(cv.truth, m, null, (i) => (m.tru[i] ? rgbAt(truth, i) : null));

  function show(mode) {
    const ctx = paint(cv.compare, m, '#ffffff', (i) =>
      m.out[i] && m.tru[i] ? COLORS.both : m.tru[i] ? COLORS.missing : m.out[i] ? COLORS.extra : null);

    if (SELECT[mode]) {
      // fade everything outside the selection, then outline it
      const s = cv.compare.width / m.w;
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      for (let i = 0; i < m.w * m.h; i++) {
        if (!SELECT[mode](m, i)) ctx.fillRect((i % m.w) * s, ((i / m.w) | 0) * s, Math.ceil(s), Math.ceil(s));
      }
      outline(ctx, m, (i) => SELECT[mode](m, i), COLORS[mode]);
    } else {
      drawCrop(ctx, m);                     // no highlight, or the "crop" legend item
    }

    root.dataset.highlight = mode ?? '';
  }

  // hover: images → whole mask · legend items → one category
  const bind = (target, mode) => {
    target.addEventListener('mouseenter', () => show(mode));
    target.addEventListener('mouseleave', () => show(null));
  };
  bind(cv.snapped, 'output');
  bind(cv.truth, 'truth');
  root.querySelectorAll('[data-cat]').forEach((item) => bind(item, item.dataset.cat));

  show(null);
}


/* ---------- RENDER CALL ---------- */
export async function renderMaskDisplay() {
  await Promise.all([...document.querySelectorAll('.mask-display')].map(setupMaskDisplay));
}