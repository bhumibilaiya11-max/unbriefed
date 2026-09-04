---
name: Executive Manifesto
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#4a4455'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#7b7487'
  outline-variant: '#ccc3d8'
  surface-tint: '#732ee4'
  primary: '#630ed4'
  on-primary: '#ffffff'
  primary-container: '#7c3aed'
  on-primary-container: '#ede0ff'
  inverse-primary: '#d2bbff'
  secondary: '#9d4300'
  on-secondary: '#ffffff'
  secondary-container: '#fd761a'
  on-secondary-container: '#5c2400'
  tertiary: '#7d3d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#a15100'
  on-tertiary-container: '#ffe0cd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#eaddff'
  primary-fixed-dim: '#d2bbff'
  on-primary-fixed: '#25005a'
  on-primary-fixed-variant: '#5a00c6'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#783200'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb784'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#713700'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-lg:
    fontFamily: Epilogue
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Epilogue
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Epilogue
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  stat-lg:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
spacing:
  grid-margin: 1rem
  gutter: 0.75rem
  tight-gap: 0.25rem
  section-padding: 3rem
---

## Brand & Style

This design system establishes a visual language that is simultaneously authoritative and disruptive. It bridges the gap between traditional McKinsey-style management consulting and a modern, rebellious career manifesto. The aesthetic is built on high-density information architecture, signaling depth of thought and strategic rigor.

The style is a hybrid of **Minimalist Editorial** and **Modern Brutalism**. It utilizes the "paper-and-ink" physical metaphor of traditional case reports but injects high-octane energy through aggressive typography and a singular, vibrant accent. The UI should evoke a feeling of "The smartest person in the room has arrived," combining the confidence of an industry veteran with the innovation of a disruptor. 

Visual priority is given to data clarity, utilizing edge-to-edge layouts and functional decorative elements (like intensity bars and matrix grids) to convey immediate value.

## Colors

The palette is anchored by "Deep Ink" and "Off-White Paper" to ground the design in an editorial context. 

- **Primary (Electric Purple):** Used for the core "Innovational" and "Playful" tones. It represents the AI-driven edge of the product.
- **Secondary (Bold Orange):** Used for "Formal" and "Professional" tones or as a secondary data highlight.
- **Neutral (Deep Ink):** Reserved for primary text, heavy borders, and full-bleed headers to maintain a "McKinsey" level of seriousness.
- **Background (Off-White Paper):** A subtle warmth that reduces eye strain in high-density layouts and feels more premium than pure white.

Use the primary accent for CTAs, focus states, and the highest-priority data nodes in charts.

## Typography

The typography system relies on extreme contrast. 

**Epilogue** serves as the "Manifesto" face—bold, geometric, and uncompromising. It should be used for all major headers. **Hanken Grotesk** provides a clean, neutral balance for dense body text, ensuring legibility in long-form "problem statements." **Geist** is introduced for labels and technical data (stats, table headers) to provide a modern, developer-precise feel.

For high-density infographic sections, use `label-md` for categorization and `stat-lg` for prominent numerical callouts.

## Layout & Spacing

The design system utilizes a **Fluid Grid** with minimal margins to maximize information density, mimicking the "edge-to-edge" style of case competition slides.

- **Desktop (1440px+):** 12-column grid, 16px margins. High density is encouraged; allow components to span full widths for banners.
- **Tablet (768px):** 8-column grid. Reflow 2x2 matrices into 1x4 stacks if necessary, but prioritize maintaining the comparison table layouts.
- **Mobile (375px):** 4-column grid. All horizontal intensity bars and timelines must reflow vertically.

Spacing rhythm is tight (increments of 4px). Use `tight-gap` for elements within a single card (e.g., icon and label) to maintain the "compact" professional look.

## Elevation & Depth

This design system rejects soft shadows in favor of **Bold Borders** and **Tonal Layers**. Depth is communicated through structural containment rather than light simulation.

- **Surface Layers:** Use slightly different shades of the background or very light grey (#F0F0F0) to distinguish the "2x2 Matrix" boxes or "Comparison Table" rows.
- **Structural Outlines:** Use 1px or 2px solid "Deep Ink" (#1A1A1A) borders for all cards and input fields. This creates a blueprint-like clarity.
- **Accent Fills:** Use full-bleed primary color blocks for headers and footers to pin the content.
- **No Shadows:** Avoid drop shadows entirely. If depth is required for a floating element (like a modal), use a solid black offset shadow (2px 2px) for a brutalist, editorial touch.

## Shapes

The shape language is strictly **Sharp (0)**. 

To maintain the "Executive Manifesto" and consulting aesthetic, all corners are 90-degree angles. This communicates precision, structure, and a no-nonsense professional attitude. 

**Exceptions:**
- **Icon Badges:** Use circles for icons to provide a singular point of visual softness, making them pop against the rigid grid.
- **Intensity Bars:** The inner fill of a progress or intensity bar may have a 2px radius to feel "contained," but the outer container must remain sharp.

## Components

### Buttons & CTAs
- **Primary:** Deep Ink background, White text, 0px radius, 2px border.
- **Accent:** Primary Color background, White text, 0px radius.
- **Ghost:** No fill, Deep Ink border, Deep Ink text.

### Data Visualization
- **Intensity Bars:** Horizontal tracks with segmented blocks (e.g., 5-step scale). Use the accent color for the active value.
- **2x2 Matrix:** Four equal quadrants defined by a 2px Deep Ink crosshair. Quadrant labels use `label-md`.
- **Phased Timelines:** Horizontal lines with circular nodes. Each node should be accompanied by a vertical "Deep Ink" line connecting to the description text.

### Cards & Callouts
- **Icon Badges:** Icons must be placed inside a soft-colored circle (10% opacity of the accent color).
- **Stat Cards:** Large `stat-lg` number centered, with `label-md` description below, wrapped in a 1px border box.

### Tables
- **Comparison Tables:** Minimalist. Deep Ink header row with White text. Alternating row fills for readability. No vertical dividers; only horizontal lines.

### Input Fields
- Underlined style or full 1px border. No rounded corners. Focus state is indicated by a 2px primary color border.