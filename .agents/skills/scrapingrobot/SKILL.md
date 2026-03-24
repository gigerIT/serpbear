---
name: scrapingrobot
description: Scraping Robot API Skill
---

# Scraping Robot Skill

Use this skill when you need to work with Serpbear's Scraping Robot integration, generate or review Scraping Robot requests, or debug failures from the POST endpoint at `https://api.scrapingrobot.com/`.

## What this skill covers

- The single Scraping Robot endpoint Serpbear uses: `POST /?token=<TOKEN>`.
- Request construction for both plain HTML fetching and JS-rendered scraping.
- Repo-specific conventions in `scrapers/services/scrapingrobot.ts`.
- Safe defaults, parameter selection, response parsing, and failure handling.

## Repo-specific context

- Serpbear registers the provider in `scrapers/services/scrapingrobot.ts`.
- The integration uses `POST https://api.scrapingrobot.com/?token=${settings.scaping_api}`.
- The API key is stored in the existing settings field `scaping_api`. Keep that exact key name; it is intentionally misspelled across the app.
- The scraper currently sets `resultObjectKey: "result"`, so downstream code expects useful data under `response.result`.
- The current adapter sends a JSON body with top-level fields such as `url`, `module`, `proxyCountry`, `render`, and `mobile`.
- The provided API docs describe most optional controls inside `params`. Preserve Serpbear's existing request shape unless you have verified a broader refactor is needed.

## When to use this skill

- Add or modify the Scraping Robot scraper adapter.
- Translate product requirements into Scraping Robot request payloads.
- Decide whether to use `HtmlRequestScraper` or `HtmlChromeScraper`.
- Add support for features like geo-targeting, mobile mode, screenshots, selectors, waits, or POST passthrough scraping.
- Debug API responses such as `FAIL`, `Caught ban`, auth errors, or overloaded service errors.

## Endpoint contract

### Request

- Method: `POST`
- Base URL: `https://api.scrapingrobot.com/`
- Auth: query parameter `token=<SCRAPING_ROBOT_TOKEN>`
- Content type: `application/json`
- Required body fields:
  - `url`: target URL to scrape
  - `module`: one of:
    - `HtmlRequestScraper` for non-rendered requests and better performance
    - `HtmlChromeScraper` for JS-rendered pages and browser actions

### Canonical minimal example

```json
{
  "url": "https://example.com",
  "module": "HtmlRequestScraper"
}
```

### Success shape

```json
{
  "status": "SUCCESS",
  "date": "Mon, 1 Jan 2021 12:00:00 GMT",
  "httpCode": 200,
  "result": {}
}
```

### Error shape

```json
{
  "status": "FAIL",
  "date": "Mon, 1 Jan 2021 12:00:00 GMT",
  "httpCode": 500,
  "error": "Caught ban"
}
```

## Core request rules

1. Always send the token in the query string, not in headers.
2. Always send JSON in the POST body.
3. Always include `url` and `module`.
4. Prefer `HtmlRequestScraper` unless the target page truly requires JavaScript rendering or browser interaction.
5. Use `HtmlChromeScraper` when you need waits, clicks, screenshots, scrolling, selectors that depend on client rendering, or form submission on the page.
6. Keep Serpbear's downstream parsing in mind: useful data must still be reachable through `response.result`.

## Parameter guide

### High-value parameters

- `proxyCountry`: ISO country code for country-specific egress.
- `mobile`: fetch the mobile version of the page.
- `render`: enables JS rendering.
- `scrapeSelector`: scrape a specific CSS selector.
- `scrapeXpath`: scrape a specific XPath target.
- `waitUntil`: browser readiness event for rendered requests.
- `waitForSeconds`: explicit wait after page load.
- `waitForSelector`: wait until an element appears before scraping.
- `scrollDown`: scroll multiple times for lazy-loaded pages.
- `clickOnElement`: click a selector before collecting data.
- `screenshot`: capture a page screenshot; requires JS rendering.

### Form interaction parameters

- `formSelector`: input element selector.
- `submitSelector`: submit button selector.
- `query`: text to type into the form.

Use all three together when driving a search or page form.

### Network and asset controls

- `noScripts`: disables scripts; do not combine with JS rendering expectations.
- `noImages`: skips images.
- `noFonts`: skips fonts.
- `noCss`: skips stylesheets.
- `customHeaders`: forwards client request headers to the target request.

### Response mode parameters

- `responseType: "json"` is the default and should be preferred.
- `responseType: "zip"` requires JS rendering.

### Scraping Robot as an HTTP POST passthrough

For submitting a POST request to the target site through Scraping Robot:

- Set `params.requestType` to `"post"`.
- Set `postBody` to the payload string.
- Optionally set `params.contentType` to one of:
  - `text/plain`
  - `application/json`
  - `application/x-www-form-urlencoded`
- This mode works only when JS rendering is disabled.

## Parameter dependencies and caveats

- `screenshot` requires JS rendering.
- `responseType: "zip"` requires JS rendering.
- `postBody` only works with `params.requestType: "post"` and non-rendered requests.
- `formSelector`, `submitSelector`, and `query` should be treated as a set.
- `noScripts: true` prevents JS-rendered behavior from working correctly.
- Wait and browser-interaction options are meaningful only for browser-rendered runs.
- The docs list optional parameters under `params`; the current Serpbear adapter already uses some of them at the top level. Follow existing code conventions unless you are deliberately normalizing the integration.

## Recommended defaults for Serpbear

When building Google result-page scraping requests for Serpbear:

- Use `module: "HtmlRequestScraper"`.
- Set `render: false` unless the target proves it needs rendering.
- Set `proxyCountry` from the keyword country.
- Set `mobile: true` only for mobile-device keywords.
- Keep the target URL fully assembled before sending it to Scraping Robot.
- Expect the useful payload under `result`.

This mirrors the current implementation in `scrapers/services/scrapingrobot.ts`.

## Serpbear adapter pattern

Use this shape when updating the existing adapter:

```ts
const payload: Record<string, string | boolean> = {
  url: targetUrl,
  module: "HtmlRequestScraper",
  proxyCountry: country,
  render: false,
};

if (keyword.device === "mobile") {
  payload.mobile = true;
}

return {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
};
```

## Decision tree

### Choose `HtmlRequestScraper` when

- The page HTML is available without client-side rendering.
- Speed and lower overhead matter.
- You only need static HTML or selector extraction.
- You are proxying a non-rendered POST request.

### Choose `HtmlChromeScraper` when

- Content appears only after JavaScript runs.
- You need `waitForSelector`, `waitForSeconds`, `scrollDown`, or `clickOnElement`.
- You need a screenshot.
- You need to interact with a form in the page before scraping.

## Error handling

Treat these responses as distinct cases:

- `400`: malformed request body; fix payload shape or required fields.
- `401`: missing token, invalid token, or insufficient account credits.
- `429`: provider overload; retry with backoff.
- `500` with `Caught ban`: target blocked the request; consider changing strategy, country, timing, or rendering mode.
- `500` with `Internal server error`: retry, then escalate if persistent.

## Debugging workflow

1. Confirm the request is hitting `POST https://api.scrapingrobot.com/?token=...`.
2. Confirm the JSON body includes `url` and `module`.
3. Confirm the token is read from `settings.scaping_api`.
4. Check whether the page actually needs rendering.
5. If using rendering, verify no conflicting options like `noScripts: true`.
6. If scraping a specific element, verify the selector or XPath against the rendered DOM state you expect.
7. If the provider returns `SUCCESS`, inspect `response.result` before changing downstream parsing.

## Implementation checklist

- Preserve the existing settings key `scaping_api`.
- Preserve `resultObjectKey: "result"` unless the API response shape is proven to change.
- Default to `HtmlRequestScraper` for performance.
- Add rendering only when justified by the target page.
- Keep request construction explicit and JSON-serialized.
- Validate parameter dependencies before shipping changes.
- If changing payload shape, verify the current Scraping Robot adapter and the downstream parser together.

## Examples

### Minimal curl request

```bash
curl -X POST "https://api.scrapingrobot.com/?token=$SCRAPING_ROBOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "module": "HtmlRequestScraper"
  }'
```

### Rendered selector scrape

```json
{
  "url": "https://example.com/app",
  "module": "HtmlChromeScraper",
  "params": {
    "render": true,
    "waitForSelector": "main h1",
    "scrapeSelector": "main h1",
    "screenshot": true
  }
}
```

### POST passthrough scrape

```json
{
  "url": "https://example.com/search",
  "module": "HtmlRequestScraper",
  "params": {
    "requestType": "post",
    "contentType": "application/x-www-form-urlencoded"
  },
  "postBody": "q=serpbear&lang=en"
}
```

## Source notes

This skill is based on the Scraping Robot POST endpoint documentation already stored in this file's original contents, including the documented request schema, parameter list, and response examples.
