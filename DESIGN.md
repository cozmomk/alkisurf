# alkisurf Design System

Dark nautical surf dashboard. Every design decision should feel like a precision instrument — no decorative chrome, no startup-template patterns.

---

## Color Tokens

Defined in `client/src/index.css` as CSS vars:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#060d1f` | Page background |
| `--surface` | `#0d1b35` | Card/panel backgrounds |
| `--border` | `rgba(255,255,255,0.07)` | Subtle borders |
| `--text` | `#e2eef7` | Primary text |
| `--muted` | `#5a7fa0` | Secondary/label text |

**Additional palette in use (inline, not variables):**
- `#3a5a70` — tertiary / dim labels
- `#8aacbf` — neutral value text (non-scored numbers, e.g. AVG score)
- `#8ab8d8` — section title color
- `rgba(255,255,255,0.04)` — glass panel background
- `rgba(255,255,255,0.03)` — `.card` background

---

## Score Color Scale

Defined in `client/src/utils.js` → `scoreColor()`:

| Score | Color | Label |
|---|---|---|
| ≥ 9 | `#00e887` | Glass |
| ≥ 7 | `#7dff4f` | Ripple |
| ≥ 5 | `#ffc300` | Chop |
| ≥ 3 | `#ff6b1a` | Rough |
| < 3 | `#ff2b55` | No go |

Score colors are used at 70% opacity (`${color}b3`) for filled backgrounds, full opacity for text/glows.

---

## Typography

| Role | Font | Size | Weight | Class/Notes |
|---|---|---|---|---|
| Section titles | Barlow Condensed | 12px | 700 | `.section-title` — uppercase, 0.1em tracking, green-left-border |
| Body / labels | Inter | 9–11px | 400–600 | Inline styles |
| Score display | Inter | 20–28px | 700–900 | `font-black` or `font-bold` |
| Micro labels | Inter | 8–9px | 600 | Uppercase, 0.03–0.1em tracking |

No default system fonts. Inter for all UI text, Barlow Condensed for section headers only.

---

## Spacing Scale

Uses Tailwind defaults (4px base). Common values in use:
- `gap-[3px]` — within compact grids (calendar cells)
- `gap-1` (4px), `gap-1.5` (6px), `gap-2` (8px), `gap-3` (12px), `gap-4` (16px)
- `p-2` (8px), `p-4` (16px)
- `rounded-xl` (12px) — panels
- `rounded-lg` (8px) — cards
- `4px` border-radius — small cells (calendar squares)

---

## Component Patterns

### Section header
```jsx
<span className="section-title">Section Name</span>
```
Barlow Condensed, 12px, uppercase, `#8ab8d8` color, 2px left border `rgba(0,232,135,0.35)`.

### Card / Panel
```jsx
<div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
```
Use `rgba(255,255,255,0.04)` + `rgba(255,255,255,0.08)` border for raised panels. Use `.card` class for lighter surfaces.

### Horizontal scroll strip
```jsx
<div className="forecast-strip"> {/* overflow-x:auto, flex, gap:6px, scroll-snap:x */}
  <div className="forecast-cell"> {/* flex:0 0 64px, scroll-snap-align:start */}
```
Defined in `index.css`. Calendar months use the same overflow-x pattern with wider fixed-width columns.

### Focus rings
Never remove `:focus-visible` outlines. Default: `2px solid rgba(0,232,135,0.7)`, 4px radius. Matches score-glass color.

### Scrollbar
4px, no track, `rgba(255,255,255,0.15)` thumb — defined globally.

---

## Interaction States

Every interactive region must specify:
- **Default** — base appearance
- **Hover** — subtle, never jarring (no heavy color shifts)
- **Focus-visible** — green ring (global default, override only when semantically appropriate)
- **Selected/Active** — `outline: 2px solid white` + optional `boxShadow: 0 0 8px ${color}66`
- **Today** — `outline: 2px solid rgba(255,255,255,0.65)`
- **Disabled/Future** — transparent or reduced opacity, no cursor
- **Filtered-out** — `1px dashed rgba(255,255,255,0.18)` border

---

## Accessibility

- Touch targets: 24px minimum (calendar cells), 44px preferred for interactive elements
- Color is never the only signal — filtered state uses dashed border pattern, not just color change
- `aria-label` on all icon-only buttons and color-coded cells
- Focus-visible preserved globally — never suppressed without replacement

---

## Motion / Animation

Minimal. No entrance animations on data. Existing: `wave-bg` radial gradient on page (fixed, pointer-events:none). Score glows via `text-shadow` only.

---

## What This App Is NOT

- No decorative blobs, wavy SVG dividers, or floating circles
- No 3-column feature grids or centered card mosaics
- No purple/blue gradient starter-template look
- No SaaS marketing chrome — every section is a precision data view
- No emoji used as design decoration (only as semantic sky/condition indicators)
