# Input

Tài liệu này chuẩn hóa các tham số input của actor `compass/crawler-google-places`.

## Input Fields

### Search term(s)

- Label: `Search term(s)`
- Key: `searchStringsArray`
- Type: `array`
- Required: optional

Type what you would normally search for in the Google Maps search bar, such as `English breakfast` or `pet shelter`.

Notes:

- Prefer unique terms for faster processing.
- Using similar terms like `bar`, `restaurant`, and `cafe` may increase coverage slightly, but is less efficient.
- If searching for a specific place, also specify `locationQuery` for more reliable geographic targeting.
- Do not append the location directly into the search term if you need scale. For example, `restaurant Pittsburgh` may limit the scrape to 120 results per term because of Google Maps scroll limits.
- Direct place IDs are also supported in this field using the format `place_id:ChIJ8_JBApXMDUcRDzXcYUPTGUY`.

### Location (use only one location per run)

- Label: `Location`
- Key: `locationQuery`
- Type: `string`
- Required: optional

Define the location using free text. Simpler formats work better, for example `City + Country` instead of `City + Country + State`.

Notes:

- Always specify location when searching for specific place names.
- Validate the target area using OpenStreetMap if needed.
- Automatically detected city polygons may be smaller than expected and may exclude agglomeration areas.
- If you need more control, use geolocation fields or `customGeolocation`.
- `locationQuery` takes priority over geolocation fields, so do not combine both unless you know the override behavior you want.

### Number of places to extract (per each search term or URL)

- Label: `Number of places to extract`
- Key: `maxCrawledPlacesPerSearch`
- Type: `integer`
- Required: optional
- Minimum: `1`

Defines how many results to extract per search term, category, or URL. Larger values increase runtime.

Notes:

- Leave empty to scrape all available places.
- Can also be combined with the `allPlacesNoSearchAction` behavior.

### Language

- Label: `Language`
- Key: `language`
- Type: `string`
- Required: optional
- Default: `en`
- Example: `en`

Controls the language used in result details.

Supported options:

```text
en, af, az, id, ms, bs, ca, cs, da, de, et, es, es-419, eu, fil, fr, gl, hr, zu,
is, it, sw, lv, lt, hu, nl, no, uz, pl, pt-BR, pt-PT, ro, sq, sk, sl, fi, sv, vi,
tr, el, bg, ky, kk, mk, mn, ru, sr, uk, ka, hy, iw, ur, ar, fa, am, ne, hi, mr,
bn, pa, gu, ta, te, kn, ml, si, th, lo, my, km, ko, ja, zh-CN, zh-TW
```

### Place categories ($)

- Label: `Place categories`
- Key: `categoryFilterWords`
- Type: `string[]`
- Required: optional

Limits scraped places using category filters. Multiple categories can be supplied for one flat fee for this field.

Notes:

- Category filtering can cause false negatives.
- Google Maps has more than 4,000 categories and many are near-synonyms.
- Include all synonyms you care about, for example `divorce lawyer`, `divorce attorney`, `divorce service`.

### Get exact name matches (no similar results) ($)

- Label: `Get exact name matches`
- Key: `searchMatching`
- Type: `string`
- Required: optional
- Default: `all`

Restricts matching behavior between place name and provided search terms.

Options:

- `all`
- `only_includes`
- `only_exact`

### Set a minimum star rating ($)

- Label: `Set a minimum star rating`
- Key: `placeMinimumStars`
- Type: `string`
- Required: optional

Scrape only places with rating equal to or above the selected threshold. Places without reviews are skipped.

Options:

- `two`
- `twoAndHalf`
- `three`
- `threeAndHalf`
- `four`
- `fourAndHalf`

### Scrape places with/without a website ($)

- Label: `Scrape places with/without a website`
- Key: `website`
- Type: `string`
- Required: optional
- Default: `allPlaces`

Options:

- `allPlaces`
- `withWebsite`
- `withoutWebsite`

### Skip closed places ($)

- Label: `Skip closed places`
- Key: `skipClosedPlaces`
- Type: `boolean`
- Required: optional
- Default: `false`

Skips places marked as temporarily or permanently closed.

### Scrape place detail page ($)

- Label: `Scrape place detail page`
- Key: `scrapePlaceDetailPage`
- Type: `boolean`
- Required: optional
- Default: `false`

Scrapes each place detail page individually. This slows the actor down because an extra page must be opened for each place.

Fields available only when enabled include:

- `reviewsDistribution`
- `imageCategories`
- `popularTimes`
- `openingHours`
- `BusinessConfirmationText`
- `peopleAlsoSearch`
- `reviewsTags`
- `updatesFromCustomers`
- `questionsAndAnswers`
- `tableReservationLinks`
- `orderBy`
- `ownerUpdates`
- hotel fields

Notes:

- Also ensures that `reviewsCount` is scraped.
- Must be enabled to use several downstream detail-dependent options.

### Scrape table reservation provider data ($)

- Label: `Scrape table reservation provider data`
- Key: `scrapeTableReservationProvider`
- Type: `boolean`
- Required: optional
- Default: `false`

Scrapes table reservation provider data such as name, address, email, or phone when the place has the blue `RESERVE A TABLE` button.

### Include "Web results" ($)

- Label: `Include "Web results"`
- Key: `includeWebResults`
- Type: `boolean`
- Required: optional
- Default: `false`

Extracts the `Web results` section shown at the bottom of a place listing.

### Scrape inside places (e.g. malls or shopping center) ($)

- Label: `Scrape inside places`
- Key: `scrapeDirectories`
- Type: `boolean`
- Required: optional
- Default: `false`

Scrapes businesses located inside a parent place such as malls or shopping centers, using the `Directory` or `At this place` sections.

Note:

- Full place details must be scraped for this to work.

### Number of questions to extract ($)

- Label: `Number of questions to extract`
- Key: `maxQuestions`
- Type: `integer`
- Required: optional
- Minimum: `0`
- Default: `0`

Defines how many questions per place should be scraped.

Rules:

- Leave empty or use `0` to scrape only the first question and answer.
- Use `999` to attempt extracting all questions.
- Some question fields may contain personal data.

### Add-on: Company contacts enrichment (from website) ($)

- Label: `Company contacts enrichment`
- Key: `scrapeContacts`
- Type: `boolean`
- Required: optional
- Default: `false`

Enriches Google Maps places with contact details extracted from the business website, including emails and social media profiles.

Notes:

- Pricing depends on subscription tier.
- Large chains are excluded, including `mcdonalds`, `starbucks`, `dominos`, `pizzahut`, `burgerking`, `kfc`, `subway`, `wendys`, `dunkindonuts`, `tacobell`.

### Add-on: Social media profile enrichment ($)

- Label: `Social media profile enrichment`
- Key: `scrapeSocialMediaProfiles`
- Type: `object`
- Required: optional
- Default:

```json
{
  "facebooks": false,
  "instagrams": false,
  "youtubes": false,
  "tiktoks": false,
  "twitters": false
}
```

Enriches discovered social media profiles with public profile metadata such as profile name, follower counts, descriptions, post or video counts, and verification status.

Notes:

- Pricing depends on subscription plan.
- Billing is based on total enriched profiles, not number of selected platforms.
- Enabling this feature automatically enables `scrapeContacts`.
- Enriched output is available in the Social profiles output view.

### Add-on: Extract business leads information - Maximum leads per place ($)

- Label: `Maximum leads per place`
- Key: `maximumLeadsEnrichmentRecords`
- Type: `integer`
- Required: optional
- Default: `0`

Enriches results with employee and company information, including names, job titles, emails, phone numbers, LinkedIn profiles, industry, and company size.

Notes:

- `0` means no lead enrichment.
- This is a multiplier. Requesting `10` leads across `1,000` places may attempt to find `10,000` leads.
- Charges apply only to successfully found leads.
- Some fields may contain personal data and may be subject to GDPR or similar regulations.
- Large chains are excluded from this enrichment.

### Leads departments selection

- Label: `Leads departments selection`
- Key: `leadsEnrichmentDepartments`
- Type: `string[]`
- Required: optional

Filters enriched leads to specific departments such as Sales, Marketing, or C-Suite.

Note:

- Works only if `maximumLeadsEnrichmentRecords` is enabled.

### Number of reviews to extract ($)

- Label: `Number of reviews to extract`
- Key: `maxReviews`
- Type: `integer`
- Required: optional
- Minimum: `0`
- Default: `0`

Sets how many reviews to scrape per place.

Notes:

- Additional place details pricing applies because detail pages must be opened first.
- Leave empty to extract all reviews.
- Each output place item can contain at most `5,000` reviews. If there are more, duplicate place items are emitted with the next review batch.
- Enabling review extraction may slow the run.

### Extract only reviews posted after [date]

- Label: `Extract only reviews posted after [date]`
- Key: `reviewsStartDate`
- Type: `string`
- Required: optional

Supports:

- Absolute date: `2024-05-03`
- Relative date: `8 days`, `3 months`
- Absolute datetime in JSON: `2024-05-03T20:00:00`
- Relative time in JSON: `3 hours`

Important notes:

- Absolute time is interpreted in UTC, not local timezone.
- Supported relative units: minutes, hours, days, weeks, months, years.
- If this parameter is used, `reviewsSort` must be `newest`.

Reason:

- The actor stops scraping reviews as soon as it encounters the first review older than the specified threshold.

### Sort reviews by

- Label: `Sort reviews by`
- Key: `reviewsSort`
- Type: `string`
- Required: optional
- Default: `newest`

Options:

- `newest`
- `mostRelevant`
- `highestRanking`
- `lowestRanking`

### Filter reviews by keywords

- Label: `Filter reviews by keywords`
- Key: `reviewsFilterString`
- Type: `string`
- Required: optional
- Default: empty string

If specified, only reviews containing those keywords are scraped.

### Reviews origin

- Label: `Reviews origin`
- Key: `reviewsOrigin`
- Type: `string`
- Required: optional
- Default: `all`

Options:

- `all`
- `google`

### Include reviewers' data

- Label: `Include reviewers' data`
- Key: `scrapeReviewsPersonalData`
- Type: `boolean`
- Required: optional
- Default: `true`

Includes reviewer personal data such as reviewer ID, name, URL, photo URL, and review URL.

Notes:

- `reviewId` is always included regardless of this flag.
- Personal data is regulated by GDPR and similar privacy laws.

### Number of additional images to extract ($)

- Label: `Number of additional images to extract`
- Key: `maxImages`
- Type: `integer`
- Required: optional
- Minimum: `0`

Defines how many images to scrape per place.

Notes:

- Additional place details pricing applies because the actor must open the detail page.
- Leave empty to extract all images.
- Higher values slow down the run.

### Include the image authors

- Label: `Include the image authors`
- Key: `scrapeImageAuthors`
- Type: `boolean`
- Required: optional
- Default: `false`

Includes author names for each image.

Note:

- May slow down processing because each image requires extra fetching.

### Country

- Label: `Country`
- Key: `countryCode`
- Type: `string`
- Required: optional

Sets the country where extraction should run, for example `us`.

Supported options:

```text
us, af, al, dz, as, ad, ao, ai, aq, ag, ar, am, aw, au, at, az, bs, bh, bd, bb,
by, be, bz, bj, bm, bt, bo, ba, bw, bv, br, io, bn, bg, bf, bi, kh, cm, ca, cv,
ky, cf, td, cl, cn, cx, cc, co, km, cg, cd, ck, cr, ci, hr, cu, cy, cz, dk, dj,
dm, do, ec, eg, sv, gq, er, ee, et, fk, fo, fj, fi, fr, gf, pf, tf, ga, gm, ge,
de, gh, gi, gr, gl, gd, gp, gu, gt, gn, gw, gy, ht, hm, va, hn, hu, is, in, id,
ir, iq, ie, il, it, jm, jp, jo, kz, ke, ki, kp, kr, kw, kg, la, lv, lb, ls, lr,
ly, li, lt, lu, mo, mk, mg, mw, my, mv, ml, mt, mh, mq, mr, mu, yt, mx, fm, md,
mc, mn, me, ms, ma, mz, mm, na, nr, np, nl, an, nc, nz, ni, ne, ng, nu, nf, mp,
no, om, pk, pw, ps, pa, pg, py, pe, ph, pn, pl, pt, pr, qa, re, ro, ru, rw, sh,
kn, lc, pm, vc, ws, sm, st, sa, sn, rs, sc, sl, sg, sk, si, sb, so, za, gs, ss,
es, lk, sd, sr, sj, sz, se, ch, sy, tw, tj, tz, th, tl, tg, tk, to, tt, tn, tr,
tm, tc, tv, ug, ua, ae, gb, um, uy, uz, vu, ve, vn, vg, vi, wf, eh, ye, zm, zw
```

### City

- Label: `City`
- Key: `city`
- Type: `string`
- Required: optional

Enter the city only, for example `Pittsburgh`.

Notes:

- Do not include state or country in this field.
- City polygons may be smaller than expected.
- For more precision, use the geolocation fields or `customGeolocation`.

### State

- Label: `State`
- Key: `state`
- Type: `string`
- Required: optional

Sets the state for extraction, commonly used for US addresses.

### County

- Label: `County`
- Key: `county`
- Type: `string`
- Required: optional

Sets the county or equivalent administrative division.

Note:

- County can represent different administrative units depending on the country.

### Postal code

- Label: `Postal code`
- Key: `postalCode`
- Type: `string`
- Required: optional

Sets the postal code for the extraction area.

Notes:

- Combine postal code only with `countryCode`.
- Do not combine postal code with `city`.
- Only one postal code can be provided at a time.

### Custom search area (coordinate order must be: [longitude, latitude])

- Label: `Custom search area`
- Key: `customGeolocation`
- Type: `object`
- Required: optional

Defines the exact search area when regular location fields are not sufficient.

See `readme.md` for supported GeoJSON structures and examples.

### Google Maps URLs

- Label: `Google Maps URLs`
- Key: `startUrls`
- Type: `array`
- Required: optional

Uses direct Google Maps URLs as starting points.

Notes:

- Maximum `300` results per search URL.
- Valid formats contain `google.com/maps/`.
- Also supports uncommon formats like `google.com?cid=***`, `goo.gl/maps`, and custom place list URLs.

### Place IDs

- Label: `Place IDs`
- Key: `placeIds`
- Type: `string[]`
- Required: optional

List of Google Place IDs such as:

```text
ChIJreV9aqYWdkgROM_boL6YbwA
```

### Scrape all places

- Label: `Scrape all places`
- Key: `allPlacesNoSearchAction`
- Type: `string`
- Required: optional

Extracts all places visible on the map. Use the Google Maps zoom level to control detail and density.

Options:

- `all_places_no_search_ocr`
- `all_places_no_search_mouse`

Notes:

- Higher zoom levels scrape more places but take longer.
- You can test visibility by changing the `16z` part of a Google Maps URL.

## JSON Example

```json
{
  "searchStringsArray": [
    "restaurant"
  ],
  "locationQuery": "New York, USA",
  "maxCrawledPlacesPerSearch": 50,
  "language": "en",
  "searchMatching": "all",
  "placeMinimumStars": "",
  "website": "allPlaces",
  "skipClosedPlaces": false,
  "scrapePlaceDetailPage": false,
  "scrapeTableReservationProvider": false,
  "includeWebResults": false,
  "scrapeDirectories": false,
  "maxQuestions": 0,
  "scrapeContacts": false,
  "scrapeSocialMediaProfiles": {
    "facebooks": false,
    "instagrams": false,
    "youtubes": false,
    "tiktoks": false,
    "twitters": false
  },
  "maximumLeadsEnrichmentRecords": 0,
  "maxReviews": 0,
  "reviewsSort": "newest",
  "reviewsFilterString": "",
  "reviewsOrigin": "all",
  "scrapeReviewsPersonalData": true,
  "scrapeImageAuthors": false,
  "allPlacesNoSearchAction": ""
}
```
