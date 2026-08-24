---
name: "CBH - Lab Management"
description: "A calm, data-first visual system for laboratory operations, quality, safety, and public laboratory services."
colors:
  bg: "#F7F9FC"
  card: "#FFFFFF"
  surface-2: "#F1F4F9"
  border: "#E5EAF0"
  ink: "#0F172A"
  muted: "#64748B"
  primary: "#1E5FAD"
  primary-2: "#2563EB"
  primary-soft: "rgba(30,95,173,.10)"
  danger: "#DC2626"
  warning: "#D97706"
  success: "#16A34A"
  public-bg: "#F6F8FB"
  public-card: "#FCFDFF"
  public-surface-2: "#EEF3F8"
  public-border: "#DDE6EF"
  public-ink: "#0B1626"
  public-muted: "#667589"
  public-accent: "#B08D57"
  public-accent-soft: "rgba(176,141,87,.13)"
  public-hairline: "rgba(30,95,173,.16)"
typography:
  display:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  headline:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Noto Sans Thai, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "28px"
  section: "56px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "36px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "36px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#FFFFFF"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "36px"
  button-soft:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "36px"
  input-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "38px"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  status-badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
---

# Design System: CBH - Lab Management

## Overview

**Creative North Star: "The Lab Control Room"**

This is a current-state record of the incumbent implementation. The North Star is a descriptive label inferred from the code, not a new rebrand. The protected portal behaves like a calm clinical control room: information is dense enough for daily work, but hierarchy, cool neutrals, and one clear action color keep the surface legible under operational pressure.

The public surface shares the same blue institutional foundation but changes posture. It becomes more editorial and welcoming through a blue hero, real laboratory photography, softer layering, and a restrained brass accent. These two modes should feel related, not identical: staff surfaces optimize for operating; public surfaces optimize for finding, understanding, and trust.

**Key Characteristics:**

- Cool blue and blue-gray neutrals with a single action accent.
- Thai-first typography with compact labels and readable data views.
- Tonal layering and quiet borders before heavy decoration.
- Semantic colors reserved for status, urgency, and outcomes.
- Responsive, keyboard-visible, reduced-motion-aware behavior.

## Colors

The palette is clinical without becoming sterile: cool paper and slate text create the work surface, the primary blue carries action and navigation, and public brass is reserved for the public-facing service layer.

### Primary

- **Clinical Blue** (`colors.primary`): The default action, active navigation, focus context, chart emphasis, and quality-work accent.
- **Action Blue** (`colors.primary-2`): A brighter supporting blue for gradients, public hero highlights, and secondary data emphasis.

### Secondary

- **Public Brass** (`colors.public-accent`): A restrained public-surface accent for search focus, highlight glows, and institutional warmth. It is not a general-purpose staff status color.

### Tertiary

- **Danger Red** (`colors.danger`): Errors, destructive actions, incident emphasis, and failed outcomes.
- **Warning Amber** (`colors.warning`): Due-soon, missing, or attention-needed states.
- **Success Green** (`colors.success`): Completed, valid, or successful outcomes.

### Neutral

- **Cool Paper** (`colors.bg`): Protected-shell background.
- **Card White** (`colors.card`): Elevated content surfaces, forms, tables, and panels.
- **Surface Mist** (`colors.surface-2`): Secondary bands, table headers, inactive controls, and soft fills.
- **Border Slate** (`colors.border`): Quiet 1px separation; prefer it over decorative rules.
- **Ink Slate** (`colors.ink`): Primary text and high-value data.
- **Muted Slate** (`colors.muted`): Supporting copy, labels, metadata, and inactive navigation.
- **Public Paper / Public Ink** (`colors.public-bg`, `colors.public-ink`): The slightly brighter public reading surface and its deeper text contrast.

The public layout also defines a slightly cooler public card/border set (`colors.public-card`, `colors.public-border`, `colors.public-hairline`) and dark-mode overrides in the shell styles. Preserve those contextual overrides rather than flattening every surface to the protected theme.

### Named Rules

**The Signal Hierarchy Rule.** Blue handles action and navigation; red, amber, and green communicate state. Never use semantic colors as decorative confetti.

**The Brass Boundary Rule.** Public brass belongs to public trust/search emphasis. It should not become a second primary accent inside the staff workspace.

## Typography

**Display Font:** Noto Sans Thai (with `system-ui` fallback)

**Body Font:** Noto Sans Thai (with `system-ui` fallback)

**Label/Mono Font:** The repository bundles Rajdhani and DM Mono, but the current shared implementation does not apply them as the default UI font. Do not introduce either casually; use them only when a surface has an explicit data-display need and can remain legible in Thai.

**Character:** The pairing is practical and Thai-first. Weight, spacing, and scale do the hierarchy work; the interface does not rely on a display typeface to feel authoritative.

### Hierarchy

- **Display** (700, 44px desktop / 34px tablet / 30px small mobile, 1.15–1.18 line-height): Public hero title and service-facing statements.
- **Headline** (800, 24px, 1.2 line-height): Staff page titles and public section headings.
- **Title** (800, 20px, 1.35 line-height): Module headers, quality headers, and compact feature titles.
- **Body** (400, 16px, 1.5 line-height): Default reading and form copy; public long-form sections may use a more generous line-height.
- **Label** (600–800, 11–13px, about 1.4 line-height): Metadata, table headings, eyebrow labels, controls, and compact navigation.

### Named Rules

**The Thai-First Rule.** Preserve Noto Sans Thai and make Thai copy the first-class reading path; English is a useful companion label, not the visual hierarchy owner.

**The Data Before Decoration Rule.** Keep metric and table values easy to scan; use tabular numerals where values update in place and never trade numeric clarity for stylistic display type.

## Layout

The protected shell is an operating workspace: a fixed sidebar is 248px when expanded and 64px when collapsed, with a flexible main column, topbar, route-aware breadcrumbs, and 28px desktop main padding. On small screens, the sidebar becomes a slide-in panel and the main area uses 12px horizontal padding with 16px top spacing. Shared navigation and view controls keep a minimum 44px target and contained horizontal scrolling on narrow screens.

The public shell is a centered service surface with a 1280px hero/content ceiling. The current home expression uses a 64px/28px/80px hero rhythm on desktop, real laboratory photography, and a 3fr/2fr news relationship. At 900px the hero becomes a stacked layout, and at 520px the photo collage is removed, actions become full-width, and category cards become one column. Treat these as the current responsive behavior to preserve when extending the public surface.

The recurring spacing rhythm is 4 / 8 / 12 / 16 / 20 / 28px, with 56px used for major public section starts. Dense operational views favor compact cards, tables, filters, and tabs; use whitespace to separate task groups rather than increasing every control's height.

## Elevation & Depth

The system uses a hybrid depth model. Protected staff screens are mostly flat and tonal: 1px borders, cool surface shifts, narrow accent rails, and low ambient shadows provide structure. Public screens are more lifted: hero gradients, image cards, stronger ambient shadows, and occasional translucent panels create approachability without changing the underlying palette.

### Shadow Vocabulary

- **Protected low ambient** (`0 3px 12px rgba(15,23,42,.035)`): Default quality-module cards and data containers.
- **Protected hover lift** (`0 8px 24px rgba(0,0,0,.06)`): Hoverable cards that represent an actionable detail surface.
- **Public small / medium / large** (`var(--public-shadow-sm)`, `var(--public-shadow-md)`, `var(--public-shadow-lg)`): Layered public cards, scope panels, and hero/photo composition.
- **Modal depth** (`0 20px 60px rgba(0,0,0,.25)`): Dialog panels only; never use modal depth on ordinary table rows.

### Named Rules

**The Flat-at-Rest Rule.** A staff surface should be quiet at rest. Elevation appears in response to hierarchy, hover, focus, or modal state.

## Shapes

Controls use gently rounded 8px corners. Standard cards use 12px; module headers and dialogs may use 16px; public not-found states and larger public compositions can reach 20px. Status badges and date/filter pills use a full pill silhouette. The default separation is a 1px border in the current border token, with a 3px or 4px accent rail reserved for quality and attention cards.

Avoid turning dense tables into collections of floating rounded tiles. Use clipping only where media, a modal, a scroll container, or a progress/status bar needs a clean edge.

## Components

### Buttons

- **Shape:** Compact 8px radius with three primary heights: 28px small, 36px medium, and 44px large.
- **Primary:** Clinical blue fill, white text, medium weight, 8px/14px medium padding; the large size uses 10px/18px padding.
- **Hover / Focus:** Existing buttons use a subtle brightness response and short 150ms transitions. Preserve the visible 3px primary-soft focus ring; a hover may lift by 1px when the button is a meaningful call to action.
- **Secondary / Ghost / Tertiary:** Secondary uses card white with a border; ghost is transparent with ink text; soft uses a primary-soft fill with primary text. Danger is reserved for destructive or irreversible actions.

### Chips

- **Style:** Badge/status chips are full pills with compact padding, semibold text, and a light semantic or surface fill.
- **State:** Filter chips are controls with `aria-pressed`; view tabs are a separate navigation pattern and should not be visually conflated with temporary filters. Selected tabs use a white/card fill, primary text, and a restrained inset underline/shadow.

### Cards / Containers

- **Corner Style:** 12px by default; 16px for quality headers and dialogs; public feature/photo cards use their own 14px treatment.
- **Background:** Card white over cool paper; secondary content can use surface mist.
- **Shadow Strategy:** Borders and tonal layering first; use low ambient shadow at rest and a small lift for interactive cards.
- **Border:** 1px border slate by default. Quality cards may add a 3px primary left rail or a semantic top rail.
- **Internal Padding:** 16px is the shared card default; 18–20px for module heads; 28px for the public scope panel.

### Inputs / Fields

- **Style:** Card-white background, 1px border, 8px radius, Noto Sans Thai, and three heights: 32px small, 38px medium, 44px large.
- **Focus:** Shift the border to primary and show a 3px primary-soft ring; keep `outline` behavior visible for keyboard users.
- **Error / Disabled:** Use danger with a clear message for errors; disabled fields retain their shape but reduce opacity and never look interactive.

### Navigation

- **Protected:** A fixed permission-filtered sidebar uses section labels, icon-led links, active state, expandable children, a collapsed 64px mode, and a mobile slide-in mode. Topbar, skip link, breadcrumbs, module sub-navigation, view tabs, and filter chips form one hierarchy.
- **Public:** The public navigation and hero are more spacious and service-oriented. Real logo/photographic assets are allowed here; do not move the public hero collage into dense staff views.
- **States:** Active navigation uses primary/primary-soft context, hover uses surface-2, and keyboard focus must remain visible. Keep route-backed state in the URL where the current architecture does.

### Signature Components

- **Public service hero:** Blue gradient field, Thai-first title, English companion line, search entry point, real laboratory-photo stack, and restrained public brass. This is the expressive public signature.
- **Quality module header:** A 16px gradient card with a muted eyebrow, compact bold title, action group, route-backed tabs, and a primary accent rail. This is the operational signature for data-heavy quality modules.

## Do's and Don'ts

### Do:

- **Do** use the shared CSS variables and component primitives before introducing a one-off color or radius.
- **Do** reserve primary blue for action, navigation, focus context, and meaningful data emphasis.
- **Do** keep Thai copy, metadata, table headings, and error states readable at compact sizes.
- **Do** preserve 44px touch targets for navigation and route-backed controls, visible focus, and reduced-motion behavior.
- **Do** use real approved laboratory assets on public service surfaces when imagery materially helps orientation or trust.
- **Do** let borders and tonal surface shifts carry most of the structure in protected data views.

### Don't:

- **Don't** introduce unrelated neon palettes, gradients, or decorative shadows into the staff workspace.
- **Don't** use red, amber, or green as general decoration; they communicate state and urgency.
- **Don't** turn every table row or filter into a floating rounded card.
- **Don't** use Rajdhani or DM Mono as a default replacement for Thai body text without a surface-specific reason.
- **Don't** collapse the public editorial mode and protected operating mode into the same density or hero treatment.
- **Don't** design a public visual projection that reveals internal safety-map topology, labels, personnel, or protected workflow detail.
