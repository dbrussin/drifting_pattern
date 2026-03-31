# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

Open `dz-pattern.html` directly in any modern web browser — no build step or install required. Works via `file://` protocol; no server needed.

## Architecture

The application is split across multiple files:

```
dz-pattern.html      — slim HTML shell (~485 lines); has ~250 inline style attrs (known debt)
css/app.css          — all styles; uses CSS custom properties for theming
js/config.js         — physical constants, API config, LEG_DEFS, EXTRA_LEG_COLORS
js/state.js          — global `state` object, PERSIST_INPUTS list, STORAGE_VERSION
js/storage.js        — localStorage persistence, wind cache, loadSettings()/saveSettings()
js/geometry.js       — spherical math, wind interpolation, TAS factor (ISA model)
js/wind.js           — fetchElevation(), fetchWinds(), processWindData(), buildWindTable()
js/calculate.js      — integratedDrift(), avgWindInBand(), calculate()
js/draw.js           — drawPattern() and all Leaflet polyline/marker helpers
js/ui.js             — heading bar, leg config, canopy inputs, jump run controls, toggleLayer()
js/search.js         — DZ search, Nominatim geocoding, goToMyLocation()
js/app.js            — map init, placeTarget(), waiver, init sequence
```

### Script Load Order

Scripts are loaded in this order at the bottom of `<body>` — order matters:

1. Leaflet CDN
2. `js/config.js`
3. `js/state.js`
4. `js/storage.js`
5. `js/geometry.js`
6. `js/wind.js`
7. `js/calculate.js`
8. `js/draw.js`
9. `js/ui.js` — calls `renderLegs()` at module load time (before app.js)
10. `js/search.js` — IIFE fetches USPA DZ list on load
11. `js/app.js` — runs `initStorage()`, `loadSettings()`, attaches event listeners

### Global Scope

All functions are in `window` scope (classic `<script>` tags, no ES modules). ES modules are intentionally avoided — they are blocked by CORS on `file://` URLs. Cross-file calls (e.g. `calculate()` → `drawPattern()`, `wind.js` → `calculate()`) are safe because they occur inside function bodies at runtime, after all scripts have loaded.

### State Management

A single `state` object (in `js/state.js`) holds all application state:

| Field | Type | Persisted | Description |
|-------|------|-----------|-------------|
| `hand` | `'left'\|'right'` | Yes | Pattern hand (left/right traffic) |
| `target` | `{lat, lng}\|null` | No | Landing target coordinates |
| `fieldElevFt` | `number` | Cached | Field elevation (ft MSL) |
| `finalHeadingDeg` | `number\|null` | Yes | Final approach heading (0-359) |
| `manualHeading` | `boolean` | Yes | Whether heading was manually set |
| `jumpRunHdgDeg` | `number\|null` | Yes | Jump run heading override |
| `manualJumpRun` | `boolean` | Yes | Whether jump run heading was manually set |
| `manualJrOffset` | `boolean` | Yes | Whether jump run offset was manually set |
| `winds` | `Array<{altFt, dirTrue, speedKt, tempC}>` | Cached | Wind data at altitude levels |
| `surfaceWind` | `{dir, speed}\|null` | No | Surface wind (lowest level) |
| `pattern` | `object\|null` | No | Computed pattern result (from `calculate()`) |
| `forecastOffset` | `number` | No | Hours offset for forecast slider (0-12) |
| `layers` | `object` | Yes | Map layer visibility flags |
| `driftThresh` | `number` | Yes | Degrees — show steered heading when crab/drift exceeds this |
| `legModes` | `object` | Yes | Per-leg `'crab'\|'drift'` keyed by leg key |
| `zPattern` | `boolean` | Yes | Z-pattern toggle |
| `legCustomPerf` | `object` | Yes | Per-leg custom canopy performance enabled |
| `extraLegs` | `Array<{id, defaultAlt, color}>` | Yes | Dynamically added legs above downwind |
| `legHdgOverride` | `object` | Yes | Per-leg heading overrides (null = auto) |

Settings are persisted to `localStorage` with prefix `pp_` and a version key (`pp_v`) to handle breaking changes. Wind and elevation data are cached with a 20-minute TTL using key format `pp_wc_{lat.toFixed(2)},{lng.toFixed(2)}`.

### Data Flow

1. User places a landing target on the Leaflet map
2. `fetchElevation()` retrieves field elevation from Open-Meteo
3. `fetchWinds()` pulls GFS wind data for 14 altitude levels (1,000–14,000 ft AGL)
4. `processWindData()` interpolates wind vectors for pattern altitudes
5. `calculate()` computes wind-adjusted headings, turn points, and distances for each pattern leg
6. Results are drawn as Leaflet polylines (downwind=orange, base=cyan, final=yellow)

### External Dependencies (all CDN/API, no install needed)

- **Leaflet.js 1.9.4** — interactive map rendering
- **Open-Meteo API** — GFS wind/temperature data and elevation
- **Nominatim (OpenStreetMap)** — drop zone name search
- **USPA GeoJSON** (GitHub raw) — pre-loaded drop zone locations
- **Map tiles** — Google Satellite, OpenStreetMap, ArcGIS World Imagery

### Key Function Groups

| Area | File | Functions |
|------|------|-----------|
| Wind fetching & processing | `wind.js` | `fetchWinds()`, `processWindData()`, `interpolateWind()`, `buildWindTable()` |
| Pattern calculation | `calculate.js` | `calculate()`, `integratedDrift()`, `avgWindInBand()` |
| Canopy performance | `ui.js` | Per-leg glide ratio / airspeed / sink rate (any 2 compute the 3rd) |
| Map drawing | `draw.js` | Leaflet polylines for pattern legs, exit circle, jump run overlay |
| UI / overlays | `ui.js` | `toggleOverlay()`, `onHeadingSlider()`, `toggleSearch()` |
| Orchestration | `app.js` | `placeTarget()`, map init, waiver, init sequence |
| Persistence | `storage.js` | All settings read/written via `localStorage`; wind cache has 20-min TTL |

## CSS Architecture

- All styles in `css/app.css`, organized by component with `/* ── SECTION ── */` comments
- 12 CSS custom properties at `:root` for theming (dark theme default)
- **Known debt**: ~250 inline style declarations remain in `dz-pattern.html` (waiver modal, forecast controls, heading bar, help overlay). These should be extracted to named CSS classes.
- Button variants: `.zoom-btn`, `.map-icon-btn`, `.fetch-btn`, `.add-leg-btn`, `.leg-remove-btn`, `.leg-mode-btn` — share font-family/border-radius/cursor/transition but not yet consolidated to a base class
- No `@media` breakpoints — uses CSS `min()` for responsive overlay widths

## Common Modification Recipes

### Adding a new persisted setting
1. Add the HTML `<input>` with a unique `id` to `dz-pattern.html`
2. Add the `id` to `PERSIST_INPUTS` in `js/state.js`
3. Read it in `calculate()` or wherever needed via `document.getElementById(id).value`
4. `saveSettings()` / `loadSettings()` handle it automatically via the PERSIST_INPUTS loop

### Adding a new map layer toggle
1. Add a `<div class="layer-toggle">` row in the Layers section of `dz-pattern.html`
2. Add the layer key to `state.layers` in `js/state.js`
3. In `draw.js`, wrap the relevant drawing code in `if (state.layers.yourKey)`
4. Wire the toggle button's `onclick` to `toggleLayer('yourKey')`

### Adding a new pattern leg type
1. Add an entry to `LEG_DEFS` in `js/config.js` (key, label, color, altitude config)
2. The UI leg card is auto-generated by `renderLegs()` in `ui.js`
3. Add calculation logic in `calculate.js` — follow the existing base/downwind pattern
4. Add drawing logic in `draw.js` — add polyline with the leg's color

### Changing an API endpoint
1. Update the URL in the relevant fetch function (`wind.js` for Open-Meteo, `search.js` for Nominatim)
2. If response format changes, update the parsing in `processWindData()` or search handler
3. Clear wind cache if schema changed: `localStorage` keys prefixed `pp_wc_`

## Known Technical Debt

- **Inline styles**: ~250 declarations in HTML should move to `css/app.css`
- **ui.js is large** (~920 lines): Could split into ui-overlays, ui-legs, ui-canopy, ui-heading
- **Duplicated canopy calc**: `updateCanopyCalc()` and `updateLegCanopyCalc()` share logic
- **Magic numbers**: Constants like `6076` (ft/nm), `101.269` (ft/min per kt), `200` (drift step ft) should move to `config.js`
- **Silent error handling**: Many `try/catch` blocks silently swallow errors
- **No input validation**: Numeric inputs rely on HTML `min`/`max` only; no JS clamping
- **renderLegs() rebuilds all DOM**: Should add/remove individual cards instead
- **Memory leaks**: Event listeners orphaned when `renderLegs()` clears innerHTML

## Domain Glossary

| Term | Meaning |
|------|---------|
| **AGL** | Above Ground Level — altitude measured from field elevation |
| **MSL** | Mean Sea Level — absolute altitude |
| **TAS / IAS** | True Airspeed / Indicated Airspeed — TAS increases with altitude |
| **GFS** | Global Forecast System — NOAA weather model used via Open-Meteo |
| **Crab mode** | Aircraft points into wind to maintain ground track (heading ≠ track) |
| **Drift mode** | Aircraft points along track, wind pushes it sideways |
| **Z-pattern** | Downwind leg flies same direction as final (non-standard) |
| **DW / Base / Final** | The three standard pattern legs before landing |
| **Jump run** | Aircraft flight path over the DZ during exit |
| **Green/Red light** | Points on jump run where exit is allowed/prohibited |
| **Glide ratio** | Horizontal distance / vertical distance (e.g. 8:1) |
