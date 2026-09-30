---
name: Rankr Web
description: A dark personal media journal spanning marketing and the web application.
colors:
  bg: "#14181c"
  surface: "#1b2026"
  text: "#f4f4f6"
  muted: "#b7bac9"
  accent: "#7651e4"
  accent-text: "#b19afa"
  rule: "#373d48"
  button-text: "#fff"
  button-hover: "#6540cd"
  focus: "#bdadff"
  preview-bg: "#171b20"
  preview-border: "#42464f"
  selection-bg: "#30263e"
  selection-text: "#c1affd"
  feature-icon-bg: "#272a35"
  step-bg: "#1c2027"
  step-border: "#363b45"
  step-number-bg: "#704ad7"
  comparison-border: "#414752"
  choice-bg: "#232831"
  choice-selected: "#b49afb"
  choice-muted: "#c6c0d7"
  choice-selected-text: "#d2c4ff"
  app-border-soft: "#2b313a"
  app-border-strong: "#545966"
  app-error-text: "#ff8585"
  app-error-bg: "#2a1a1a"
  app-error-border: "#3a2020"
typography:
  display:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "clamp(40px,4.2vw,64px)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-.025em"
  title:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-.015em"
  body:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.6
  feature-body:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  section-body:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "16px"
    lineHeight: 1.8
  button:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.6
  app-h1:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "38px"
  app-h2:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "32px"
  app-h3:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "26px"
  app-body:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
  app-body-bold:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "22px"
  app-small:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  app-caption:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "17px"
  app-input:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "16px"
  app-auth-action:
    fontFamily: "Rankr Inter, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
rounded:
  control: "8px"
  sidebar-control: "6px"
  cover: "5px"
  panel: "14px"
  preview-top: "16px 16px 0 0"
  app-md: "10px"
  app-xl: "20px"
  app-pill: "999px"
spacing:
  control-gap: "20px"
  panel-inset: "24px"
  mobile-panel-inset: "18px"
  section-column-gap: "90px"
  compact-section-column-gap: "40px"
  app-xs: "4px"
  app-sm: "8px"
  app-md: "12px"
  app-lg: "16px"
  app-xl: "24px"
  app-xxl: "32px"
  app-xxxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.button-text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "{colors.button-hover}"
  button-small:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.button-text}"
    rounded: "{rounded.control}"
    padding: "10px 20px"
  category-selector:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "12px 8px"
  category-selector-selected:
    textColor: "{colors.accent-text}"
  sidebar-selector-selected:
    backgroundColor: "{colors.selection-bg}"
    textColor: "{colors.selection-text}"
    rounded: "{rounded.sidebar-control}"
    padding: "10px 9px"
  step-card:
    backgroundColor: "{colors.step-bg}"
    rounded: "{rounded.panel}"
    padding: "24px"
  comparison-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px"
  comparison-choice:
    backgroundColor: "{colors.choice-bg}"
    textColor: "{colors.button-text}"
    rounded: "{rounded.control}"
    padding: "0 0 10px"
  app-auth-action:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.button-text}"
    typography: "{typography.app-auth-action}"
    rounded: "{rounded.control}"
    height: "52px"
  app-auth-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.button-text}"
    typography: "{typography.app-input}"
    rounded: "{rounded.control}"
    height: "52px"
  app-wordmark:
    textColor: "{colors.text}"
---

# Design System: Rankr Web

## Overview

**Creative North Star: "Personal media journal"**

Rankr’s marketing world is a personal media journal: ink charcoal, near-white text, violet actions, geometric sans typography, and real archival imagery. The dark frame lets cover art supply variety while type and restrained controls organize the page.

The approved world now extends from marketing into web authentication and signed-in screens. The landing composition and its tokens remain intact in app/landing.web.tsx and lib/landing.css. Application screens receive matching web colors through lib/theme.ts and Inter through app/+html.tsx, while retaining their operational type sizes and layouts. Native retains its existing palette and platform font. Frontmatter app-prefixed entries document application roles; unprefixed entries preserve the landing system.

**Key Characteristics:**

- Dark neutral framing with violet actions and pale violet selection cues.
- Locally hosted Inter in three supplied weights.
- Dense ranked-media previews alongside quieter explanatory content.
- Small rounded controls, bordered containers, and limited photographic depth.

## Colors

Violet sits against cool charcoal, with near-white content and softer gray supporting copy. Frontmatter records extracted values; the first seven colors preserve the marketing stylesheet’s custom-property names. Other names describe literal values already used by components, not new CSS variables.

### Primary

**Accent** supplies primary actions. **Accent text** supplies links, selected category labels, and supporting icons. Selected comparison choices and sidebar rows use their own pale-violet foreground and border treatments.

### Neutral

**Background** frames the page, **surface** holds the comparison panel, and **preview background** houses the ranked collection. **Text** and **muted** establish content hierarchy; **rule** divides major sections. Container-specific borders remain local to their components.

**The Scope Rule.** Marketing and the web application share the approved palette and Inter family, but retain separate layout and component sources. Use lib/theme.ts for application screens; preserve its intentional native branch.

Web theme mapping: `bg` uses background; `bgDeeper` uses preview background; `card` and `overlay` use surface; `cardElevated` uses choice background; `border` uses rule; secondary, muted, and placeholder text use muted; `purple`, `purpleLight`, `purpleSoft`, and `purpleDeep` map to accent, accent text, selection background, and button hover. The app-specific soft and strong borders are recorded separately. Semantic status and sentiment colors remain defined by lib/theme.ts and are inherited by both platforms. Native retains its darker violet-neutral palette rather than receiving these web overrides.

## Typography

**Display and body font:** locally hosted Rankr Inter, followed by Arial and sans-serif fallbacks. The stylesheet supplies regular, semibold, and extra-bold font files. Fallbacks are loading resilience, not a separate display identity.

The display is compact and extra-bold, with tighter tracking than body copy. Section headlines retain the same family and weight. Feature titles use semibold; supporting content relaxes the line height. The frontmatter’s headline role describes collection and ranking headings; other section headings range from 40 to 42px on desktop. Preview headings use 22px, and its dense title and metadata labels use smaller sizes specific to that demonstration.

The display clamp is the base rule, overridden by explicit viewport rules: 68px from 1700px, 48px through 1100px, 42px through 760px, and 36px through 390px. Collection and ranking headlines become 36px through 760px. Do not infer a mathematical type scale from these observed sizes.

Web application text inherits Inter directly from root HTML, including direct-route visits; explicit font-family declarations, such as icon fonts, are preserved. Root font-face rules map the supplied regular file to 400, semibold to the 500–700 range, and extra-bold to 800–900. These are three supplied files, not independently supplied files for every declared weight. Application theme roles in frontmatter retain their smaller operational ramp. Native uses the platform font because the web root stylesheet does not apply there.

## Layout

The marketing wrapper is capped at 1200px with 72px total horizontal clearance. Clearance decreases to 48px at 1100px, 40px at 760px, and 32px at 390px. Features and ordered steps use three columns on desktop and one column through 760px. Collection and ranking sections use equal columns with the recorded section gap, compact it through 1100px, and stack through 760px.

The ranked preview is normally capped at 904px, becomes 1020px from 1700px, and is constrained to the available width. Its desktop sidebar is 162px wide, compacts to 140px through 1100px, and disappears through 760px. Six cover columns become three through 760px and two through 390px. The actual implementation therefore differs from the earlier brief’s broad two-column mobile description. Desktop covers use a 4:5 crop from 1101px; smaller views use 2:3. Recheck focal points when supplying new imagery.

Decorative edge covers disappear through 1100px. The header’s section navigation disappears through 760px while account links remain. These are observed landing behaviors, not required layouts for every future screen.

Authentication uses a 488px outer maximum with 24px padding, leaving a 440px form measure; scrollable content accommodates smaller screens. The signed-in web shell shows a 224px sidebar from 1024px and labeled bottom navigation below that threshold. The home feed caps its main column at 640px; the wide container caps at 1120px and has a 300px suggestions rail. These application measurements are independent of the marketing wrapper.

## Elevation & Depth

Tonal layering and fine borders create most depth. Decorative edge covers add the sole explicit marketing box-shadow (`0 16px 24px #0003`), dimming, overlap, and rotation. Comparison and step panels stay border-defined. The application theme has its own black elevation and purple glow tokens; those are not used by this marketing stylesheet.

The gallery uses a brief entrance from partial opacity and an 8px downward offset, and buttons transition their background. Reduced-motion preference removes animations, transitions, and smooth scrolling. Exact motion definitions are retained in the sidecar.

Web login fields and primary actions omit the native purple glow; the login primary action also omits the native black shadow. Keep these distinctions local to the actual component rather than assuming the theme’s retained shadow and glow exports apply everywhere. Global web focus is a 3px pale-violet outline with 4px offset, and root reduced-motion rules shorten animation and transition duration to .01ms. Landing’s stricter scoped motion removal remains in place.

## Shapes

Controls, feature-icon tiles, and comparison choices use the control radius. Sidebar controls use a smaller corner; covers use a still tighter corner. Step and comparison panels use the panel radius. The preview rounds only its top corners and opens into the section boundary; its top radius becomes 12px through 760px. Circular numbered markers serve ordered steps. Artwork, not a universal card wrapper, supplies the visual variety.

## Components

### Buttons

Primary links are filled violet, white, semibold, and centered with an inline arrow where shown. Normal controls have a 50px minimum height, reduced to 48px through 760px. The compact header variant has a 42px minimum height and 12px text. Hover darkens the fill. Focus uses the marketing focus color; the root stylesheet supplies a 3px outline with 4px offset. Disabled buttons show half opacity and a default cursor.

Application authentication actions are 52px high with the control radius and 16px bold labels. The web role-button hover brightens to 1.08; disabled role controls use half opacity. This is distinct from the landing link’s darker hover fill.

### Category selectors

The top group uses native buttons with muted labels and inline SVGs. The current category has pale-violet text and a matching bottom border. Through 760px, icons stack above labels. Sidebar selectors express the same state with a softly tinted fill. Both use `aria-pressed` and control the same collection state; they are selectors rather than decorative chips.

### Cards / Containers

Step cards have a fine border, panel corners, and the recorded inset, with a circular sequence marker. Comparison panels share the panel silhouette but use their own surface and border. The ranked preview is a distinct framed app demonstration containing an ordered list, category sidebar, and sample labeling. Preview metadata’s small text sizes are not canonical body or input sizes.

### Inputs / Fields

The landing has no input component. Web authentication fields use the application surface, control radius, a 52px wrapper, 14px horizontal inset, and a 1px theme border. In login, focus changes that border to 1.5px accent without the native glow. Entered text is white at 16px; supporting labels and messages remain separate from the field. Error feedback uses the recorded dark-red fill and border with lighter red text. Use the application components rather than inventing a landing input style.

### Navigation

The wordmark pairs the Rankr name with a two-bar inline SVG mark. Desktop navigation is compact, with muted hierarchy and pale-violet link hover. Footer navigation wraps, and the bottom row stacks on small screens. The skip link becomes visible on focus. Native links and buttons remain operable by keyboard.

The shared application BrandWordmark renders two pale-violet bars (8px wide, 18px and 28px high, 2px corners, 4px gap) beside a 28px extra-bold name with -0.8px tracking. Its two bars share one color; the landing SVG retains its original two-tone mark. This is an intentional implementation distinction, not a claim of identical geometry.

### Head-to-head comparison

Two real film choices sit side by side. A selected choice has a pale-violet border and a visible “Your pick” label, so state is not communicated only by color. Choosing a film selects the Movies category and updates the sample order; reset clears the choice. The status text is announced through a live status role. This is an in-page demonstration, with no persistence or network submission in its handler.

Media comes from lib/marketing-media.json: real titles, local image paths, alternatives, creators, sources, licenses, and modifications. The current set records public-domain imagery plus one CC BY-SA 3.0 game screenshot, with credits exposed at /image-credits. This document records those provenance fields, not an independent legal review.

## Do's and Don'ts

### Do:

- Do use the marketing tokens below for extensions of the landing surface.
- Do use lib/theme.ts for application colors and preserve its web/native platform split.
- Do keep real headings, links, buttons, and list semantics in the interface.
- Do provide meaningful alternatives for content images and empty alternatives for decorative repeats.
- Do retain sample-data labeling and image provenance when reusing marketing media.
- Do preserve keyboard operation, visible focus, and reduced-motion behavior.

### Don’t:

- Don’t treat the approved composition as a raster interface; the build uses real HTML.
- Don’t assume every media category has twelve examples; use the actual catalog length.
- Don’t generalize preview microcopy sizes into body or form typography.
- Don’t substitute uncredited artwork or infer that an image’s title grants reuse rights.
- Don’t apply the web palette or root font rules to native without a separate authorized change.
