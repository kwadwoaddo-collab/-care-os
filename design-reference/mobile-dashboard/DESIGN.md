---
name: Clinical Precision
colors:
  surface: '#fbf8fa'
  surface-dim: '#dcd9db'
  surface-bright: '#fbf8fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f4'
  surface-container: '#f0edef'
  surface-container-high: '#eae7e9'
  surface-container-highest: '#e4e2e3'
  on-surface: '#1b1b1d'
  on-surface-variant: '#45474c'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#1e1200'
  on-tertiary: '#ffffff'
  tertiary-container: '#35260c'
  on-tertiary-container: '#a38c6a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#fadfb8'
  tertiary-fixed-dim: '#ddc39d'
  on-tertiary-fixed: '#271902'
  on-tertiary-fixed-variant: '#564427'
  background: '#fbf8fa'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e3'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
  card-padding: 24px
---

## Brand & Style

This design system is built on the principles of **Modern Corporate** aesthetics, specifically tailored for high-stakes healthcare administration. The personality is "Quietly Authoritative"—it doesn't need to shout to be trusted. It prioritizes clarity of data and speed of cognition over decorative elements.

The target audience consists of healthcare administrators, clinicians, and HR managers who require a high-information-density environment that remains legible and stress-free. The emotional response should be one of competence, calm, and absolute reliability. We achieve this through a rigorous adherence to whitespace, a sophisticated "ink-trap" typographic approach, and a layout that treats every data point with intentionality.

## Colors

The palette is anchored by a deep Indigo-Slate (`#1E293B`) which provides the necessary weight and authority for a professional medical platform. A vibrant Indigo (`#4F46E5`) is used for primary actions to draw the eye without feeling aggressive.

Semantic colors are softened to prevent "alert fatigue." The success green is natural and calming, while the warning amber is refined to look intentional rather than alarming. The background uses a specific cool-grey tint (`#F8FAFC`) to reduce screen glare during long administration shifts, providing a perfect stage for white surface cards to pop with clarity.

## Typography

This design system utilizes a dual-font strategy. **Plus Jakarta Sans** is used for headings to provide a modern, slightly geometric feel that maintains a friendly but professional character. **Inter** is the workhorse for all body text and data, chosen for its exceptional legibility at small sizes and high x-height.

The hierarchy is strict: headers use a heavier weight and tighter letter-spacing to command attention, while body text uses generous line heights (1.5x) to ensure long documents and data tables are easily scannable. Labels use a subtle uppercase treatment with increased tracking to differentiate functional UI text from content.

## Layout & Spacing

The layout follows a **12-column fluid grid** with a maximum container width of 1440px to ensure data doesn't become overly stretched on ultrawide monitors. We employ a "Safe Zone" philosophy where content is grouped into distinct modules (cards) separated by 24px gutters.

The spacing rhythm is strictly based on an **8px base unit**. Component internal padding is generous (minimum 16px, standard 24px) to emphasize the "Airy" and "Clean" aesthetic. On mobile devices, the grid collapses to a single column, and side margins reduce to 16px to maximize the utility of the smaller screen real estate.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Soft Ambient Shadows**. 
- **Level 0 (Background):** The base layer is the off-white background, providing a non-distracting canvas.
- **Level 1 (Cards/Surfaces):** Main content areas are white, featuring a very soft, diffused shadow (`0 4px 20px -2px rgba(0,0,0,0.05)`) to create a subtle lift.
- **Level 2 (Modals/Dropdowns):** Interactive overlays use a slightly more pronounced shadow and a 1px border (`#E2E8F0`) to ensure they sit clearly above the card layer.

We avoid heavy drop shadows in favor of subtle border-inks and slight value shifts, ensuring the interface feels light and digital rather than heavy or skeumorphic.

## Shapes

The shape language is consistently **Rounded**. This choice is intentional; it softens the clinical nature of the data and makes the platform feel more approachable and modern. 

- Standard components (Inputs, Buttons) use `0.5rem` (8px).
- Containers and Cards use `rounded-lg` at `1rem` (16px) to clearly define content groupings.
- Decorative elements or avatars may use circular shapes, but the structural core remains consistently rounded-rectangular to maintain a professional architectural feel.

## Components

### Buttons
Primary buttons use the deep indigo background with white text for maximum contrast. They should have a subtle hover state that slightly darkens the background. Secondary buttons use a ghost style (border only) or a light grey fill to remain subservient to the primary action.

### Cards
Cards are the primary container unit. They must include a `24px` internal padding. Card headers should be separated by a subtle `1px` divider in a light grey (`#F1F5F9`) only if the content below is a dense list or table.

### Status Badges
Badges use a "Tinted" style: a 10% opacity background of the semantic color (Success, Warning, Urgent) paired with a high-contrast text version of that same color. This ensures they are visible without being visually jarring.

### Form Fields
Inputs use a white surface with a `1px` border in `#CBD5E1`. When focused, the border should shift to the primary indigo with a subtle `2px` outer glow. Labels sit above the field in `label-md` style.

### Subtle Dividers
Use dividers sparingly. When required, use `#F1F5F9` with a weight of `1px`. In many cases, whitespace alone should be used to separate content sections within a card.