![SerpBear](https://i.imgur.com/0S2zIH3.png)

# SerpBear

![GitHub](https://img.shields.io/github/license/gigerIT/serpbear?style=for-the-badge) ![GitHub package.json version](https://img.shields.io/github/package-json/v/gigerIT/serpbear?style=for-the-badge) ![Docker Pulls](https://img.shields.io/docker/pulls/gigeritch/serpbear?style=for-the-badge)

SerpBear is an actively maintained fork of the original [SerpBear](https://github.com/towfiqi/serpbear), built with appreciation for the work that made the project useful in the first place.

This fork is used for client projects and maintained with production use in mind. The goal is to carry the project forward respectfully with ongoing bug fixes, compatibility updates, infrastructure improvements, and new features.

#### [Documentation](https://docs.serpbear.com/) | [Changelog](https://github.com/gigerIT/serpbear/blob/main/CHANGELOG.md) | [Releases](https://github.com/gigerIT/serpbear/releases) | [Docker Image](https://hub.docker.com/r/gigeritch/serpbear)

![Easy to Use Search Engine Rank Tracker](https://serpbear.b-cdn.net/serpbear_readme_v2.gif)

## Why This Fork

- **Actively maintained:** This fork continues to receive updates, fixes, and releases for people still relying on SerpBear.
- **Production-focused:** It is maintained for real deployments, with attention to compatibility, stability, and long-term usability.
- **Faithful to the original project:** Self-hosted rank tracking, keyword research, notifications, and integrations remain the core focus.
- **Built with respect for the original work:** This fork exists to continue and support the project for teams that depend on it.

## What You Get

- Track Google keyword positions for your domains.
- Send scheduled email notifications about ranking changes.
- Use the built-in API for reporting and automation.
- Generate keyword ideas and search-volume data through Google Ads integration.
- Pull visits, impressions, and related query data from Google Search Console.
- Install it like an app on mobile devices using the included web app manifest.

## Quick Start With Docker

The fastest way to run this fork is with the published Docker image: [`gigeritch/serpbear`](https://hub.docker.com/r/gigeritch/serpbear).

Use `latest` for the newest stable fork release, or pin a specific tag for predictable deployments.

```bash
docker pull gigeritch/serpbear:latest
docker run -d \
  --name serpbear \
  -p 3000:3000 \
  -v serpbear_data:/app/data \
  -e USER=admin \
  -e PASSWORD=change-me \
  -e SECRET=replace-with-a-long-random-string \
  -e APIKEY=replace-with-a-long-random-api-key \
  -e NEXT_PUBLIC_APP_URL=http://localhost:3000 \
  gigeritch/serpbear:latest
```

If you prefer Docker Compose:

```yaml
services:
  serpbear:
    image: gigeritch/serpbear:latest
    container_name: serpbear
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      USER: admin
      PASSWORD: change-me
      SECRET: replace-with-a-long-random-string
      APIKEY: replace-with-a-long-random-api-key
      NEXT_PUBLIC_APP_URL: http://localhost:3000
    volumes:
      - serpbear_data:/app/data

volumes:
  serpbear_data:
```

After the container starts, open `http://localhost:3000` and sign in with the credentials you configured.

### Important Runtime Notes

- `NEXT_PUBLIC_APP_URL` must point to the running app URL. The cron worker calls the app's own API over HTTP and depends on this being correct.
- Persist `/app/data` so your SQLite database and runtime files survive container restarts.
- Use long random values for `SECRET` and `APIKEY` in any real deployment.

## Getting Started

1. Run the app and sign in.
2. Add your first domain.
3. Choose a SERP data source or use your own proxy IPs.
4. Configure that provider from the Settings page.
5. Add keywords and start tracking.
6. Optionally configure SMTP settings for email notifications.
7. Optionally connect Google Ads and Google Search Console for keyword ideas, search volume, and search analytics data.

## Supported SERP Data Sources

SerpBear can use your own proxies or these built-in integrations:

- Scraping Robot
- ScrapingAnt
- SerpApi.com
- Serply
- Space Serp
- SearchApi.io
- Value Serp
- Serper.dev
- HasData
- CrazySERP

If you want a quick free-tier comparison, keep this as a starting point and verify current limits on each provider's site before choosing one:

| Service           | Free tier         | Pricing                              | Included usage      | API |
| ----------------- | ----------------- | ------------------------------------ | ------------------- | --- |
| hasdata.com       | 1,000 requests/mo | From $49/mo                          | 200,000 requests/mo | Yes |
| scrapingant.com   | 10,000 credits/mo | From $19/mo                          | 100,000 credits/mo  | Yes |
| scrapingrobot.com | 5,000 requests/mo | Usage-based from $0.00004/request    | Pay as you go       | Yes |
| searchapi.io      | 100 requests      | From $40/mo                          | 10,000 searches/mo  | Yes |
| serpapi.com       | 250 searches/mo   | From $25/mo                          | 1,000 searches/mo   | Yes |
| serper.dev        | 2,500 queries     | Usage-based from $0.30/1,000 queries | Pay as you go       | Yes |
| serply.io         | 300 requests/mo   | From $50/mo                          | 50,000 requests/mo  | Yes |
| spaceserp.com     | -                 | From $14.99/mo                       | 1,000 searches/mo   | Yes |
| valueserp.com     | Free trial        | From $50/mo                          | 25,000 credits/mo   | Yes |
| crazyserp.com     | -                 | From $50/mo                          | 25,000 credits/mo   | Yes |

CrazySERP is also supported in-app, but its pricing and free-tier details are not listed here because they were not documented in the previous README.

Pricing and free-tier details above were checked against providers' public pricing pages on 2026-03-25 and may change over time.

## How It Works

- The app checks Google search results through a supported scraping provider or your own proxies.
- Position history is stored locally using SQLite, with runtime state kept under `data/`.
- A separate `cron.js` worker triggers scheduled scraping, notifications, retry jobs, and Search Console refreshes through the app's API using `APIKEY`.
- Google Ads integration powers keyword research features, and Google Search Console integration adds search analytics data to tracked domains and keywords.

## Local Development

### Requirements

- Node.js `22.11.0`
- `npm ci`
- A local `.env.local` file based on `.env.example`

### Common Commands

```bash
npm ci
npm run dev
npm run cron
npm run lint
npm run test:ci
npm run build
```

Database migrations are available through:

```bash
npm run db:migrate
```

## Tech Stack

- Next.js 12 Pages Router
- React 18 + TypeScript
- Tailwind CSS
- SQLite with `sequelize-typescript`
- A separate cron worker for scheduled jobs

## Releases

- Source releases are published at [`gigerIT/serpbear` releases](https://github.com/gigerIT/serpbear/releases).
- Docker images are published at [`gigeritch/serpbear`](https://hub.docker.com/r/gigeritch/serpbear).
- The full release history is tracked in [`CHANGELOG.md`](https://github.com/gigerIT/serpbear/blob/main/CHANGELOG.md).
