const files = new Map();    
let box, hideTimer, ready = false;

// ---------- loading ----------
function loadFile(path) {
  if (!files.has(path)) {
    const p = fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
        return res.text();
      })
      .then((text) => {
        try {
          return { html: highlight(JSON.stringify(JSON.parse(text), null, 2)), isJson: true };
        } catch {
          return { html: escape(text), isJson: false };   
        }
      });
    p.catch(() => files.delete(path));                    
    files.set(path, p);
  }
  return files.get(path);
}

const escape = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function highlight(json) {
  return escape(json).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (m, str, colon, lit) => {
      if (str) return colon ? `<span class="fp-key">${str}</span>${colon}` : `<span class="fp-str">${str}</span>`;
      if (lit) return `<span class="fp-lit">${m}</span>`;
      return `<span class="fp-num">${m}</span>`;
    },
  );
}

// ---------- the box ----------
function makeBox() {
  box = document.createElement('div');
  box.className = 'fp-box';
  box.innerHTML = '<div class="fp-head"><span class="fp-name"></span><span class="fp-type"></span></div><pre class="fp-body"></pre>';
  // keep it open while the mouse is over it (so long files can be scrolled)
  box.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  box.addEventListener('mouseleave', hide);
  document.body.append(box);
}


function place(target) {
  const r = target.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const gap = 12, m = 8;
  let x = r.right + gap;
  if (x + b.width > innerWidth - m) x = r.left - gap - b.width;
  x = Math.max(m, Math.min(x, innerWidth - b.width - m));
  const y = Math.max(m, Math.min(r.top + r.height / 2 - b.height / 2, innerHeight - b.height - m));
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
}

async function show(target) {
  clearTimeout(hideTimer);
  const path = target.dataset.file;
  box.querySelector('.fp-name').textContent = target.dataset.title || path.split('/').pop();
  const type = box.querySelector('.fp-type');
  const body = box.querySelector('.fp-body');
  body.textContent = 'carregando…';
  type.textContent = '';
  box.classList.add('open');
  place(target);

  try {
    const { html, isJson } = await loadFile(path);
    if (box.dataset.for !== path) return;          
    body.innerHTML = html;
    type.textContent = isJson ? 'JSON' : 'TXT';
  } catch (err) {
    body.textContent = err.message;
  }
  body.scrollTop = 0;
  place(target);                                   
}

function hide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    box.classList.remove('open');
    delete box.dataset.for;
  }, 150);                                         
}

// ---------- render call ----------
export function renderFilePeek() {
  if (ready) return;                              
  ready = true;
  makeBox();

  const fileOf = (e) => e.target.closest?.('.file[data-file]');

  document.addEventListener('mouseover', (e) => {
    const t = fileOf(e);
    if (!t) return;
    clearTimeout(hideTimer);                       
    if (box.dataset.for === t.dataset.file && box.classList.contains('open')) return;
    box.dataset.for = t.dataset.file;
    show(t);
  });
  document.addEventListener('mouseout', (e) => {
    const t = fileOf(e);
    if (t && !t.contains(e.relatedTarget)) hide();
  });


  document.addEventListener('focusin', (e) => {
    const t = fileOf(e);
    if (t) { box.dataset.for = t.dataset.file; show(t); }
  });
  document.addEventListener('focusout', (e) => { if (fileOf(e)) hide(); });


  document.addEventListener('keydown', (e) => {
    if (['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      box.classList.remove('open');
      delete box.dataset.for;
    }
  });
}