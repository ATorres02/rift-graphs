# Rift Graphs · Kit de logo

Logo: tres carriles vistos desde arriba (carril azul y carril rojo, como los dos lados de una partida) con una línea de gráfica blanca que sube de base a base. Todos los SVG tienen el texto convertido en trazos, así que no dependen de ninguna fuente instalada.

## Archivos

| Archivo | Uso |
| --- | --- |
| `svg/logo-horizontal-dark.svg` | Logo principal (símbolo + nombre) para fondos oscuros. Cabecera de la web en modo oscuro. |
| `svg/logo-horizontal-light.svg` | Igual, para fondos claros (modo claro). |
| `svg/logo-mark.svg` | Solo el símbolo, para fondos oscuros (móvil, espacios pequeños). |
| `svg/logo-mark-light.svg` | Solo el símbolo, para fondos claros. |
| `svg/icon.svg` | Símbolo dentro de cuadrado azul eléctrico (icono de app). |
| `svg/og-image.svg` | Fuente de la imagen para compartir en redes. |
| `png/*` | Versiones PNG con fondo transparente (excepto `og-image.png`), para redes, LinkedIn, etc. |
| `favicon/*` | Favicons, iconos de app y manifest. |

## Paleta

| Uso | Color |
| --- | --- |
| Fondo de marca (azul marino) | `#070B24` |
| Azul eléctrico (carril azul, "rift") | `#5B74FF` |
| Rojo (carril rojo, "graphs") | `#FF5A6E` |
| Línea / texto claro | `#F2F4FF` |
| Fondo del icono | `#2F45E8` |
| Versión clara: azul / rojo / tinta | `#2F45E8` / `#D93A4E` / `#070B24` |

Tipografía del nombre: Space Grotesk Bold (Google Fonts), interletraje -0.02em. Se puede usar la misma fuente para los títulos de la web.

## Instrucciones para Claude Code

1. Copia `favicon/favicon.ico`, `favicon/favicon.svg`, `favicon/apple-touch-icon.png`, `favicon/icon-192.png`, `favicon/icon-512.png` y `favicon/site.webmanifest` a `public/` (raíz del sitio).
2. Copia `svg/logo-horizontal-dark.svg`, `svg/logo-horizontal-light.svg`, `svg/logo-mark.svg` y `svg/logo-mark-light.svg` a `public/brand/`, y `png/og-image.png` a `public/og-image.png`.
3. En el layout raíz (Next.js `app/layout.tsx`, `metadata`), declara:
   - `icons`: `{ icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/favicon.svg', type: 'image/svg+xml' }], apple: '/apple-touch-icon.png' }`
   - `manifest: '/site.webmanifest'`
   - `themeColor: '#070B24'` (en `viewport` si la versión de Next lo pide ahí)
   - `openGraph.images` y `twitter.images`: `/og-image.png` (1200×630). Si ya se generan imágenes OG dinámicas por página, usa esta como imagen por defecto.
4. Cabecera: usa `logo-horizontal-dark.svg` en modo oscuro y `logo-horizontal-light.svg` en modo claro (con `<picture>` y `prefers-color-scheme`, o según el tema activo). Altura recomendada 28–32 px en escritorio. En pantallas estrechas (< 400 px) muestra solo el símbolo (`logo-mark*.svg`). El enlace del logo lleva a la portada y tiene `aria-label="Rift Graphs, inicio"`.
5. Añade a los tokens de diseño de la web los colores de la paleta: fondo `#070B24` en modo oscuro; `#5B74FF` como acento principal y `#FF5A6E` como acento secundario. Por coherencia con el logo, el lado azul de las partidas usa el azul de marca y el lado rojo el rojo de marca.
6. No deformes el logo ni cambies sus colores fuera de estas dos variantes; deja un margen libre alrededor de al menos la mitad de la altura del símbolo.
7. Nada de logos o marcas de Riot junto al logo (ver "Marco legal" en SPEC.md).
