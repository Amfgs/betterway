# Better Way Design System

This file is the visual contract for Better Way. It follows the nine-section
`DESIGN.md` structure supported by Open Design and should guide every web and
mobile-facing interface in this repository.

## 1. Visual Theme And Atmosphere

Better Way is a calm, lucid and constructive financial companion. The product
should feel like a well-organized personal workspace: reassuring enough for a
first-time budgeter, precise enough for someone tracking investments, and never
styled like a trading terminal.

- Marketing surfaces are image-led and confident, with committed forest-green
  fields, clear white type and chartreuse reserved for the strongest action.
- Authenticated surfaces are restrained, bright and task-first. Dark mode uses
  deep green neutrals instead of pure black.
- Financial information leads. Decoration must never compete with balances,
  limits, dates, progress or the next action.
- Motion communicates state or progression and normally lasts 160-240 ms.
- Brand voice: calm, direct, encouraging. Avoid fear, hype and jargon.

## 2. Color Palette And Roles

| Token | Value | Role |
| --- | --- | --- |
| Forest 950 | `#07120e` | Dark brand canvas and hero foundation |
| Forest 900 | `#0b2a20` | Sidebar and strong brand surfaces |
| Green 700 | `#0d6b4f` | Primary product action and selected state |
| Green 500 | `#1fbd82` | Positive data and active indicators |
| Lime 300 | `#c9ff63` | Marketing CTA and rare high-emphasis signal |
| Canvas | `#f3f6f2` | Product page background |
| Surface | `#ffffff` | Primary content surface |
| Ink | `#15201b` | Primary text |
| Muted ink | `#66736d` | Secondary text with readable contrast |
| Border | `#dfe6e1` | Quiet separators and input borders |
| Warning | `#c98212` | Attention state from 80% to 99% |
| Danger | `#d94b43` | Limit exceeded, destructive actions and losses |
| Info | `#376fa8` | Neutral information and external market context |

Rules:

- Green means selection, progress or a positive financial state. It is not a
  decorative wash for every surface.
- Lime is limited to a single dominant CTA or signal in a viewport.
- Red is never used for ordinary expenses alone when the sign and label already
  communicate an outflow; reserve it for loss, danger or deletion.
- Charts use stable semantic colors across every page.
- Text and controls must meet WCAG AA contrast in both themes.

## 3. Typography Rules

- Family: `Manrope Variable`, with system sans-serif fallbacks.
- Marketing display: 48-72 px desktop, 40-50 px tablet, 36-44 px mobile;
  weight 760-820; line-height 0.98-1.08; never negative letter spacing.
- Product page title: 30-36 px desktop and 26-30 px mobile; weight 760-800.
- Section title: 18-22 px; weight 760-800.
- Body: 14-16 px; line-height 1.55-1.7; maximum 70 characters per line.
- Labels: 12-13 px; weight 650-750. Avoid uppercase except for short status
  tokens where scanning materially improves.
- Financial values use tabular numerals when supported.

## 4. Component Stylings

### Buttons

- Radius: 8 px. Minimum touch target: 44 x 44 px.
- Primary: Green 700 with white text in the product; Lime 300 with Forest 950
  text on dark marketing surfaces.
- Secondary: transparent or Surface with a full quiet border.
- Destructive: Danger background only for confirmed destructive commands.
- Every button has hover, focus-visible, active, disabled and loading states.
- Icon-only controls require an accessible name and tooltip.

### Surfaces

- Radius: 8 px. One-pixel border. Default shadow is very quiet or absent.
- Cards group one repeated entity or one coherent task. Do not nest decorative
  cards or wrap every section in a floating container.
- Summary metrics may use a small status dot, a semantic value and one line of
  supporting context.

### Forms

- Labels remain visible above controls; placeholders are examples, not labels.
- Controls are at least 44 px high and use the same border, focus ring and error
  language throughout the product.
- Related fields share a section and submit action. Advanced configuration uses
  progressive disclosure when it is not needed for the main task.
- Validation appears next to the affected field and is announced to assistive
  technology.

### Navigation And Tabs

- The desktop sidebar is compact and stable. Selected items use a tinted green
  surface, not a loud full-width promotional color.
- The mobile bottom navigation contains the five product areas and respects the
  safe-area inset.
- Tabs are used for peer views inside the same product area. They remain
  horizontally scrollable on small screens.

### Data Visualization

- Charts always include a readable title, unit/context and a useful empty state.
- Grid lines and axes are quiet; data receives the contrast.
- Positive and negative series do not rely on color alone when labels or signs
  can communicate the distinction.

## 5. Layout Principles

- Landing content aligns to one grid: maximum 1480 px with 20-40 px gutters.
- Product content aligns to a maximum 1440 px workspace with 24-40 px desktop
  gutters and 16-20 px mobile gutters.
- Desktop navigation: 272 px open and 84 px closed.
- Product pages follow this reading order: page purpose, primary view controls,
  key financial state, main task, secondary detail.
- Use asymmetric grids only when they reinforce priority, such as a larger chart
  beside smaller supporting metrics.
- Avoid duplicated page descriptions in both the global top bar and page body.

## 6. Depth And Elevation

- Level 0: page canvas.
- Level 1: ordinary surface with border and no shadow.
- Level 2: sticky navigation or an interactive surface with a subtle shadow.
- Level 3: dropdown, popover or date picker.
- Level 4: modal over a dimmed backdrop.
- Glass blur is allowed only for sticky navigation over content or imagery.
- Never use elevation to make a non-interactive section look clickable.

## 7. Do And Do Not

Do:

- Put the user's current state and next useful action above supporting detail.
- Use plain Brazilian Portuguese and preserve correct accents.
- Keep financial values aligned, scannable and semantically colored.
- Provide explicit empty, loading, success and error states.
- Keep the same component vocabulary across all five product areas.

Do not:

- Use gradients in text, decorative glass cards, oversized metric templates or
  repeated icon-card grids.
- Animate layout dimensions or delay access to product tasks.
- Use marketing language in authenticated page titles.
- hide essential controls behind hover-only interactions.
- add a new UI framework when a local component can preserve the visual system.

## 8. Responsive Behavior

- Desktop: persistent collapsible sidebar, sticky utility bar and multi-column
  data layouts.
- Tablet: collapse wide grids to two columns and keep primary controls visible.
- Mobile: bottom navigation, compact top bar, one-column forms and charts with
  stable minimum heights.
- Calendar remains a seven-column grid, but each day reduces secondary copy
  before reducing legibility.
- Tables and tab rows scroll within their own region without creating page-level
  horizontal overflow.
- All motion respects `prefers-reduced-motion`.

## 9. Agent Prompt Guide

When changing Better Way UI, preserve the existing forest, green and lime brand
identity. Build marketing surfaces as confident, image-led compositions and
authenticated surfaces as restrained financial workspaces. Prefer local,
accessible React components and semantic HTML. Keep radii at 8 px or less,
motion between 160 and 240 ms, and prioritize financial state over decoration.
Check desktop and mobile, both themes, loading and empty states before delivery.

Reference principles were studied from Open Design, shadcn/ui, Material UI and
Ant Design. They inform structure, accessibility and consistency; Better Way
does not visually clone any of them.
