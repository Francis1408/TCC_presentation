
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function setupFigure(fig) {
  if (fig.dataset.ready) return;
  fig.dataset.ready = 'true';

  const slide = fig.closest('section') || document;
  const svg = fig.querySelector('.ft-overlay');
  const { width: W, height: H } = svg.viewBox.baseVal;
  const steps = [...slide.querySelectorAll('.ft-step')];
  const caption = slide.querySelector('.ft-caption');
  const dotsBox = slide.querySelector('.ft-dots');

  /* ----- build: arrowhead, dim layer with spotlight mask ----- */
  const uid = Math.random().toString(36).slice(2, 8);
  const defs = svgEl('defs');
  const head = svgEl('marker', {
    id: `ft-head-${uid}`, viewBox: '0 0 10 10', refX: '9', refY: '5',
    markerWidth: '3', markerHeight: '3', orient: 'auto-start-reverse',
  });
  head.append(svgEl('path', { d: 'M0 0 L10 5 L0 10 Z', class: 'ft-arrowhead' }));

  const mask = svgEl('mask', { id: `ft-mask-${uid}`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: W, height: H });
  mask.append(svgEl('rect', { x: 0, y: 0, width: W, height: H, fill: 'white' }));
  const holes = svgEl('g');
  mask.append(holes);
  defs.append(head, mask);

  const dim = svgEl('rect', { x: 0, y: 0, width: W, height: H, class: 'ft-dim-layer', mask: `url(#ft-mask-${uid})` });
  svg.prepend(defs, dim);   // dim goes under the components and arrows

  svg.querySelectorAll('.ft-arrow:not(.no-head)').forEach((p) =>
    p.setAttribute('marker-end', `url(#ft-head-${uid})`)
  );

  /* ----- balloons: place at their point (in % so they follow the figure) ----- */
  fig.querySelectorAll('.ft-balloon').forEach((b) => {
    b.style.left = `${(Number(b.dataset.x) / W) * 100}%`;
    b.style.top = `${(Number(b.dataset.y) / H) * 100}%`;
    if (!b.dataset.side) b.dataset.side = 'top';
  });

  /* ----- progress dots ----- */
  if (dotsBox) dotsBox.replaceChildren(...steps.map(() => Object.assign(document.createElement('span'), { className: 'ft-dot' })));

  /* ----- apply the current step ----- */
  const ids = (step, key) => new Set((step?.dataset[key] || '').split(/\s+/).filter(Boolean));

  function apply() {
    const n = steps.filter((s) => s.classList.contains('visible')).length;
    const step = steps[n - 1];             // undefined before the first →
    const arrows = ids(step, 'arrows');
    const focus = ids(step, 'focus');
    const balloons = ids(step, 'balloons');

    svg.querySelectorAll('.ft-arrow').forEach((a) => a.classList.toggle('on', arrows.has(a.id)));

    const focused = [...svg.querySelectorAll('.ft-comp')].filter((c) => focus.has(c.id));
    svg.querySelectorAll('.ft-comp').forEach((c) => c.classList.toggle('on', focus.has(c.id)));
    holes.replaceChildren(...focused.map((c) => {
      const hole = c.cloneNode(false);
      hole.removeAttribute('id');
      hole.removeAttribute('class');
      hole.setAttribute('fill', 'black');
      return hole;
    }));
    dim.classList.toggle('on', focused.length > 0);

    fig.querySelectorAll('.ft-balloon').forEach((b) => b.classList.toggle('on', balloons.has(b.id)));

    if (caption) caption.textContent = step?.dataset.caption ?? '';
    dotsBox?.querySelectorAll('.ft-dot').forEach((d, i) => d.classList.toggle('done', i < n));
  }

  const observer = new MutationObserver(apply);
  steps.forEach((s) => observer.observe(s, { attributes: true, attributeFilter: ['class'] }));
  apply();

  /* ----- calibration: class="ft-figure calibrate" → click points, get a path ----- */
  if (fig.classList.contains('calibrate')) {
    let points = [];
    fig.addEventListener('click', (e) => {
      const r = fig.getBoundingClientRect();
      const x = Math.round(((e.clientX - r.left) / r.width) * W);
      const y = Math.round(((e.clientY - r.top) / r.height) * H);
      if (e.altKey) points = [];             // Alt+click starts a new path
      points.push([x, y]);
      const d = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' ');
      console.log(`point: data-x="${x}" data-y="${y}"   path: d="${d}"`);
    });
  }
}


/* ---------- RENDER CALL ---------- */
export function renderFinetune() {
  document.querySelectorAll('.ft-figure').forEach(setupFigure);
}