const FOLDER = 'dataset_snap';   
const SAMPLE = null;             

const ORANGE = '#d35f00';
const GREY = '#808080';


/* ---------- server ---------- */

import { listImages } from './manifets.js';

async function readContent(folder) {
  const res = await listImages(folder);
  if (!res.length) throw new Error(`No images found for images/${folder} (is it in manifest.json?)`);
  return res;
}

// "images/dataset_snap/637_right_raw.png" stays relative to index.html
const toUrl = (entry) => entry;

// Groups the folder's files into { '637_right': { raw, snapped, truth }, ... }
function groupSamples(entries) {
  const samples = {};
  for (const entry of entries) {
    const name = entry.split('/').pop();
    const m = name.match(/^(.+)_(raw|snapped|truth)(?:_rgba)?\.png$/i);
    if (!m) continue;
    const [, sample, kind] = m;
    (samples[sample] ??= {})[kind.toLowerCase()] = toUrl(entry);
  }
  // keep only samples that have all three images
  for (const [k, v] of Object.entries(samples)) {
    if (!(v.raw && v.snapped && v.truth)) delete samples[k];
  }
  return samples;
}


/* ---------- loading ---------- */

// Loads an image and flattens it on the grey background (RGBA → RGB)
function load(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.fillStyle = GREY;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      resolve({ img: c, w: img.width, h: img.height,
                data: ctx.getImageData(0, 0, img.width, img.height).data });
    };
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function color(im, x, y) {
  const i = (y * im.w + x) * 4;
  return [im.data[i], im.data[i + 1], im.data[i + 2]];
}

const key = (c) => c.join(',');
const css = (c) => `rgb(${c})`;


/* ---------- drawing ---------- */

function drawImage(canvas, im) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im.img, 0, 0, canvas.width, canvas.height);
  return ctx;
}

function box(ctx, x, y, w, h, stroke, width) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.strokeRect(x + width / 2, y + width / 2, w - width, h - width);
}

// Marks one pixel: thin crosshair across the image + a box around the pixel
function mark(ctx, x, y, size) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const cx = x + size / 2, cy = y + size / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, 0);               ctx.lineTo(cx, y - 4);
  ctx.moveTo(cx, y + size + 4);    ctx.lineTo(cx, H);
  ctx.moveTo(0, cy);               ctx.lineTo(x - 4, cy);
  ctx.moveTo(x + size + 4, cy);    ctx.lineTo(W, cy);
  ctx.stroke();
  box(ctx, x - 4, y - 4, size + 8, size + 8, ORANGE, 3);
}


/* ---------- one display ---------- */

function buildPalette(root, snapped) {
  const counts = new Map();
  for (let y = 0; y < snapped.h; y++)
    for (let x = 0; x < snapped.w; x++) {
      const k = key(color(snapped, x, y));
      counts.set(k, (counts.get(k) || 0) + 1);
    }

  // sorted by brightness so the cubes read as a ramp
  const brightness = (k) => k.split(',').reduce((t, v) => t + Number(v), 0);
  const palette = [...counts.keys()].sort((a, b) => brightness(a) - brightness(b));

  const box = root.querySelector('#palette');
  if (box) {
    box.replaceChildren(...palette.map((k) => {
      const d = document.createElement('div');
      d.className = 'cube';
      d.dataset.key = k;
      d.style.background = `rgb(${k})`;
      d.title = `rgb(${k}) · ${counts.get(k)} px`;
      return d;
    }));
  }
  const note = root.querySelector('#palette-note');
  if (note) note.textContent = `${palette.length} cores`;
}

async function setupSnapDisplay(root) {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';

  const el = (id) => root.querySelector(`#${id}`);
  const canvases = { raw: el('raw'), snapped: el('snapped'), truth: el('truth') };
  if (Object.values(canvases).some((c) => !c)) {
    return console.warn('snap_display: needs canvases #raw, #snapped and #truth');
  }

  let raw, snapped, truth;
  try {
    const samples = groupSamples(await readContent(FOLDER));
    const names = Object.keys(samples);
    if (!names.length) throw new Error(`No complete sample (raw + snapped + truth) in images/${FOLDER}`);
    const name = SAMPLE ?? names[Math.floor(Math.random() * names.length)];
    const files = samples[name];
    if (!files) throw new Error(`Sample "${name}" not found in images/${FOLDER}`);
    [raw, snapped, truth] = await Promise.all([load(files.raw), load(files.snapped), load(files.truth)]);
  } catch (err) {
    console.error(err);
    const note = el('raw-note');
    if (note) note.textContent = err.message;
    return;
  }

  let focus = null;                        // hovered native pixel {x, y} or null

  function render() {
    const scale = raw.w / snapped.w;       // raw px per native px (4 for the 4x model)
    const r = drawImage(canvases.raw, raw);
    const s = drawImage(canvases.snapped, snapped);
    const t = drawImage(canvases.truth, truth);

    root.querySelectorAll('.cube.on').forEach((c) => c.classList.remove('on'));
    if (!focus) return;

    // the block of the raw image that became this native pixel
    const rs = canvases.raw.width / raw.w;
    mark(r, focus.x * scale * rs, focus.y * scale * rs, scale * rs);

    // the same native pixel on the snapped and truth images
    const ns = canvases.snapped.width / snapped.w;
    const ts = canvases.truth.width / truth.w;
    mark(s, focus.x * ns, focus.y * ns, ns);
    mark(t, focus.x * ts, focus.y * ts, ts);

    // the palette colour it was snapped to
    const snapColor = color(snapped, focus.x, focus.y);
    root.querySelector(`.cube[data-key="${key(snapColor)}"]`)?.classList.add('on');

    // swatches: mean raw colour of the block, snapped colour, truth colour
    const block = [0, 0, 0];
    for (let y = 0; y < scale; y++)
      for (let x = 0; x < scale; x++) {
        const c = color(raw, focus.x * scale + x, focus.y * scale + y);
        for (let k = 0; k < 3; k++) block[k] += c[k] / (scale * scale);
      }
    const set = (role, c) => { const sw = el(role); if (sw) sw.style.background = css(c); };
    set('sw-raw', block.map(Math.round));
    set('sw-snapped', snapColor);
    set('sw-truth', color(truth, focus.x, focus.y));
  }

  function hover(canvas, units) {
    canvas.addEventListener('mousemove', (e) => {
      const b = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - b.left) / b.width) * units);
      const y = Math.floor(((e.clientY - b.top) / b.height) * units);
      focus = {
        x: Math.min(Math.floor((x * snapped.w) / units), snapped.w - 1),
        y: Math.min(Math.floor((y * snapped.h) / units), snapped.h - 1),
      };
      render();
    });
    canvas.addEventListener('mouseleave', () => { focus = null; render(); });
  }

  const rawNote = el('raw-note');
  if (rawNote) rawNote.textContent = `${raw.w}×${raw.h} px`;
  buildPalette(root, snapped);
  hover(canvases.raw, raw.w);
  hover(canvases.snapped, snapped.w);
  hover(canvases.truth, truth.w);
  render();
}


/* ---------- RENDER CALL ---------- */
export async function renderSnapDisplay() {
  await Promise.all([...document.querySelectorAll('.snap-display')].map(setupSnapDisplay));
}