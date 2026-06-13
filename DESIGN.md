---
version: alpha
name: container-cost-design-system
description: "A dark-canvas, Raycast-inspired design system for ContainerCost — a cost calculator and dashboard for Docker containers running across multiple VPS. Pure near-black canvas (#07080a), surface ladder with hairline borders, Inter typography with ss03, Lucide icons, and a single blue accent (#57c1ff) that signals interactivity without breaking the inky atmosphere. The system prioritizes data density — compact summary cards, horizontal VPS strip, inline trend indicators, and a sortable container table — all on a single-page dashboard that reads like a developer tool, not a generic admin panel."

colors:
  # ── Canvas (Background) ──
  canvas: "#07080a"
    # The deepest background. Pure near-black. Used for page body and main app backdrop.
    # Chosen over true black (#000) to create depth without visual noise.

  # ── Surface Ladder ──
  surface: "#0d0d0d"
    # Base surface. One step above canvas. Used for sidebar and table header background.
  surface-elevated: "#101111"
    # Elevated surface. Used for secondary controls, elevated panels, and period filter bar.
  surface-card: "#121212"
    # Card surface. Slightly lighter than elevated. Used for all cards (summary, charts, table).
  surface-hover: "#161718"
    # Hover state. Applied to interactive elements on hover.
    # Very subtle — just enough to signal interactivity without visual noise.

  # ── Borders ──
  hairline: "#242728"
    # Standard 1px border. Used for card borders, table rows, and UI chrome.
    # Chosen as a dark grey rather than a harsh white to maintain the dark canvas illusion.
  hairline-soft: "rgba(255,255,255,0.08)"
    # Subtle border. Used for decorative dividers and subtle separation.
  hairline-strong: "rgba(255,255,255,0.16)"
    # Strong border. Used for focus states and elevated interactive elements.

  # ── Typography Colors ──
  ink: "#f4f4f6"
    # Primary text. Highest contrast. Used for headings, values, and key data points.
    # Chosen as off-white (#f4f4f6) rather than pure white for eye comfort.
  body: "#cdcdcd"
    # Body text. Medium contrast. Used for table cells and descriptive text.
  mute: "#9c9c9d"
    # Muted text. Lower contrast. Used for secondary labels, timestamps, and hints.
  ash: "#6a6b6c"
    # Muted-de-emphasized. Used for non-interactive icons and de-emphasized metadata.
  stone: "#434345"
    # Lowest contrast visible. Used for inactive sort arrows and decorative elements.

  # ── Accent Colors ──
  accent-blue: "#57c1ff"
    # Primary accent. Used for active states, interactive elements, and CTAs.
    # Vibrant blue (#57c1ff) chosen for visibility on dark surfaces without being harsh.
  accent-blue-soft: "rgba(87,193,255,0.12)"
    # Soft blue. Used for active nav backgrounds and subtle highlights.
  accent-green: "#59d499"
    # Positive/success state. Used for "running" status badges and positive trends.
  accent-green-soft: "rgba(89,212,153,0.12)"
  accent-red: "#ff6161"
    # Negative/error state. Used for "stopped" indicators and negative trends.
  accent-red-soft: "rgba(255,97,97,0.12)"
  accent-yellow: "#ffc533"
    # Warning/paused state. Used for "paused" badges and neutral indicators.
  accent-yellow-soft: "rgba(255,197,51,0.12)"

  # ── Charts ──
  chart-series:
    - "#57c1ff"   # blue — primary
    - "#a78bfa"   # purple
    - "#fb923c"   # orange
    - "#2dd4bf"   # teal
    - "#59d499"   # green
    - "#ff6161"   # red

typography:
  font-family: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
  font-feature-settings: '"calt", "kern", "liga", "ss03"'
    # ss03 enables the alternate 'g' and rounded punctuation in Inter.
    # This is the same setting Raycast uses — it gives Inter a more polished,
    # less generic appearance.

  font-weights:
    regular: 400
    book: 450
    medium: 500
    semibold: 550
    bold: 600

  scale:
    caption: "11px/1.5"
    body-small: "12px/1.5"
    body: "13px/1.5"
    body-medium: "14px/1.5"
    heading-small: "15px/1.4"
    heading: "20px/1.3"
    display: "24px/1.2"
    value: "28px/1.1"

spacing:
  # 4px base unit scale
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  section: 96px

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  xl: 16px
  full: 9999px

layout:
  sidebar-width: 228px
  topbar-height: 52px
  content-max-width: 1280px
  content-padding: "24px"

icons:
  system: "Lucide"
  stroke-width: 1.5
  sizing:
    nav: "16px × 16px"
    button: "15px × 15px"
    card: "18px × 18px"
    small: "14px × 14px"
  colors:
    default: "#6a6b6c (ash)"
    hover: "#9c9c9d (mute)"
    active: "#57c1ff (accent-blue)"
    code-block: false

components:
  sidebar:
    background: "{colors.surface}"
    width: "{layout.sidebar-width}"
    border-right: "1px solid {colors.hairline}"
    nav-item:
      padding: "8px 12px"
      border-radius: "{rounded.sm}"
      color-default: "{colors.mute}"
      color-hover: "{colors.ink}"
      color-active: "{colors.accent-blue}"
      bg-hover: "{colors.surface-hover}"
      bg-active: "{colors.accent-blue-soft}"
      icon-color-default: "{colors.ash}"
      icon-color-hover: "{colors.mute}"
      icon-color-active: "{colors.accent-blue}"
      font-size: "13.5px"
      font-weight: 450
    footer:
      padding: "12px 16px"
      border-top: "1px solid {colors.hairline}"
      status-dot: "{colors.accent-green}"

  summary-cards:
    background: "{colors.surface-card}"
    border: "1px solid {colors.hairline}"
    border-radius: "{rounded.lg}"
    padding: "24px"
    grid-columns: 4
    breakpoint: "1024px → 2 column"
    icon-box:
      size: "36px × 36px"
      border-radius: "{rounded.md}"
    value-typography: "28px/600/{colors.ink}"

  vps-strip:
    background: "{colors.surface-card}"
    border: "1px solid {colors.hairline}"
    border-radius: "{rounded.lg}"
    padding: "8px"
    item-gap: "12px"
    item-padding: "8px 16px"
    item-border-radius: "{rounded.sm}"
    active-state:
      background: "{colors.accent-blue-soft}"
      box-shadow: "inset 0 0 0 1px {colors.accent-blue-soft}"
      name-color: "{colors.accent-blue}"

  period-filter:
    background: "{colors.surface-elevated}"
    border: "1px solid {colors.hairline}"
    border-radius: "{rounded.md}"
    padding: "8px"
    button:
      active-bg: "{colors.surface-card}"
      active-border: "1px solid {colors.hairline}"

  chart-cards:
    background: "{colors.surface-card}"
    border: "1px solid {colors.hairline}"
    border-radius: "{rounded.lg}"
    padding: "24px"
    chart-colors: "{colors.chart-series}"
    grid-columns: 2
    breakpoint: "1024px → 1 column"

  trend-chart:
    background: "{colors.surface-card}"
    border: "1px solid {colors.hairline}"
    border-radius: "{rounded.lg}"
    padding: "24px"
    y-axis-labels: true
    y-axis-label-color: "{colors.ash}"
    y-label-font-size: "10px"
    grid-line-color: "{colors.hairline}"

  data-table:
    background: "{colors.surface-card}"
    border: "1px solid {colors.hairline}"
    border-radius: "{rounded.lg}"
    overflow: hidden
    header-bg: "{colors.surface}"
    th:
      font-size: "11px"
      font-weight: 600
      color: "{colors.ash}"
      letter-spacing: "0.5px"
      uppercase: true
      sort-color: "{colors.accent-blue}"
    td:
      font-size: "13px"
      color: "{colors.body}"
      padding: "12px 24px"
    row-hover: "{colors.surface-hover}"
    sorted-column: "{colors.accent-blue}"

  buttons:
    default:
      background: "{colors.surface-elevated}"
      border: "1px solid {colors.hairline}"
      color: "{colors.ink}"
      border-radius: "{rounded.sm}"
      font-size: "12.5px"
      font-weight: 500
      padding: "6px 14px"
      gap: "6px"
      icon-size: "15px"
    primary:
      background: "{colors.primary}"
      color: "#000000"
      border-color: "{colors.primary}"
    hover:
      background: "{colors.surface-hover}"
      border-color: "{colors.stone}"
    small:
      padding: "4px 10px"
      font-size: "11px"

  badges:
    default:
      font-size: "11px"
      padding: "2px 8px"
      border-radius: "{rounded.full}"
      font-weight: 450
    running:
      background: "{colors.accent-green-soft}"
      color: "{colors.accent-green}"
    paused:
      background: "{colors.accent-yellow-soft}"
      color: "{colors.accent-yellow}"
    inactive:
      background: "{colors.surface-elevated}"
      color: "{colors.mute}"

---

# ContainerCost — Design System

> **Version:** alpha  
> **Based on:** Raycast design language  
> **Icons:** Lucide (stroke 1.5px)  
> **Last updated:** 2026-06-13  
> **Design mockups:** `sketches/` directory

## Overview

ContainerCost is a **cost calculator dashboard** for Docker containers running across multiple VPS machines. The UI is a single-page application with a fixed sidebar, sticky topbar, and scrollable content area. The design language is **Raycast-inspired** — near-black canvas, subtle surface ladder, hairline borders, Inter typography, and a restrained blue accent that signals interactivity without visual noise.

## Design Principles

1. **Data density without clutter** — Every pixel should carry information. Summary cards show trend, label, value, and period in a compact footprint. The VPS strip shows multiple servers in a horizontal scrollable bar.

2. **Developer tool aesthetic** — This is not a consumer app. The UI should feel like a professional tool: precise, restrained, monochrome with selective accent. Surfaces use luminance differences (not shadows) to create hierarchy — a hallmark of modern dev tools.

3. **Consistent spacing** — All spacing follows a 4px base unit scale (4, 8, 12, 16, 24, 32). Cards have 24px padding. Elements inside cards have 16px gaps. This creates visual rhythm without arbitrary margins.

4. **Single source of truth** — This DESIGN.md is the canonical reference. The CSS `:root` variables mirror these tokens. If you change a token, change it here first.

## Visual Architecture

### Canvas Hierarchy

```
#07080a  ← canvas (page background, topbar background)
    ↓
#0d0d0d  ← surface (sidebar background)
    ↓
#101111  ← surface-elevated (filter bars, secondary controls)
    ↓
#121212  ← surface-card (all cards: summary, charts, table)
    ↓
#161718  ← surface-hover (hover states)
```

No shadows are used for card elevation. Instead, the **surface ladder** (luminance progression) creates depth — lower surfaces are darker, elevated surfaces are slightly lighter.

### Borders

All structural borders use `#242728` at 1px. This is dark enough to be invisible on the surface ladder but provides just enough definition to separate elements. The goal is **structure without harsh lines**.

### Typography Stack

**Primary:** Inter (loaded from Google Fonts)  
**Fallback:** -apple-system, BlinkMacSystemFont, sans-serif  

All text uses Inter with `font-feature-settings: "ss03"` enabled — this enables Inter's alternate 'g' and rounded punctuation, giving the UI the same polished appearance as Raycast's own interface.

**Font weights used:**
- 400 (regular) — body text, table cells
- 450 (book) — nav items, labels
- 500 (medium) — headings, buttons
- 550 (semibold) — section titles
- 600 (bold) — numbers, values

### Icon System

**Lucide icons** (inline SVGs) — not an icon font, not emoji.

Each icon is an inline `<svg>` element that inherits its color from `currentColor`. This means:
- Inactive nav icons → `var(--ash)` (#6a6b6c)
- Active nav icons → `var(--accent-blue)` (#57c1ff)
- Hover nav icons → `var(--mute)` (#9c9c9d)

Stroke width is consistently **1.5px** across all icons.

### Spacing Scale

| Token  | Value | Used For                        |
|--------|-------|---------------------------------|
| `xs`   | 4px   | Small gaps, status dots         |
| `sm`   | 8px   | Tight gaps, button padding      |
| `md`   | 12px  | Element gaps, section padding   |
| `lg`   | 16px  | Card padding, content spacing   |
| `xl`   | 24px  | Card padding, content margins   |
| `xxl`  | 32px  | Page section spacing            |
| `sec`  | 96px  | Major page sections             |

## Component Patterns

### Sidebar
- Fixed left, 228px wide
- Navigation items: 8px top/bottom, 12px left/right padding
- Active item: soft blue background, blue text + icon
- Footer: status indicator with green dot

### Summary Cards
- 4-column grid, collapses to 2 on tablet
- Icon box (36×36) in card top-left
- Trend badge in card top-right (green/red/neutral)
- Three-line structure: label → large value → subtitle

### VPS Strip
- Horizontal scrollable bar inside a card
- Each VPS is a pill-like item with colored vertical indicator
- Active state: soft blue background + blue text

### Charts
- Doughnut: breakdown of container/overhead/unallocated
- Bar: cost distribution across VPS/containers
- Trend line: 30-day cost trend with Y-axis labels

### Data Table
- Compact 6-column table with uppercase headers
- Monthly Cost column is sorted by default descending
- Sort indicator (chevron) in header
- Status column uses pill badges

## Responsive Behavior

| Breakpoint | Changes                                    |
|------------|--------------------------------------------|
| ≤1024px    | Summary cards: 4 → 2 col; Charts: 2 → 1 col |

## Migration Notes

### From v1.0 (KubeCost-inspired) to v2.0 (Raycast-inspired)

| Token         | v1.0 (old)     | v2.0 (new)    | Rationale                             |
|---------------|----------------|---------------|---------------------------------------|
| `--bg-body`   | `#0b0f1a`      | `#07080a`     | Near-black for deeper canvas          |
| `--bg-sidebar`| `#0e1320`      | `#0d0d0d`     | Match Raycast surface ladder          |
| `--bg-card`   | `#141a2b`      | `#121212`     | One step up from surface              |
| `--border`    | `#253048`      | `#242728`     | Darker, more subtle border            |
| `--accent`    | `#326ce5`      | `#57c1ff`     | More vibrant, better on dark          |
| Icons         | Emoji          | Lucide SVGs   | Consistent rendering across platforms |
| Typography    | System UI      | Inter + ss03  | Polished, premium look                |

## File Location

This file lives at the project root: `DESIGN.md`

Related files:
- **CSS tokens:** `web/dist/css/style.css` (`:root` variables)
- **Design mockups:** `sketches/mockup-v3-raycast-polish.html` (latest)
- **PRD:** `PRD.md`
