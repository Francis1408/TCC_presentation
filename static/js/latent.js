import { listImages } from "./manifets.js";


const WIN = 16;                 // zoom window, in sprite pixels
const YELLOW = "#f6f606";
const GREY = "#808080";
const FOLDER = "dataset_latent";

// ---------------------------------------------------------------- server
async function readContent(folder) {
  const res = await listImages(folder);
  if (!res.length) throw new Error(`No images for images/${folder} in manifest.json`);
  return res;
}


function imageUrl(entry, folder) {
  if (typeof entry === "object") return entry.url ?? entry.path;
  if (entry.startsWith("http")) return entry;
  if (entry.includes("/")) return entry;         
  return `images/${folder}/${entry}`;             
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

// ---------------------------------------------------------------- drawing
// draw part of the sprite (sx, sy, size) on a canvas, over the grey background
function drawPart(img, canvas, sx, sy, size) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = GREY;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
  return ctx;
}

function grid(ctx, n, color, width) {
  const step = ctx.canvas.width / n;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    ctx.moveTo(i * step, 0); ctx.lineTo(i * step, ctx.canvas.height);
    ctx.moveTo(0, i * step); ctx.lineTo(ctx.canvas.width, i * step);
  }
  ctx.stroke();
}

function box(ctx, x, y, w, h, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(x + width / 2, y + width / 2, w - width, h - width);
}

function mousePos(e, canvas, units) {
  const b = canvas.getBoundingClientRect();
  return [Math.floor((e.clientX - b.left) / b.width * units),
          Math.floor((e.clientY - b.top) / b.height * units)];
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------- display
function buildLatentDisplay(img, truth, rows) {
  let win = { x: 16, y: 40 };     // window origin (sprite px)
  let focus = { x: 24, y: 48 };   // hovered sprite pixel

  function render() {
    // (a) truth + YELLOW window
    const t = drawPart(img, truth, 0, 0, img.width);
    const s = truth.width / img.width;
    box(t, win.x * s, win.y * s, WIN * s, WIN * s, YELLOW, 3);

    rows.forEach(r => {
      // (b) zoom + latent grid + cell holding the hovered pixel
      const z = drawPart(img, r.zoom, win.x, win.y, WIN);
      const zs = r.zoom.width / WIN;
      grid(z, WIN / r.cell, "#fff", 2);
      const cx = Math.floor(focus.x / r.cell) * r.cell;
      const cy = Math.floor(focus.y / r.cell) * r.cell;
      box(z, (cx - win.x) * zs, (cy - win.y) * zs, r.cell * zs, r.cell * zs, YELLOW, 3);

      // (c) the pixels of that latent cell
      const c = drawPart(img, r.view, cx, cy, r.cell);
      grid(c, r.cell, "rgba(255,255,255,0.8)", 1);
    });
  }

  // hover the truth: move the window (snapped to the 8 px latent grid)
  truth.onmousemove = e => {
    const [x, y] = mousePos(e, truth, img.width);
    focus = { x: clamp(x, 0, img.width - 1), y: clamp(y, 0, img.height - 1) };
    win = {
      x: clamp(Math.round((x - WIN / 2) / 8) * 8, 0, img.width - WIN),
      y: clamp(Math.round((y - WIN / 2) / 8) * 8, 0, img.height - WIN),
    };
    render();
  };

  // hover a zoom: pick a cell inside the window
  rows.forEach(r => {
    r.zoom.onmousemove = e => {
      const [x, y] = mousePos(e, r.zoom, WIN);
      focus = { x: win.x + clamp(x, 0, WIN - 1), y: win.y + clamp(y, 0, WIN - 1) };
      render();
    };
  });

  render();
}

export async function renderLatentDisplay() {
  const truth = document.getElementById("truth");
  if (!truth) return;

  const rows = [
    { cell: 8, zoom: document.getElementById("zoom1"), view: document.getElementById("cell1") }, // 1x
    { cell: 2, zoom: document.getElementById("zoom4"), view: document.getElementById("cell4") }, // 4x
  ];
  if (rows.some(r => !r.zoom || !r.view)) return;

  try {
    const list = await readContent(FOLDER);
    if (!list.length) throw new Error(`images/${FOLDER} is empty`);
    const img = await loadImage(imageUrl(list[0], FOLDER));   // first image of the folder
    buildLatentDisplay(img, truth, rows);
  } catch (err) {
    console.error(err);
  }
}