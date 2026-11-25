import { listImages } from "./manifets.js";

const CAROUSELS = {
  'dataset-carousel': { folder: 'dataset_examples', count: 30, seconds: 2 },
};

const SINGLE_IMAGE_SHOWS = {
  'background-pair': { ids: ['background-before', 'background-after'], folder: 'dataset_background', count: null, seconds: 3 },
};

const MULTIPLE_IMAGE_SHOWS = {
  'upscale-pair': { ids: ['upscale-1x', 'upscale-4x'], folder: 'dataset_upscale', seconds: 3 },
  'sprite-sheet': { ids: ['full_sheet', 'full_sheet_front', 'full_sheet_back', 'full_sheet_left', 'full_sheet_right'], folder: 'dataset_sheet', seconds: 3 },
  'configuration-sheet': { ids: ['sheet', 'inpaint', 'lineart', 'lineart-hint'], folder: 'dataset_configurations', seconds: 3 },
  'result-sheet': { 
    ids: [
          'truth-rgba-truth', 
          'snapped-rgba-1x-inpainting', 
          'snapped-rgba-1x-lineart-nohint', 
          'snapped-rgba-1x-lineart-hint',
          'snapped-rgba-4x-inpainting',
          'snapped-rgba-4x-lineart-nohint',
          'snapped-rgba-4x-lineart-hint'
        ], 
    folder: 'dataset_results', seconds: 5 },

  'background-removal': { ids: ['snapped', 'snapped-rgba'], folder: 'dataset_bg_removal', seconds: 3 },
  'sprite-seed': { ids: ['palette-snapped', 'palette-snapped-300', 'palette-snapped-1000', 'truth_rgba'],
                   folder: 'dataset_seed', seconds: 3, metrics: 'data/seed' },
};

/* ---------- SHARED HELPERS ---------- */

async function readContent(folder) {
  const res = await listImages(folder);
  if (!res.length) throw new Error(`No images for images/${folder} in manifest.json`);
  return res;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// random = true: shuffle BEFORE cutting to count, so count picks random images
async function loadImageList(folder, count, random = true) {
  let urls = await readContent(folder);
  if (random) urls = shuffle(urls);
  if (count) urls = urls.slice(0, count);
  return urls;
}

// Runs render(element, config) for every configured element on the current slide
async function renderAll(configs, render) {
  for (const [id, config] of Object.entries(configs)) {
    const element = document.getElementById(id);
    if (!element || element.dataset.ready) continue;
    element.dataset.ready = 'true';
    try {
      await render(element, config);
    } catch (err) {
      console.error(err);
    }
  }
}


/* ---------- CAROUSEL ---------- */

function buildGroup(urls) {
  const group = document.createElement('div');
  group.className = 'group';
  for (const url of urls) {
    const img = document.createElement('img');
    img.className = 'carousel-item';
    img.src = url;
    img.alt = '';
    img.decoding = 'async';
    group.append(img);
  }
  return group;
}

async function buildCarousel(element, { folder, count, seconds }) {
  const urls = await loadImageList(folder, count);
  if (!urls.length) return;

  // Two identical groups side by side = seamless loop
  const group = buildGroup(urls);
  const copy = group.cloneNode(true);
  copy.setAttribute('aria-hidden', 'true');
  element.replaceChildren(group, copy);

  element.style.setProperty('--carousel-duration', `${urls.length * seconds}s`);
}

export function renderCarousel() {
  return renderAll(CAROUSELS, buildCarousel);
}


/* ---------- SINGLE IMAGE SHOW ----------
 * Each div holds ONE <img>. The next image is loaded off-screen first,
 * then the visible one fades out, swaps, and fades back in.
 */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// elements = one or more divs that always show the same image
async function buildSingleImageShow(elements, { folder, count, seconds, fade = 250 }) {
  let urls = await loadImageList(folder, count);
  if (!urls.length) return;

  const imgs = elements.map((element) => {
    element.classList.add('image-show');            // styles apply even if you forgot the class
    element.style.setProperty('--show-fade', `${fade}ms`);
    const img = document.createElement('img');
    img.alt = '';
    img.src = urls[0];
    element.replaceChildren(img);
    return img;
  });
  if (urls.length < 2) return;

  // Hovering any of the divs pauses all of them
  let paused = false;
  for (const element of elements) {
    element.addEventListener('mouseenter', () => { paused = true; });
    element.addEventListener('mouseleave', () => { paused = false; });
  }

  let index = 0;
  let busy = false;

  async function next() {
    if (paused || busy) return;
    busy = true;

    index++;
    if (index >= urls.length) {           // went through all: reshuffle
      index = 0;
      const last = urls[urls.length - 1];
      urls = shuffle(urls);
      if (urls[0] === last) urls.push(urls.shift());   // avoid showing it twice in a row
    }
    const url = urls[index];

    // 1. load the next image off-screen (not added to the page)
    const preload = new Image();
    preload.src = url;
    try { await preload.decode(); } catch { /* broken image: show anyway */ }

    // 2. fade out, 3. swap, 4. fade in  (all divs together)
    imgs.forEach((img) => img.classList.add('hide'));
    await wait(fade);
    imgs.forEach((img) => { img.src = url; img.classList.remove('hide'); });

    busy = false;
  }

  const timer = setInterval(() => {
    // The slide was left (divs removed): stop the timer
    if (!elements.some((el) => document.contains(el))) return clearInterval(timer);
    next();
  }, seconds * 1000);
}

export async function renderSingleImageShow() {
  for (const [name, config] of Object.entries(SINGLE_IMAGE_SHOWS)) {
    const ids = config.ids ?? [name];
    const elements = ids.map((id) => document.getElementById(id));
    // only when ALL of this show's divs are on the slide (ids can be shared between shows)
    if (elements.some((el) => !el || el.dataset.ready)) continue;
    elements.forEach((el) => { el.dataset.ready = 'true'; });

    try {
      await buildSingleImageShow(elements, config);
    } catch (err) {
      console.error(err);
    }
  }
}


/* ---------- MULTIPLE IMAGE SHOW ----------
 * Each div holds ONE DIFFERENT <img>. The next image is loaded off-screen first,
 * then the visible one fades out, swaps, and fades back in.
 */

const metricsCache = new Map();   

function loadMetrics(url) {
  if (!metricsCache.has(url)) {
    metricsCache.set(url, fetch(url)
      .then((res) => (res.ok ? res.text() : null))
      .then((text) => {
        if (!text) return null;                       // no CSV for this id
        const [header, ...lines] = text.trim().split(/\r?\n/);
        const cols = header.split(',').map((c) => c.trim());
        const at = (name) => cols.indexOf(name);
        const table = {};
        for (const line of lines) {
          const cells = line.split(',');
          const num = (cells[at('item')] || '').match(/\d+/)?.[0];
          if (!num) continue;
          table[num] = { lpips: Number(cells[at('LPIPS')]), mae: Number(cells[at('MAE')]) / 255 };
        }
        return table;
      })
      .catch(() => null));
  }
  return metricsCache.get(url);
}

function groupUrls(urls) {
  const groups = {};
  for (const url of urls) {
    const filename = url.split('/').pop().split('?')[0];
    const match = filename.match(/^(\d+)-(.+)\.png$/i);
    if (!match) continue;
    const [, groupNum, key] = match;
    (groups[groupNum] ??= { num: groupNum })[key] = url;   // num: to find the metrics
  }
  return groups;
}

// file key of a div: data-key="snapped" → 263-snapped.png and snapped.csv (default: its id)
const keyOf = (element) => element.dataset.key ?? element.id;

async function buildMultipleImageShow(elements, { seconds, fade = 250 }, groups, metrics = {}) {

  let order = shuffle(Object.values(groups));

  // "LPIPS 0.196 · MAE 0.073" for the group on screen (keeps its space when empty)
  function setLabel(label, table, group) {
    if (!label) return;
    const m = table?.[group.num];
    label.textContent = m ? `LPIPS ${m.lpips.toFixed(3)} · MAE ${m.mae.toFixed(3)}` : '';
  }

  const imgs = elements.map((element) => {
    element.classList.add('image-show');
    element.style.setProperty('--show-fade', `${fade}ms`);
    const img = document.createElement('img');
    img.alt = '';
    img.src = order[0][keyOf(element)];
    element.replaceChildren(img);

    // the <p class="show-metrics"> next to this div (same parent), if any
    const label = element.parentElement?.querySelector('.show-metrics') ?? null;
    const table = metrics[element.id];
    setLabel(label, table, order[0]);
    return { element, img, label, table };
  });
  if (order.length < 2) return;

  let paused = false;
  for (const element of elements) {
    element.addEventListener('mouseenter', () => { paused = true; });
    element.addEventListener('mouseleave', () => { paused = false; });
  }

  let index = 0;
  let busy = false;

  async function next() {
    if (paused || busy) return;
    busy = true;

    index++;
    if (index >= order.length) {
      const previous = order[order.length - 1];
      order = shuffle(Object.values(groups));
      if (order[0] === previous) order.push(order.shift());
      index = 0;
    }

    const group = order[index];

    await Promise.all(
      imgs.map(({ element }) => {
        const url = group[keyOf(element)];
        if (!url) return;
        const preload = new Image();
        preload.src = url;
        return preload.decode().catch(() => {});
      })
    );

    imgs.forEach(({ img, label }) => { img.classList.add('hide'); label?.classList.add('hide'); });
    await wait(fade);
    imgs.forEach(({ element, img, label, table }) => {
      const url = group[keyOf(element)];
      if (url) img.src = url;
      setLabel(label, table, group);        // values change together with the image
      img.classList.remove('hide');
      label?.classList.remove('hide');
    });

    busy = false;
  }

  const timer = setInterval(() => {
    if (!elements.some((el) => document.contains(el))) return clearInterval(timer);
    next();
  }, seconds * 1000);
}

export async function renderMultipleImageShow() {
  for (const [name, config] of Object.entries(MULTIPLE_IMAGE_SHOWS)) {
    const ids = config.ids ?? [name];
    const elements = ids.map((id) => document.getElementById(id));
    // only when ALL of this show's divs are on the slide
    if (elements.some((el) => !el || el.dataset.ready)) continue;
    elements.forEach((el) => { el.dataset.ready = 'true'; });

    try {
      const urls = await loadImageList(config.folder, null, false);
      const groups = groupUrls(urls);
      if (!Object.keys(groups).length) continue;

      // one CSV per div, named after its key (missing ones are skipped)
      const metrics = {};
      if (config.metrics) {
        await Promise.all(elements.map(async (el) => {
                    metrics[el.id] = await loadMetrics(`${config.metrics}/${el.dataset.csv ?? keyOf(el)}.csv`);
        }));
      }

      await buildMultipleImageShow(elements, config, groups, metrics);
    } catch (err) {
      console.error(err);
    }
  }
}