# Left on the Table

**See how much search traffic a site is leaving on the table, in about a minute.**

Enter a domain and, optionally, the service it wants to win (`personal injury lawyer`, `seo consultant`) and a US
state. The scanner pulls live [DataForSEO](https://dataforseo.com) data and shows, with real numbers:

- **What the site captures today**: visits a month from its market and what that traffic is worth at ad prices
- **The whole market**: every distinct search customers make, sized in searches, organic clicks and click value
- **Who owns it**: competitors' share of the clicks, including the Google map pack when a state is selected
- **What's left on the table**: the extra visits and click value from reaching the top 3
- **A 12-month traffic projection**: conservative, expected and aggressive scenarios built on the SERP click-through curve
- **Where the money is**: the market grouped into topics, plus a sortable list of the searches to go after

It's built to be pulled up on a phone in the middle of a conversation: animated scan, mobile-first layout, one-tap share.

### ▶ [Try it](https://jourdanrombough.github.io/left-on-the-table/)

The example scans replay without an API key. To scan any domain live, tap **Add API key** and enter your DataForSEO login.

## How the numbers work

| Step | Data |
| --- | --- |
| Your footprint | `dataforseo_labs/google/domain_rank_overview`, `ranked_keywords` |
| The market | `keyword_suggestions` + `related_keywords` for the target keyword (or `keywords_for_site`), synonyms ignored |
| Local demand | `keywords_data/google_ads/search_volume` for the chosen state |
| Who owns it | `dataforseo_labs/google/serp_competitors` nationwide; live `serp/google/organic/live/advanced` checks of the 20 most valuable searches from the state's largest city when a state is chosen |

- **Clicks** use a standard organic click-through curve: about 22% for #1, 13% for #2, 9% for #3, falling to 1.5% at #10 and 0.6% on page two. When a map pack shows, organic clicks are scaled to 65% and the pack's three spots take 16%, 11% and 8%.
- **Click value** is clicks × CPC, what the same traffic would cost in Google Ads. Searches with no CPC use the market median, marked `~`.
- **Left on the table** is the extra clicks from an average top-3 position on every search where the site sits below it.
- **Close variants** that Google reports under one volume ("personal injury lawyer", "lawyer personal injury") are counted once, and searches tied to other cities or states are removed.
- **Projections** move pages along the curve (striking-distance pages to #3, the easiest untapped searches onto page one) and ramp the gain over 12 months on an S-curve.

These are estimates for sizing an opportunity, not guarantees.

## Run it on your own machine

The safest setup keeps your API password off the browser entirely:

```bash
git clone https://github.com/jourdanrombough/left-on-the-table
cd left-on-the-table
cp .env.example .env        # add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD
python3 server.py           # opens http://localhost:8765
```

On a Mac you can double-click **Start Left on the Table.command** instead. The local server only forwards a fixed list of
DataForSEO endpoints, caches responses for 7 days (re-opening a scan is free) and saves every scan to `scans/`.
A typical scan costs about $0.25 to $0.45 in DataForSEO credits. No dependencies beyond Python 3.9.

---

Built by **[Jourdan Rombough](https://optimizationtheory.com/about-jourdan-rombough-seo-web-visibility-expert/)**,
SEO and AI search strategist at [Optimization Theory](https://optimizationtheory.com).
