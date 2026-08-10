---
name: Pitch Dynamic
colors:
  surface: '#121413'
  surface-dim: '#121413'
  surface-bright: '#383a38'
  surface-container-lowest: '#0d0f0e'
  surface-container-low: '#1a1c1b'
  surface-container: '#1e201f'
  surface-container-high: '#282a29'
  surface-container-highest: '#333534'
  on-surface: '#e2e3e0'
  on-surface-variant: '#b9ccb2'
  inverse-surface: '#e2e3e0'
  inverse-on-surface: '#2f3130'
  outline: '#84967e'
  outline-variant: '#3b4b37'
  surface-tint: '#00e639'
  primary: '#ebffe2'
  on-primary: '#003907'
  primary-container: '#00ff41'
  on-primary-container: '#007117'
  inverse-primary: '#006e16'
  secondary: '#b5ccc0'
  on-secondary: '#20342c'
  secondary-container: '#394d44'
  on-secondary-container: '#a7beb2'
  tertiary: '#f9f9f9'
  on-tertiary: '#2f3131'
  tertiary-container: '#dcdddd'
  on-tertiary-container: '#5f6161'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#72ff70'
  primary-fixed-dim: '#00e639'
  on-primary-fixed: '#002203'
  on-primary-fixed-variant: '#00530e'
  secondary-fixed: '#d0e8dc'
  secondary-fixed-dim: '#b5ccc0'
  on-secondary-fixed: '#0b1f18'
  on-secondary-fixed-variant: '#374b42'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#121413'
  on-background: '#e2e3e0'
  surface-variant: '#333534'
typography:
  display-lg:
    fontFamily: Anton
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Anton
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 36px
    letterSpacing: 0.01em
  headline-lg-mobile:
    fontFamily: Anton
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 32px
  stats-xl:
    fontFamily: Archivo Narrow
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 40px
  body-md:
    fontFamily: Archivo Narrow
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  grid-margin: 16px
  grid-gutter: 12px
---

## As telas desenhadas

Este arquivo veio do Google Stitch, exportado em 10/08/2026, e é a origem do
visual do Tabelaço. As quatro telas que o acompanham estão em `img/stitch/`:

| Imagem | Tela |
| --- | --- |
| `img/stitch/competition_hub.png` | escolha do campeonato |
| `img/stitch/team_directory.png` | lista de clubes, com busca |
| `img/stitch/team_profile.png` | página do time |
| `img/stitch/mascot_spotlight.png` | galeria de mascotes |

Das quatro, o app hoje segue o **estilo** de todas, mas só implementa a primeira
ideia (a escolha do campeonato). A galeria de mascotes e a página do time ainda
não existem — dependem de os mascotes ficarem prontos.

Uma diferença combinada com o Annibal: o verde neon abaixo **não** é usado. O
destaque do app é sempre a cor do time do coração, calculada em `pintar()`. O que
veio do Stitch é o preto, as fontes e o arranjo.

## Brand & Style

The design system is engineered for the high-velocity world of football. It targets passionate fans who demand real-time data delivered with the intensity of a live broadcast. The aesthetic is **High-Contrast & Kinetic**, blending the technical precision of sports analytics with the raw energy of the stadium.

The UI leverages a **Modern-Corporate** structure for reliability but injects **Digital-Brutalist** elements—such as heavy weight typography and sharp accents—to evoke the feeling of "the match." Large-scale imagery of athletes and pitch textures are layered behind glassmorphic overlays to create a deep, immersive environment that feels like a premium broadcasting suite.

## Colors

The palette is anchored in a "Pitch Black" environment to maximize contrast and reduce eye strain during night matches. 

- **Primary (Electric Pitch):** A vibrant, high-vis green used for critical actions, live indicators, and progress tracking. It represents the grass under floodlights.
- **Secondary (Deep Turf):** A muted, dark forest green used for surface containers and subtle grouping.
- **Tertiary (Pure White):** Used exclusively for high-priority data and headlines to ensure maximum legibility against dark backgrounds.
- **Neutral (Obsidian):** The foundation of the UI, providing a sophisticated, "broadcast-booth" feel.

Apply a 10% opacity primary tint to surfaces to indicate interactivity or "active" match states.

## Typography

Typography prioritizes speed of recognition. **Anton** provides a commanding, news-ticker presence for scores and major headlines. **Archivo Narrow** is utilized for lists and dense player data, allowing more information to fit horizontally without sacrificing legibility. **JetBrains Mono** is reserved for technical data points (timestamps, VAR decisions, coordinates), leaning into the "analytical" side of the sport.

All headlines should be set in Uppercase to maintain a high-energy, "breaking news" posture.

## Layout & Spacing

This design system utilizes a **Fluid Grid** model based on a 4px baseline rhythm. 

- **Mobile:** 4-column grid with 16px margins.
- **Desktop:** 12-column grid with 24px margins.

Layouts should feel dense but organized. Use "Power Margins" (xl spacing) to separate major sections like "Live Matches" from "News," but keep internal card elements tight (sm/md spacing) to reflect the compact nature of sports scoreboards.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** rather than traditional shadows. 

1. **Floor:** The Obsidian neutral base.
2. **Field:** Deep Turf containers for secondary content.
3. **Player:** Glassmorphic cards with a 1px inner border (Primary color at 20% opacity) for active match events or high-priority stats.
4. **Spotlight:** High-contrast Electric Pitch highlights for live indicators.

Use backdrop blurs (12px - 20px) on sticky navigation bars and score overlays to maintain a sense of depth as the user scrolls through match-day content.

## Shapes

The shape language is **Soft** but disciplined. Standard UI elements like team cards and buttons use a 0.25rem radius. This mimics the chamfered edges of modern stadium architecture and digital scoreboards. 

Avoid fully circular buttons unless they are floating action buttons (FABs); instead, use "clipped-corner" motifs for competition badges to suggest movement and speed.

## Components

- **Team Cards:** Use a vertical gradient background (Obsidian to Deep Turf). Include a prominent 1px "Live Stroke" in Electric Pitch if the team is currently playing.
- **Competition Badges:** Small, high-contrast badges using JetBrains Mono for the tier name (e.g., "UCL", "PL"). Use a metallic finish effect for trophy icons.
- **Live Match Strip:** A full-width component with a pulsing Electric Pitch dot. The score should be in Anton, centered, with team crests flanking the numbers.
- **Mascot Illustrations:** Rendered in a high-action, "vector-shards" style with aggressive lighting to match the high-contrast theme.
- **Input Fields:** Darker than the background with an Electric Pitch focus state. Use Monospaced fonts for numerical inputs (e.g., betting odds or jersey numbers).
- **Action Buttons:** Primary buttons are solid Electric Pitch with Black text. Secondary buttons are outlined with 1px Tertiary borders.