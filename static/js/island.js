/* ---------- ISLAND ----------*/

const files = window.SLIDES || [];
const pageNum = files.findIndex(slide => slide.includes('data-handler'));

function setupIsland(island) {
  if (island.dataset.ready) return;         
  island.dataset.ready = 'true';

  const slide = island.closest('section') || document;
  const backdrop = slide.querySelector('.pw-backdrop');
  if (!backdrop) return console.warn('island.js: no .pw-backdrop found');

  let current = null;     

  backdrop.querySelectorAll('.pw-window').forEach((win, index) => {
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-modal', 'true');
      
    const close = document.createElement('button');
    close.className = 'pw-btn pw-close';
    close.setAttribute('aria-label', 'Fechar');
    close.textContent = '✕';
    close.addEventListener('click', closeWindow);
    win.append(close);

    const numeration = document.createElement('p');
    numeration.textContent = `${pageNum + 1}.${index + 1}`;
    numeration.className = 'pw-number text-extra-large';
    win.append(numeration);
  });

  /* ----- open / close ----- */
  function openWindow(id, opener) {
    const win = backdrop.querySelector(`#${CSS.escape(id)}`);
    if (!win) return console.warn(`island.js: no window with id="${id}"`);

    backdrop.hidden = false;
    backdrop.classList.remove('closing');
    win.classList.remove('closing');
    win.classList.add('open');

    current = { win, pages: win.querySelectorAll('.pw-page'), index: 0, opener };
    goTo(0, true);
    win.querySelector('.pw-close').focus({ preventScroll: true });
  }

  function closeWindow() {
    if (!current) return;
    const { win, opener } = current;
    current = null;

    win.classList.add('closing');
    backdrop.classList.add('closing');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      win.classList.remove('open', 'closing');
      backdrop.classList.remove('closing');
      backdrop.hidden = true;
      opener?.focus({ preventScroll: true });
    };
    win.addEventListener('animationend', (e) => { if (e.target === win) finish(); });
    setTimeout(finish, 400);   // safety net if the animation event doesn't fire
  }

  function goTo(index, first = false) {
    const { win, pages } = current;
    if (!pages.length) return;
    index = Math.max(0, Math.min(pages.length - 1, index));
    const back = index < current.index;
    current.index = index;

    pages.forEach((p, i) => {
      p.classList.toggle('current', i === index);
      p.classList.toggle('from-left', i === index && back && !first);
    });
    win.querySelectorAll('.pw-dot').forEach((d, i) => d.classList.toggle('current', i === index));
    const [prev, next] = win.querySelectorAll('[data-step]');
    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === pages.length - 1;
  }

  /* ----- events ----- */
  island.querySelectorAll('.island-button').forEach((btn) =>
    btn.addEventListener('click', () => openWindow(btn.dataset.window, btn))
  );

  // Click outside the window closes it
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeWindow(); });

  // Capture phase on window = runs BEFORE the deck's arrow-key handler,
  // so arrows change window pages instead of slides while a window is open.
  function onKey(e) {
    if (!document.contains(island)) {            // slide left: clean up
      window.removeEventListener('keydown', onKey, true);
      return;
    }
    if (!current) return;                        // no window open: deck handles keys

    const keys = {
      ArrowRight: () => goTo(current.index + 1),
      ArrowDown:  () => goTo(current.index + 1),
      ArrowLeft:  () => goTo(current.index - 1),
      ArrowUp:    () => goTo(current.index - 1),
      Escape:     closeWindow,
    };
    if (keys[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      keys[e.key]();
    } else if ([' ', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) {
      e.stopPropagation();                       // block other deck keys too
    }
  }
  window.addEventListener('keydown', onKey, true);

  // Calibration: <div class="island calibrate"> → click the map to get --x/--y
  if (island.classList.contains('calibrate')) {
    island.addEventListener('click', (e) => {
      if (e.target.closest('.island-button')) return;
      const r = island.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width * 100).toFixed(1);
      const y = ((e.clientY - r.top) / r.height * 100).toFixed(1);
      console.log(`style="--x: ${x}%; --y: ${y}%"`);
    });
  }
}


/* ---------- RENDER CALL ---------- */
export function renderIsland() {
  document.querySelectorAll('.island').forEach(setupIsland);
}