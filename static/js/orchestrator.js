import { renderCarousel, renderSingleImageShow, renderMultipleImageShow } from "./carousel.js";
import { renderIsland } from "./island.js";
import { renderLatentDisplay } from "./latent.js";
import { renderFinetune } from "./fine-tuning.js";
import { renderSnapDisplay } from "./post-processing.js";
import { renderMaskDisplay } from "./mask.js";
import { renderCharts } from "./charts.js";
import { renderVideoSpeed } from "./video.js";
import { renderFilePeek } from "./captioner.js";
import { renderCaptions } from "./captions.js";

(function () {
  'use strict';

  const files = window.SLIDES || [];
  const secretFiles = window.SECRET || [];
  const totalSlides = secretFiles.length + files.length
  let slidesToRender = files
  let isInSecret = false;

  const cache = new Map();          // path -> Promise<html string>
  const warmed = new Set();         // image URLs already requested
  let current = -1;

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const titleEl = $('slide-title');
  const currentEl = $('slide-current');
  let capsuleFills = [];            // one fill <img> per slide (filled up to the current slide)
  let secretCapsuleFills = [];


  /* ---------- Loading ---------- */
  function load(index) {
    const path = slidesToRender[index];
    if (!cache.has(path)) {
      const promise = fetch(path).then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      });
      promise.catch(() => cache.delete(path));   // a failed load can be retried
      cache.set(path, promise);                  // cached at once → no double downloads
    }
    return cache.get(path);
  }


  async function prefetch(index) {
    if (index < 0 || index >= slidesToRender.length) return;
    try {
      const html = await load(index);
      const doc = new DOMParser().parseFromString(html, 'text/html');   // inert: runs nothing, loads nothing
      doc.querySelectorAll('img[src]').forEach((el) => {
        const src = el.getAttribute('src');
        if (warmed.has(src)) return;
        warmed.add(src);
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
      });
    } catch {}
  }


  /* ---------- Rendering ---------- */
  function typesetMath(el) {
    if (window.MathJax?.typesetPromise) {
      MathJax.typesetPromise([el]).catch(console.error);
    }
  }

  async function show(index, direction = 1) {
    if (!files.length) {
      stage.innerHTML = '<div class="slide"><div class="slide-error">No slides listed in js/slides.config.js</div></div>';
      return;
    }

    index = Math.max(0, Math.min(totalSlides - 1, index));
    if (index === current) return;

    let renderIndex = index

    // Switch between slides
    if(index > files.length - 1) {
      slidesToRender = secretFiles;
      isInSecret = true;
      renderIndex = index - files.length;
    }
    else {
      slidesToRender = files;
      isInSecret = false;
    }
    
    let html;
    try {
      html = await load(renderIndex);
    } catch (err) {
      html = `<div class="slide-error">
        <strong>Could not load ${slidesToRender[renderIndex]}</strong><br>${err.message}<br><br>
        Slides are loaded with fetch(), so open the deck through a local server
        (e.g. <code>npx serve</code> or <code>python -m http.server</code>), not by double-clicking index.html.
      </div>`;
    }

    stage.dispatchEvent(new CustomEvent('slide:leave', { detail: { index: current } }));

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    let slide = wrapper.querySelector('section');
    if (!slide) {
      slide = document.createElement('section');
      slide.innerHTML = html;
    }
    slide.classList.add('slide');
    if (direction < 0) slide.classList.add('from-left');

    stage.replaceChildren(slide);
    current = index;

   
    wrapper.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script');
      [...old.attributes].forEach((a) => s.setAttribute(a.name, a.value));
      s.textContent = old.textContent;
      slide.appendChild(s);
    });

   
    if (direction < 0) slide.querySelectorAll('.fragment').forEach((f) => f.classList.add('visible'));

    updateChrome(slide);

    history.replaceState(null, '', `#${index + 1}`);
    stage.dispatchEvent(new CustomEvent('slide:enter', { detail: { index, slide } }));

    
    prefetch(renderIndex + 1);
    prefetch(renderIndex - 1);

    renderIsland();
    renderLatentDisplay();
    typesetMath(slide);
    renderSingleImageShow();
    renderMaskDisplay();
    renderMultipleImageShow();
    await renderCarousel();
    renderFinetune();
    renderVideoSpeed();
    renderCharts();
    renderSnapDisplay();
    renderFilePeek();
    renderCaptions();
  }

  function updateChrome(slide) {
    const n = current;
    if (currentEl) currentEl.textContent = n + 1;

    // capsules: filled up to (and including) the current slide, empty after it
    if(isInSecret) secretCapsuleFills.forEach((img, i) => img.classList.toggle('empty', i > n - files.length));
    else capsuleFills.forEach((img, i) => img.classList.toggle('empty', i > n));

    // the secret bar appears only on the secret slides
    document.querySelector('.secret-capsule-bar')?.classList.toggle('visible', isInSecret);
    document.querySelector('.secret-icon')?.classList.toggle('visible', isInSecret);
    document.querySelector('.normal-icon')?.classList.toggle('hidden', isInSecret);
    document.querySelector('.capsule-bar')?.classList.toggle('hidden', isInSecret);

    const t = slide.dataset.title || '';
    titleEl.textContent = t;
    document.title = t ? `${t} · Presentation` : 'Presentation';
  }


  /* ---------- Navigation ---------- */
  function next() {
    // Reveal the next hidden fragment before moving to the next slide
    const hidden = stage.querySelector('.fragment:not(.visible)');
    if (hidden) return hidden.classList.add('visible');
    show(current + 1, 1);
  }

  function prev() {
    const shown = stage.querySelectorAll('.fragment.visible');
    if (shown.length) return shown[shown.length - 1].classList.remove('visible');
    show(current - 1, -1);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  document.addEventListener('keydown', (e) => {
    // Don't hijack keys while typing in a form field on a slide
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
        e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); show(0, -1); break;
      case 'End':  e.preventDefault(); show(files.length - 1, 1); break;
      case 'f': case 'F': toggleFullscreen(); break;
    }
  });

  // Clicking inside an iframe steals keyboard focus. Clicking the header or
  document.querySelectorAll('.deck-header, .deck-footer').forEach((el) =>
    el.addEventListener('click', () => { document.activeElement?.blur(); window.focus(); })
  );

  // Back/forward buttons or manual hash edits
  window.addEventListener('hashchange', () => {
    const n = parseInt(location.hash.slice(1), 10) - 1;
    if (!isNaN(n) && n !== current) show(n, n > current ? 1 : -1);
  });

  window.deck = { next, prev, goTo: (n) => show(n - 1), get index() { return current + 1; }, total: files.length };


  /* ---------- Capsule progress bar ---------- */
  function makeCapsule(base, fillSrc, index, isSecret) {
    const div = document.createElement('div');
    div.className = 'capsule';
    div.title = `Slide ${index + 1}`;

    const outline = document.createElement('img');
    outline.src = base;
    outline.alt = '';

    const fillImg = document.createElement('img');
    fillImg.src = fillSrc;
    fillImg.alt = '';
    fillImg.classList.add('empty', 'overlay-image');

    div.append(outline, fillImg);
    div.addEventListener('click', () => show(index, index > current ? 1 : -1));
    isSecret ? secretCapsuleFills.push(fillImg) : capsuleFills.push(fillImg);
    return div;
  }

  function renderCapsules() {
    const footer = document.querySelector('.deck-footer');
    if (!footer || files.length < 1) return;

    let row = footer.querySelector('.capsule-bar');
    
    if (!row) {
      row = document.createElement('div');
      row.className = 'capsule-bar';
      footer.append(row);
    }
    row.replaceChildren();
    capsuleFills = [];

    const last = files.length - 1;
    for (let i = 0; i <= last; i++) {
      let name = 'capsule';
      if (i === 0) name = 'capsule_start';
      else if (i === last) name = 'capsule_end';
      row.append(makeCapsule(`images/${name}.png`, `images/${name}_fill.png`, i, false));
    }

    // Add secret rows
    const lastSecret = secretFiles.length - 1;
    secretCapsuleFills = [];

    if (secretFiles.length > 0) {
      let secretRow = document.createElement('div');
      secretRow.className = 'secret-capsule-bar';
      footer.append(secretRow);

      for (let i = 0; i <= lastSecret; i++) {
        let name = 'capsule';
        let fill = 'secret'
        if (i === 0) {name = 'capsule_start'; fill = 'secret_start';}
        else if (i === lastSecret) {name = 'capsule_end'; fill = 'secret_end'}
        secretRow.append(makeCapsule(`images/${name}.png`, `images/${fill}_fill.png`, files.length + i, true));
      }
    }


  }


  /* ---------- Start ---------- */
  const start = parseInt(location.hash.slice(1), 10) - 1;
  renderCapsules();
  show(isNaN(start) ? 0 : start);
  files.forEach((_, i) => load(i).catch(() => {}));   // all slide HTML up front (small files)
})();