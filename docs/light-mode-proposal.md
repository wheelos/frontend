# Dreamview Frontend — Light Mode Implementation

## 1. Background

Dreamview's current UI uses a dark color scheme throughout. When debugging vehicles outdoors, the screen becomes difficult to read under direct sunlight. Adding a light/day mode improves outdoor usability.

## 2. Architecture

### 2.1 Approach: CSS Custom Properties + MobX Observable

```
┌──────────────────────────────────────────────┐
│  src/styles/_variables.scss                  │  CSS variable definitions
│    .theme-dark  { --bg-panel: #1D2226; }     │
│    .theme-light { --bg-panel: #EEF0F4; }     │
├──────────────────────────────────────────────┤
│  src/store/options.js                        │  themeMode observable + toggleTheme()
├──────────────────────────────────────────────┤
│  src/components/Dreamview.js                 │  theme class on root + ConfigProvider
│  src/components/Offlineview.js               │  theme class on root
├──────────────────────────────────────────────┤
│  All SCSS files                              │  hardcoded colors → var()
├──────────────────────────────────────────────┤
│  src/renderer/index.js                       │  updateSceneTheme() for Three.js
├──────────────────────────────────────────────┤
│  src/components/Scene/index.js               │  listens to themeMode changes
├──────────────────────────────────────────────┤
│  src/components/StatusBar/AutoMeter.js       │  theme-aware meter colors
│  src/components/StatusBar/Electricity.js     │  theme-aware battery SVG colors
└──────────────────────────────────────────────┘
```

### 2.2 Files Changed

| File | Change |
|---|---|
| `src/styles/_variables.scss` | **NEW** — 60+ CSS variables for dark and light themes |
| `src/styles/main.scss` | `@import "variables"`, 162 hex + 19 rgba → `var()`, icon filter rules |
| `src/styles/common.scss` | All hardcoded colors → `var()` |
| `src/styles/monitor.scss` | All hardcoded colors → `var()` |
| `src/styles/Modal.scss` | All hardcoded colors → `var()` |
| `src/styles/playback-controls.scss` | All hardcoded colors → `var()` |
| `src/components/SideBar/style.scss` | All hardcoded colors → `var()` |
| `src/components/Tasks/style.scss` | All hardcoded colors → `var()` |
| `src/components/ApplicationGuideModal/style.scss` | All hardcoded colors → `var()` |
| `src/store/options.js` | Added `themeMode` observable + `toggleTheme()` action + localStorage persistence |
| `src/store/config/parameters.yml` | Added `themeMode: default: dark` |
| `src/store/meters.js` | Changed `roundToTens` → `roundToOneDecimal` for finer throttle/brake display |
| `src/components/Dreamview.js` | Root `theme-${mode}` class + `<ConfigProvider>` wrapper |
| `src/components/Offlineview.js` | Root `theme-${mode}` class |
| `src/components/Header/HMIControls.js` | Theme toggle button (☀/☾) |
| `src/components/Scene/index.js` | `componentWillUpdate` calls `renderer.updateSceneTheme()` |
| `src/renderer/index.js` | `updateSceneTheme()` method + `THEME_SCENE_COLORS` map |
| `src/components/StatusBar/AutoMeter.js` | Theme-aware meter colors + sliding head indicator |
| `src/components/StatusBar/Electricity.js` | Theme-aware battery SVG background color |
| `docs/light-mode-proposal.md` | Updated implementation documentation |

### 2.3 CSS Variable Categories

| Category | Variables | Example |
|---|---|---|
| Background layers | `--bg-scene`, `--bg-body`, `--bg-header`, `--bg-panel`, `--bg-button`, `--bg-hover`, etc. | Dark: `#1D2226` → Light: `#EEF0F4` |
| Text layers | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-label`, `--text-disabled` | Dark: `#FFFFFF` → Light: `#2C2C2C` |
| Borders | `--border-dark`, `--border-primary`, `--border-section`, `--border-divider` | Dark: `#000000` → Light: `#7A808A` |
| Accents | `--accent-blue`, `--accent-blue-dark` | Same in both themes |
| Status | `--status-error`, `--status-alert`, `--status-warn` | Same in both themes |
| Overlays | `--bg-overlay`, `--bg-overlay-light`, `--bg-overlay-medium` | Dark: `rgba(0,0,0,0.8)` → Light: `rgba(245,246,248,0.93)` |
| Icon filter | `--icon-filter` | Dark: `none` → Light: `invert(1) brightness(0.6)` |

### 2.4 Key Design Decisions

1. **CSS custom properties** chosen over compile-time SCSS variables for runtime switching
2. **MobX observable** `themeMode` in Options store for state management
3. **localStorage** persistence for theme preference across reloads
4. **Light UI panels + dark 3D viewport** — the 3D scene background changes subtly but UI panels are fully themed
5. **Ant Design v4.20** — no `theme` export available, uses plain `ConfigProvider` without algorithm switching
6. **Icon handling** — CSS `filter: invert(1) brightness(0.6)` inverts white PNG icons to dark gray in light mode
7. **Border contrast** — Light theme borders use deeper grays (`#7A808A`) for clear separation from light panel backgrounds
8. **Meter precision** — `roundToTens` (10% granularity) changed to `roundToOneDecimal` (0.1% granularity)

## 3. Light Theme Color Palette

The light theme uses **warm gray tones** with distinct tiers matching the dark theme's variety:

| Layer | Dark | Light |
|---|---|---|
| Scene background | `#000C17` | `#DDE3EA` |
| Body | `#14171A` | `#E8ECF1` |
| Header | `#000000` | `#F5F6F8` |
| Panel/Card | `#1D2226` | `#EEF0F4` |
| Button | `#181818` | `#E0E3E8` |
| Hover | `#2A3238` | `#D5D9DF` |
| Primary text | `#FFFFFF` | `#2C2C2C` |
| Border (strong) | `#000000` | `#7A808A` |
| Border (subtle) | `#333333` | `#C0C6CF` |

## 4. Usage

- Toggle via the ☀/☾ button in the header
- Theme persists across page reloads (localStorage)
- Default theme is dark (configurable in `parameters.yml`)

## 5. Technical Notes

- All SCSS color replacements use **only** `var(--xxx)` — no structural CSS was changed
- The `replaceAll` approach was avoided; a Python script performed surgical line-by-line replacements
- Three.js scene background updates on theme change via `updateSceneTheme()`
- Status bar overlays use semi-transparent backgrounds that work in both themes
- The steering wheel SVG circle has `fill: transparent` to show the panel background through it
