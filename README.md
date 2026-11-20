# HTML Slide Presentation

## Run it

Slides are loaded with `fetch()`, so the deck must be served over HTTP
(double-clicking `index.html` won't work). From this folder run one of:

```bash
python -m http.server 8000      # then open http://localhost:8000
npx serve .                     # or VS Code "Live Server"
```

## Structure

```
presentation/
├── index.html              Base template: header, stage, footer (counter + progress bar)
├── css/
│   └── base.css            Theme tokens, deck layout, utility classes
├── js/
│   ├── slides.config.js    Ordered list of slide files
│   └── orchestrator.js     Loads + renders slides, keyboard nav, progress
└── slides/
    ├── 01-title.html
    ├── 02-agenda.html      fragments (step-by-step reveal)
    ├── 03-two-columns.html grid / card layout
    ├── 04-embed.html       renders another web page (iframe)
    ├── 05-interactive.html slide with its own <script>
    └── 06-end.html
```

## Adding a slide

1. Create `slides/07-something.html`:
   ```html
   <section data-title="Something" class="column">
     <h2 class="heading">Something</h2>
     <p class="text">Content…</p>
   </section>
   ```
2. Add `'slides/07-something.html'` to `js/slides.config.js`.

`data-title` is shown in the header. Classes on `<section>` set the slide layout.

## Controls

| Key | Action |
|---|---|
| → ↓ Space PageDown | Next (reveals fragments first) |
| ← ↑ PageUp | Previous |
| Home / End | First / last slide |
| F | Fullscreen |
| Click progress bar | Jump to slide |

The URL hash keeps your position (`index.html#4`), so refreshing stays on the same slide.

## CSS classes

| Layout | Alignment | Typography | Components |
|---|---|---|---|
| `column` `line` | `center` `middle` | `title` `subtitle` | `card` |
| `grid-2/3/4` | `start` `end` | `heading` `text` | `embed` (iframe) |
| `split-1-2` `split-2-1` | `between` `around` | `small` `muted` `accent` | `btn` `btn ghost` |
| `fill` `grow` | `text-left/center/right` | `big-number` `bullets` | `fragment` |

Change colors and fonts in the `:root` block at the top of `base.css`.

## Notes on embedding web pages

- Many big sites refuse to be shown in an iframe (X-Frame-Options). Your own
  app running locally, CodePen/StackBlitz embeds, YouTube `/embed/` URLs, etc. work.
- Clicking inside an iframe moves keyboard focus into it. Click the header or
  footer to give the arrows back to the deck.
- Slide scripts can listen for `slide:enter` / `slide:leave` on `#stage` and
  use `window.deck.next()`, `deck.prev()`, `deck.goTo(n)`.
