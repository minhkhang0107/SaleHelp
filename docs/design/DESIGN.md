# Design System: Social QA Auto-Responder

## 1. Visual Theme & Atmosphere
A restrained, data-dense cockpit interface with confident asymmetric layouts and fluid spring-physics motion. The atmosphere is clinical, professional, and utilitarian — like a well-lit architecture studio or a modern air traffic control dashboard. It prioritizes readability and quick actions over decoration.

Density: 7 (Dashboard Dense)
Variance: 6 (Offset Asymmetric)
Motion: 6 (Fluid CSS)

## 2. Color Palette & Roles
- **Canvas White** (`#F9FAFB`) — Primary background surface, used for the main app canvas.
- **Pure Surface** (`#FFFFFF`) — Card, modal, and container fill to stand out from the canvas.
- **Charcoal Ink** (`#18181B`) — Primary text, headings, and high-contrast UI elements.
- **Muted Steel** (`#71717A`) — Secondary text, metadata, descriptions, and disabled states.
- **Whisper Border** (`rgba(226, 232, 240, 0.5)`) — Subtle structural dividers, table borders, and card outlines.
- **Sapphire Accent** (`#2563EB`) — Single primary accent color for active states, CTAs, focus rings, and selected indicators. (Max 1 accent. Saturation < 80%. No purple/neon).
- **Alert Crimson** (`#DC2626`) — For critical alerts, "Human Takeover" active mode, and low confidence score (< 0.70) indicators.
- **Safe Emerald** (`#16A34A`) — For success states and high confidence score (> 0.85) indicators.

## 3. Typography Rules
- **Display/Headlines:** `Geist` — Track-tight, controlled scale. Hierarchy is driven by font weight (Semibold/Bold) and color (Charcoal Ink), not massive font sizes.
- **Body:** `Geist` — Relaxed leading (1.5), maximum 65 characters per line for optimal readability. Muted Steel color for secondary information.
- **Mono:** `JetBrains Mono` — Used strictly for code snippets, JSON payloads, Webhook URLs, Confidence Scores, and timestamps.
- **Banned:** `Inter`, `Times New Roman`, `Georgia`, any generic serif fonts. No serif fonts in this dashboard. No oversized gradient typography.

## 4. Component Stylings
- **Buttons:** Flat design, absolutely no outer glows or drop shadows. Tactile `-1px` vertical translate on active/press state. Primary buttons use Sapphire Accent fill with white text. Secondary buttons use ghost/outline styling with Muted Steel border.
- **Cards & Containers:** Softly rounded corners (`0.75rem` / `12px`). Diffused whisper shadow for elevation ONLY when it overlaps other content (like a dropdown). For the main dashboard grid, use flat borders (`Whisper Border`) instead of shadows to manage high density.
- **Inputs & Textareas:** Label positioned above the input, error messages below. Focus ring uses `2px` solid Sapphire Accent. No floating labels.
- **Badges/Tags:** Pill-shaped (`rounded-full`), small text (`0.75rem`). Used for Confidence Scores and Platform tags (Zalo, Messenger).
- **Loaders:** Skeletal shimmer animations matching the exact layout dimensions of the content being loaded. No generic circular spinners.
- **Empty States:** Composed, clean compositions with a subtle muted icon and clear next-step CTA. Not just bare "No data" text.

## 5. Layout Principles
- **Grid-First Architecture:** Use strict CSS Grid layouts. No flexbox percentage math (`calc()`).
- **Spatial Separation:** No overlapping elements. Every component, chat bubble, and sidebar occupies its own clear spatial zone.
- **Split Screen Design:** The Chat Dashboard uses a 3-column asymmetric layout: Sidebar (20%), Chat Window (50%), Details/Knowledge Base panel (30%).
- **Responsive Collapse:** Mobile-first approach (< 768px). The 3-column layout strictly collapses into a single column. No horizontal scrolling.
- **Full Height Constraints:** Dashboard containers use `min-h-[100dvh]` instead of `100vh` to prevent iOS Safari jumping.

## 6. Motion & Interaction
- **Spring Physics:** Default animation curve for all interactive elements: `stiffness: 100, damping: 20`. Premium, weighty feel. No linear easing.
- **Staggered Orchestration:** Chat messages and lists mount with cascading waterfall delays, never instantly.
- **Performance:** Animate exclusively via `transform` and `opacity`. Never animate `width`, `height`, `top`, or `left`.

## 7. Anti-Patterns (BANNED)
- NO emojis anywhere in the UI.
- NO `Inter` font.
- NO pure black (`#000000`).
- NO neon, outer glows, or colored drop shadows.
- NO 3-column equal card layouts (use asymmetric or list layouts instead).
- NO generic placeholder names ("John Doe", "Acme").
- NO AI copywriting clichés ("Elevate your workflow", "Unleash power").
- NO filler UI text ("Scroll to explore", bouncing chevrons).
- NO overlapping floating action buttons that block text.
