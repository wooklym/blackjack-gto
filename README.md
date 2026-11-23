# Blackjack Chart

Live site: **https://blackjackchart.app**

Mathematically optimal blackjack basic-strategy charts for every common rule set, as a fast static site in 12 languages.

- **72 rule sets**: 1 / 2 / 4 / 6 / 8 / infinite decks × S17 / H17 × DAS / no DAS × late surrender / no surrender, plus European no-hole-card (ENHC) variants
- **Three charts per rule set**: hard totals, soft totals, pairs (surrender included in the chart)
- **Quick hand lookup** and a **"what changes when the rules change"** comparison on every page
- **12 languages**: English, 한국어, 日本語, 简体中文, 繁體中文, Español, Português, Français, Deutsch, Русский, Tiếng Việt, ไทย

## How the charts are computed

`engine/strategy.js` calculates the exact expected value of every action (hit, stand, double, split, surrender) for each two-card hand against each dealer upcard, removing dealt cards from a finite shoe (or drawing with replacement for the infinite-deck charts). The chart shows the highest-EV action per total, weighted over two-card compositions.

Assumptions: no resplitting, one card on split aces, and with a hole card the dealer peeks for blackjack under ten and ace. In ENHC games the player loses all doubled and split bets to a dealer blackjack.

`npm test` checks the output against well-known published charts.

## Development

No dependencies – only Node.js 18+.

```bash
npm run compute
```

Recomputes `data/strategy.json` (about a minute; the result is committed).

```bash
npm test
```

```bash
npm run build
```

Generates the site into `dist/` (877 pages, sitemap, robots.txt). Canonical and hreflang URLs use `https://blackjackchart.app`; set `SITE_URL` to build for another origin.

## SEO

Each page has a localized title and description, a canonical URL, `hreflang` alternates for all languages plus `x-default`, Open Graph and Twitter tags, and JSON-LD (`WebSite`, `FAQPage`, `BreadcrumbList`, `Article`). `sitemap.xml` lists every URL with its language alternates.

## Adding a language

1. Copy `src/i18n/en.json` to `src/i18n/<code>.json` and translate it.
2. Add the language to `LANGS` in `build.js`.

## Disclaimer

For education and entertainment only. No strategy removes the house edge. Gamble responsibly and only where it is legal.

## License

MIT
