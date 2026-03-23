# Google Maps Scraper

## What Is Google Maps Scraper?

Google Maps Scraper lets you extract business data from Google Maps, helping you generate leads, analyze competitors, and fuel growth with just a few clicks.

### Common use cases

- Generate qualified leads: extract business names, websites, emails, and phone numbers to build prospect lists for your sales team.
- Track competitors across regions: monitor where competitors operate, how they are rated, and how many reviews they have received.
- Perform market analysis: analyze market saturation, identify service gaps, or benchmark local businesses by size, rating, and visibility.
- Support partnerships: discover top-rated or high-volume locations for outreach and collaboration.
- Automate research workflows: replace manual search tasks with repeatable workflows that keep datasets fresh and consistent.

The scraper expands Google Maps data extraction beyond the limitations of the official Google Places API and bypasses the Google Maps limit of showing and scraping no more than 120 places per area.

## What Data Does Google Maps Scraper Extract?

- Title or place name
- Subtitle, category, place ID, and URL
- Address
- Location, plus code, and exact coordinates
- Phone number
- Website, if available
- Company contact details from website: company email, phone number, and social media profiles
- Business leads enrichment: full name, work email address, phone number, job title, and LinkedIn profile
- Social media profile enrichment: detailed profile data for Facebook, Instagram, YouTube, TikTok, and Twitter
- Detailed characteristics in `additionalInfo`
- Search results metadata
- Review count and review distribution
- Average rating in `totalScore`
- Images
- Hotel booking URL, hotel price, and nearby hotels
- Temporarily or permanently closed status
- Updates from customers and questions and answers
- People also search
- Menu
- Price bracket
- Opening hours
- Popular times histogram and live occupancy
- Table reservation provider
- Multiple businesses located within indoor venues such as malls or shopping centers

## Main Capabilities

- Extract anything: names, addresses, websites, phone numbers, ratings, review counts, categories, or opening hours.
- Flexible search: scrape using any number of criteria, including search query, category, location, coordinates, or URL.
- Define the area to scrape: focus on specific locations, or set a wide area using coordinates or geolocation parameters.
- Flexible output format: export data into almost any format, with multiple views available.
- Integrate with other tools: use webhooks or the MCP server to set up workflows with other Actors or third-party tools like Make or Zapier.
- Use add-ons for further enrichment: use paid add-ons to enrich contact details, images, or reviews.

## Input

The input for Google Maps Scraper should be either a Google Maps URL or a location in combination with a search term. You can also extract additional details such as images, reviews, amenities, and more. You can set up the input programmatically or use the fields in the scraper interface.

### Search terms

Using multiple similar search terms can increase the number of scraped places, but it also increases run time. A better approach is to use search terms that are distinct or overlap only slightly in meaning. Long lists of duplicate search terms increase run time without providing more results.

Example of a good list of search terms:

```text
[restaurant, bar, pub, cafe, buffet, ice cream, tea house]
```

Example of a bad list of search terms:

```text
[restaurant, restaurants, chinese restaurant, cafe, coffee, coffee shop, takeout]
```

Google search results often include categories adjacent to your search. For example, `restaurant` may also capture some cafe or bar places, but results are typically better if those are used as separate search terms too.

### Categories

Using categories can be dangerous.

Search terms can introduce false positives by extracting irrelevant places. Categories can narrow results to only the places you select.

Categories can also create false negatives by excluding places you actually want. Google has thousands of categories and many are synonymous. You need to list all categories you want to match, including synonyms. For example, `Divorce lawyer`, `Divorce service`, and `Divorce attorney` are three distinct categories, and some places may be classified as only one of them. For some use cases, selecting as many as 100 categories may be necessary to avoid missing relevant places.

Google Maps Scraper tries to improve matching in two ways:

- If any category of a place matches any category from your input, the place is included.
- If all words from your input are contained in a category name, the place is included. For example, `restaurant` will match `Chinese restaurant` and `Pan Asian restaurant`.

Important note: if categories are used without search terms, they are used both as search terms and as category filters. Because of the risk of false negatives, using categories without search terms is generally not recommended. A smaller number of search terms with a larger set of categories is usually the better approach.

### Search without geolocation

Instead of using separate search term and location inputs, you can use only a search term such as `restaurants in berlin` or a direct Google Maps search URL such as:

```text
https://www.google.com/maps/search/restaurants/@52.5190603,13.388574,13z/
```

If you skip the location input, results are limited to a maximum of 120 because only a single Google Maps screen is opened and scrolled. This is recommended only when:

- You do not need more than 120 results.
- You want the lowest possible latency.
- You want results in the same order Google provides them.

### Direct Place IDs or URLs

You can also upload a direct Google Maps Place ID or URL, or a list of them, and Google Maps Scraper will extract place details directly without running the search step first.

Be aware that direct Place IDs or URLs trigger extra charges because they are part of a paid add-on for additional place details.

## Output

Results are wrapped into a dataset available in the Output or Storage tab. Output is organized into tables and tabs for easier viewing. You can browse results as a table, JSON, or a map.

After the run finishes, the dataset can be downloaded in multiple formats:

- JSON
- CSV
- Excel
- XML
- HTML

Before exporting, you can include or omit specific output fields. You can also download a whole view that groups thematically related data.

Reviews and Leads enrichment views spread each review or lead into a separate row for easier data processing.

### Table view

The table view supports multiple ways to inspect data. There is a general overview, and you can also sort by contact info, location rating, reviews, and other fields.

### JSON file

Below is an example of the amount of data returned for one scraped place. Example: one scraped restaurant in New York.

```json
{
  "searchString": "Direct Detail URL: https://www.google.com/maps/place/Kim's+Island/@40.5107736,-74.2482624,17z/data=!4m6!3m5!1s0x89c3ca9c11f90c25:0x6cc8dba851799f09!8m2!3d40.5107736!4d-74.2482624!16s%2Fg%2F1tmgdcj8?hl=en&entry=ttu",
  "rank": null,
  "searchPageUrl": null,
  "searchPageLoadedUrl": null,
  "isAdvertisement": false,
  "title": "Kim's Island",
  "subTitle": null,
  "description": null,
  "price": "$10-20",
  "categoryName": "Chinese restaurant",
  "address": "175 Main St, Staten Island, NY 10307",
  "neighborhood": "Tottenville",
  "street": "175 Main St",
  "city": "Staten Island",
  "postalCode": "10307",
  "state": "New York",
  "countryCode": "US",
  "website": "http://kimsislandsi.com/",
  "phone": "(718) 356-5168",
  "phoneUnformatted": "+17183565168",
  "claimThisBusiness": false,
  "location": {
    "lat": 40.5107736,
    "lng": -74.2482624
  },
  "locatedIn": null,
  "plusCode": "GQ62+8M Staten Island, New York",
  "menu": "http://kimsislandsi.com/",
  "totalScore": 4.5,
  "permanentlyClosed": false,
  "temporarilyClosed": false,
  "placeId": "ChIJJQz5EZzKw4kRCZ95UajbyGw",
  "categories": ["Chinese restaurant", "Delivery Restaurant"],
  "fid": "0x89c3ca9c11f90c25:0x6cc8dba851799f09",
  "cid": "7838756667406262025",
  "reviewsCount": 91,
  "reviewsDistribution": {
    "oneStar": 4,
    "twoStar": 3,
    "threeStar": 3,
    "fourStar": 10,
    "fiveStar": 71
  },
  "imagesCount": 28,
  "imageCategories": ["All", "Menu", "Food & drink", "Vibe", "By owner", "Street View & 360deg"],
  "scrapedAt": "2024-11-28T12:28:50.519Z",
  "reserveTableUrl": null,
  "googleFoodUrl": null,
  "hotelStars": null,
  "hotelDescription": null,
  "checkInDate": null,
  "checkOutDate": null,
  "similarHotelsNearby": null,
  "hotelReviewSummary": null,
  "hotelAds": [],
  "openingHours": [
    {
      "day": "Monday",
      "hours": "Closed"
    },
    {
      "day": "Tuesday",
      "hours": "11 AM to 9:30 PM"
    },
    {
      "day": "Wednesday",
      "hours": "11 AM to 9:30 PM"
    },
    {
      "day": "Thursday",
      "hours": "11 AM to 12 AM"
    },
    {
      "day": "Friday",
      "hours": "12 to 9:30 AM, 11 AM to 10:30 PM"
    },
    {
      "day": "Saturday",
      "hours": "11 AM to 10:30 PM"
    },
    {
      "day": "Sunday",
      "hours": "12 to 9:30 PM"
    }
  ],
  "peopleAlsoSearch": [
    {
      "category": "People also search for",
      "title": "Island Kitchen Chinese",
      "reviewsCount": 70,
      "totalScore": 3.4
    },
    {
      "category": "People also search for",
      "title": "New Island",
      "reviewsCount": 116,
      "totalScore": 3.9
    },
    {
      "category": "People also search for",
      "title": "Islander Taste Chinese Restaurant",
      "reviewsCount": 119,
      "totalScore": 4.2
    },
    {
      "category": "People also search for",
      "title": "Kum Fung",
      "reviewsCount": 168,
      "totalScore": 3.8
    }
  ],
  "placesTags": [],
  "reviewsTags": [
    {
      "title": "prices",
      "count": 6
    },
    {
      "title": "delivery",
      "count": 4
    },
    {
      "title": "spareribs",
      "count": 3
    },
    {
      "title": "dumpling",
      "count": 2
    },
    {
      "title": "lo mein",
      "count": 2
    }
  ],
  "additionalInfo": {
    "Service options": [
      {
        "Takeout": true
      },
      {
        "Dine-in": true
      }
    ],
    "Popular for": [
      {
        "Lunch": true
      },
      {
        "Dinner": true
      },
      {
        "Solo dining": true
      }
    ],
    "Accessibility": [
      {
        "Wheelchair accessible entrance": true
      },
      {
        "Wheelchair accessible seating": true
      },
      {
        "Assistive hearing loop": false
      },
      {
        "Wheelchair accessible parking lot": false
      },
      {
        "Wheelchair accessible restroom": false
      }
    ],
    "Offerings": [
      {
        "Comfort food": true
      },
      {
        "Healthy options": true
      },
      {
        "Quick bite": true
      },
      {
        "Small plates": true
      }
    ],
    "Dining options": [
      {
        "Lunch": true
      },
      {
        "Dinner": true
      }
    ],
    "Amenities": [
      {
        "Restroom": false
      }
    ],
    "Atmosphere": [
      {
        "Casual": true
      }
    ],
    "Planning": [
      {
        "Accepts reservations": false
      }
    ],
    "Payments": [
      {
        "Credit cards": true
      },
      {
        "Debit cards": true
      },
      {
        "NFC mobile payments": true
      },
      {
        "Credit cards": true
      }
    ],
    "Children": [
      {
        "Good for kids": true
      }
    ]
  },
  "gasPrices": [],
  "questionsAndAnswers": [],
  "updatesFromCustomers": null,
  "ownerUpdates": [],
  "url": "https://www.google.com/maps/search/?api=1&query=Kim's%...",
  "imageUrl": "https://lh5.googleusercontent.com/p/AF1Q...",
  "kgmid": "/g/1tmgdcj8",
  "webResults": [],
  "parentPlaceUrl": null,
  "tableReservationLinks": [],
  "bookingLinks": [],
  "orderBy": [
    {
      "name": "kimsislandsi.com",
      "orderUrl": "http://kimsislandsi.com/"
    }
  ],
  "images": [
    {
      "imageUrl": "https://lh5.googleusercontent.com/p/AF1Q...",
      "authorName": "Sebastian Sinisterra (CitySeby)",
      "authorUrl": "https://maps.google.com/maps/contrib/103...",
      "uploadedAt": "2017-05-30T00:00:00.000Z"
    }
  ],
  "imageUrls": ["https://lh5.googleusercontent.com/p/AF1Q..."],
  "reviews": [
    {
      "name": "Rocco Castellano",
      "text": "Excellent  food great service n always  on time",
      "textTranslated": null,
      "publishAt": "a month ago",
      "publishedAtDate": "2024-10-11T01:23:42.544Z",
      "likesCount": 0,
      "reviewId": "ChdDSUhNMG9nS0VJQ0FnSURuNV9DVnFRRRAB",
      "reviewUrl": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6...",
      "reviewerId": "108813127648936384314",
      "reviewerUrl": "https://www.google.com/maps/contrib/108...",
      "reviewerPhotoUrl": "https://lh3.googleusercontent.com/a-/ALV...",
      "reviewerNumberOfReviews": 74,
      "isLocalGuide": true,
      "reviewOrigin": "Google",
      "stars": 5,
      "rating": null,
      "responseFromOwnerDate": null,
      "responseFromOwnerText": null,
      "reviewImageUrls": [],
      "reviewContext": {},
      "reviewDetailedRating": {
        "Food": 5,
        "Service": 5,
        "Atmosphere": 5
      }
    }
  ],
  "userPlaceNote": null,
  "restaurantData": {}
}
```

### Company contacts enrichment

```json
{
  "title": "Daniel's Jewelers",
  "instagrams": ["https://www.instagram.com/danielsjewelers/"],
  "facebooks": ["https://www.facebook.com/DanielsJewelers"],
  "linkedIns": [],
  "youtubes": ["https://www.youtube.com/channel/UCUgzkwhbbodMnOwDIPJj0_g"],
  "tiktoks": ["https://www.tiktok.com/@DanielsJewelers"],
  "twitters": ["https://twitter.com/danielsjewelers"],
  "pinterests": ["https://www.pinterest.com/daniel_jewelers/"]
}
```

### Business leads enrichment

```json
{
  "city": "Seattle",
  "state": "Washington",
  "personId": "2746893668571939229",
  "firstName": "Benjamin",
  "lastName": "White",
  "fullName": "Benjamin White",
  "linkedinProfile": "https://www.linkedin.com/in/benjamin-white-2562a3212",
  "email": null,
  "mobileNumber": null,
  "headline": "Influencer a Content Creator (IG, TT)",
  "jobTitle": "Sales Manager",
  "department": ["Marketing"],
  "industry": "Food&Beverage",
  "seniority": ["entry"],
  "country": "United States",
  "photoUrl": "https://media.licdn.com/dms/image/v2/...",
  "companyId": "23734538243567720",
  "companyName": "Happy Eating",
  "companyWebsite": "happyeating.com",
  "companySize": "51 - 200",
  "companyLinkedin": "https://www.linkedin.com/company/62543",
  "twitter": null,
  "companyCity": null,
  "companyState": null,
  "companyCountry": null,
  "companyPhoneNumber": null
}
```

### Social media profile enrichment

When social media profile enrichment is enabled, Google Maps Scraper can enrich discovered social media URLs with detailed profile information such as follower counts, descriptions, and verification status. Enriched profiles are included directly in the place output.

Important notes:

- Social media profile enrichment requires Company contacts enrichment to be enabled.
- Each enriched social media profile is a separate billable event.
- You can enable enrichment only for selected platforms, for example Facebook and Instagram.
- All enrichment options are disabled by default.
- Enriched profiles are available in the Social profiles output view tab.

### External places (hotels)

Google sometimes shows external service places, mainly for hotels. These are not regular places with pins on the map and only expose some regular output fields. They are marked with these extra fields:

```json
{
  "url": "https://www.google.com/maps/place/Al Eairy Furnished Apartments Al Madinah 9/@24.48...",
  "isExternalServicePlace": true,
  "externalServiceProvider": "SuperTravel",
  "externalId": "/g/11pkhzvq1s"
}
```

### Hotel-specific info

```json
{
  "hotelStars": "4-star hotel",
  "hotelDescription": "This old-world-style luxury hotel is in a historic property that dates from 1874; it's a 1-minute walk from the Long Island Railroad and 19 miles from Manhattan.\n The posh rooms have flat-screen TVs, Italian furniture, Wi-Fi (surcharge) and 24-hour room service. Upgraded suites add kitchenettes and living areas, while some feature an additional bathroom and private outdoor patios.\n Perks include 25,000 sq ft of event space, an indoor pool, a spa and sauna, a fitness center and an upscale steakhouse, plus a seasonal patio bar, and lounge. Pet walking and feeding services are available. Parking is free.",
  "checkInDate": "2025-06-14",
  "checkOutDate": "2025-06-16",
  "similarHotelsNearby": [
    {
      "name": "Residence Inn Long Island Garden City",
      "rating": 4.4,
      "reviews": 343,
      "description": "3-star hotel for $106 less",
      "price": "$314"
    }
  ],
  "hotelAds": [
    {
      "title": "The Garden City Hotel",
      "googleUrl": "https://www.google.com/travel/clk?pc=AA8...",
      "isOfficialSite": true,
      "price": "$501",
      "url": "https://linkcenter.derbysoftca.com/dplatform-linkcenter/booking..."
    }
  ]
}
```

### Restaurant-specific info

```json
{
  "price": "$$",
  "menu": "https://www.carminesnyc.com/menus/menus-clv-q420-dining",
  "reserveTableUrl": "https://www.google.com/maps/reserve/v/dine/...",
  "tableReservationLinks": [
    {
      "name": "carminesnyc.com",
      "url": "https://www.carminesnyc.com/locations/times-square"
    }
  ],
  "bookingLinks": [],
  "restaurantData": {
    "tableReservationProvider": {
      "name": "Resy",
      "reserveTableUrl": "https://www.google.com/maps/reserve/v/dine/...r"
    }
  },
  "orderBy": [
    {
      "name": "Carmines + Virgils",
      "orderUrl": "https://carminesnyc.olo.com/menu/little-fish-corp..."
    }
  ]
}
```

### Map view

Google Maps Scraper provides a zoomable map that shows all scraped places. The map appears in the Live View tab on the actor run page and is also stored in the Key-Value Store as the `results-map.html` record.

## Using Geolocation For Pinpoint Accuracy

### Location, country, state, county, city, and postal code

Using free text in the Location field is usually enough to start scraping. For more precision, use the Geolocation parameters field and combine country, state, county, city, and `postalCode`.

Google Maps Scraper uses OpenStreetMap as its geolocation API. You can verify location matching on the official OpenStreetMap page.

### Custom search area

If your location cannot be found on Google Maps or you want to customize a specific area, use the Custom search area function. You provide coordinate pairs for an area and the scraper creates start URLs from them.

The supported geometry types are:

- `Polygon`
- `MultiPolygon`
- `Point` with a default radius of 5 kilometers

All of them follow the GeoJSON RFC format. Polygon and circle-based searches are usually the most practical for scraping.

Important note: longitude and latitude order is reversed in GeoJSON compared to the Google Maps website. The first field must be longitude, and the second field must be latitude.

`Geojson.io` is recommended for creating valid `customGeolocation` payloads.

### Polygon

The most common type is a polygon, defined as a list of points that form the scraped area. The first and last coordinate pair must be identical to close the polygon.

Example covering most of London, UK:

```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [
        -0.322813,
        51.597165
      ],
      [-0.31499, 51.388023],
      [0.060493, 51.389199],
      [0.051936, 51.60036],
      [-0.322813, 51.597165]
    ]
  ]
}
```

### MultiPolygon

`MultiPolygon` combines multiple non-contiguous polygons, for example an island near the mainland. As with `Polygon`, the first and last coordinate pair in each polygon must match.

```json
{
  "type": "MultiPolygon",
  "coordinates": [
    [
      [
        [12.0905752, 50.2524063],
        [12.1269337, 50.2324336]
      ]
    ],
    [
    ]
  ]
}
```

### Circle

To represent a circle, use the `Point` type together with `radiusKm`.

Example covering Basel, Switzerland:

```json
{
  "type": "Point",
  "coordinates": ["7.5503", "47.5590"],
  "radiusKm": 8
}
```

## FAQ

### How does Google Maps Scraper work?

It behaves like a human using Google Maps manually. It opens the Google Maps website, goes to a specified location, writes the search query into the search bar, scrolls until it reaches the end of results or `maxCrawledPlacesPerSearch`, then enqueues places as separate pages and copies visible data into structured output. This process is repeated for many map pages inside the input location.

### What are the disadvantages of the Google Maps API?

The Google Maps API gives you $200 of free monthly credit, which equals about 28,500 map loads per month. However, it caps search results at 60 regardless of radius. So if you search for bars in New York, you may get only 60 results even if thousands exist. Google Maps Scraper has no such quota for result count, is more cost-effective for this use case, and can also scrape popular times histograms that are not available in the official API.

### Can I scrape places from multiple locations?

Google Maps Scraper itself supports only a single location query. To scrape multiple locations in one workflow, use Google Maps Scraper Orchestrator. It runs the scraper for each location and merges results. If you use only Google Maps Scraper, multiple locations can still be represented through `customGeolocation` with multiple polygons.

### How can I increase the speed of the scraper?

You can increase run memory up to 8 GB per run. To speed things up further, run several runs in parallel to use more of your account memory. Google Maps Scraper Orchestrator can also split locations or search terms across multiple runs, deduplicate results, and collect them into one dataset.

### Can I use Google Maps Scraper to extract Google reviews?

Yes. The scraper supports extraction of detailed review information on Google Maps. Personal data extraction about reviewers is also possible, but it must be explicitly enabled in input.

Supported review-related fields include:

- Review text
- Published date
- Stars
- Review ID and URL
- Response from owner text
- Review images
- Review context
- Detailed rating per service
- Reviewer name
- Reviewer number of reviews
- Reviewer ID, URL, and photo
- `isLocalGuide`

### How can I get one review per row in the output?

If you need each review in a separate table row, use the `Reviews (if any)` dataset export view.

Via API, add `&view=reviews` to the dataset export URL:

```text
https://api.apify.com/v2/datasets/DATASET_ID/items?clean=true&format=json&view=reviews
```

If you do not use that view, each output place contains up to 5,000 reviews. When a place has more than 5,000 reviews, the dataset stores duplicate place rows, each carrying the next batch of reviews. For example, a place with 50,000 reviews would result in 10 dataset items for the same place. This is due to the size limit of a single Apify dataset item.

### Can I integrate Google Maps Scraper with other apps?

Yes. Google Maps Scraper can connect with almost any cloud service or web app through Apify integrations. Common targets include Zapier, Slack, Make, Airbyte, GitHub, Google Sheets, Asana, and LangChain.

You can also use webhooks to trigger actions when events occur, for example sending a notification when a run finishes successfully.

### Can I use Google Maps Scraper as its own API?

Yes. You can use the Apify API to access Google Maps Scraper programmatically. The API supports actor management, scheduling, runs, datasets, monitoring, results, actor versions, and more.

For Node.js, use the `apify-client` NPM package. For Python, use the `apify-client` PyPI package.

For detailed information and code examples, see the API tab or the Apify API documentation.

### Can I use this Google Maps Scraper API in Python?

Yes. Use the `apify-client` package from PyPI to access the Apify API from Python.

### What are other tools I can use with Google Maps?

Examples of related tools:

- Google Maps Scraper Orchestrator
- AI Text Analyzer for Google Reviews
- Competitive Intelligence Agent
- Market Expansion Agent

### Is it legal to scrape Google Maps data?

Web scraping is generally legal when you extract publicly available data, which includes most data on Google Maps. You still need to respect privacy, personal data, intellectual property, and Google's Terms of Use. Personal data should be scraped only when you have a legitimate reason.

## Feedback

If you have technical feedback or find a bug in Google Maps Scraper, create an issue in the actor's Issues tab.
