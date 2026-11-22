# Self-hosted fonts

Loaded with `next/font/local` in `app/layout.tsx`, so `next build` and `next dev` never contact
Google Fonts. All files are the official Google Fonts WOFF2 builds, downloaded on 22 Nov 2026 from
the URLs listed in
`https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&display=swap`.
The four files the site already used are byte-identical (SHA-256) to the ones `next/font/google`
was downloading at build time. The two italic files are new: italics were synthesised before.

| File | Font | Subset | Source |
|---|---|---|---|
| `geist-latin-var.woff2` | Geist, variable 100–900 | latin | https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMEwcGFWNOITd.woff2 |
| `geist-mono-latin-var.woff2` | Geist Mono, variable 100–900 | latin | https://fonts.gstatic.com/s/geistmono/v6/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2 |
| `cormorant-garamond-latin-var.woff2` | Cormorant Garamond, variable 300–700, upright | latin | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtKky2F7g.woff2 |
| `cormorant-garamond-latin-ext-var.woff2` | Cormorant Garamond, variable 300–700, upright | latin-ext (carries ₦, U+20A6) | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYp3tKky2F7i6C.woff2 |
| `cormorant-garamond-italic-latin-var.woff2` | Cormorant Garamond, variable 300–700, italic | latin | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtImSqn7B6D.woff2 |
| `cormorant-garamond-italic-latin-ext-var.woff2` | Cormorant Garamond, variable 300–700, italic | latin-ext | https://fonts.gstatic.com/s/cormorantgaramond/v21/co3ZmX5slCNuHLi8bLeY9MK7whWMhyjYrEtGmSqn7B6DxjY.woff2 |

Licences: SIL Open Font License 1.1, copied from the google/fonts repository:
- `OFL-geist.txt` (https://raw.githubusercontent.com/google/fonts/main/ofl/geist/OFL.txt)
- `OFL-geistmono.txt` (https://raw.githubusercontent.com/google/fonts/main/ofl/geistmono/OFL.txt)
- `OFL-cormorantgaramond.txt` (https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/OFL.txt)

Upstream projects: https://github.com/vercel/geist-font and https://github.com/CatharsisFonts/Cormorant.

Geist and Geist Mono ship the latin subset only, as before (the earlier setup requested
`subsets: ['latin']`; Google's extra subsets were declared but never preloaded). Characters
outside latin fall back to the metric-matched system fallback.
