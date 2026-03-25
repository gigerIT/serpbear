![SerpBear](https://i.imgur.com/0S2zIH3.png)

# SerpBear

![GitHub](https://img.shields.io/github/license/gigerIT/serpbear?style=for-the-badge) ![GitHub package.json version](https://img.shields.io/github/package-json/v/gigerIT/serpbear?style=for-the-badge) ![Docker Pulls](https://img.shields.io/docker/pulls/gigeritch/serpbear?style=for-the-badge)
s

#### [Documentation](https://docs.serpbear.com/) | [Changelog](https://github.com/gigerIT/serpbear/blob/main/CHANGELOG.md) | [Fork Releases](https://github.com/gigerIT/serpbear/releases) | [Docker Image](https://hub.docker.com/r/gigeritch/serpbear)

SerpBear is an Open Source Search Engine Position Tracking and Keyword Research App. It allows you to track your website's keyword positions in Google and get notified of their position change.

#### This Fork

This repository is a maintained fork of the original [SerpBear](https://github.com/towfiqi/serpbear). We rely on SerpBear for client projects, so we are committed to keeping this fork current, stable, and actively improved.

This is not meant as criticism of the original maintainer. Open source maintainers often have limited time and more important priorities. We appreciate the original project and the work behind it. Our goal with this fork is to keep shipping bug fixes, compatibility updates, and new features for teams that depend on SerpBear in production.

![Easy to Use Search Engine Rank Tracker](https://serpbear.b-cdn.net/serpbear_readme_v2.gif)

#### Features

- **Unlimited Keywords:** Add unlimited domains and unlimited keywords to track their SERP.
- **Email Notification:** Get notified of your keyword position changes daily/weekly/monthly through email.
- **SERP API:** SerpBear comes with built-in API that you can use for your marketing & data reporting tools.
- **Keyword Research:** Ability to research keywords and auto-generate keyword ideas from your tracked website's content by integrating your Google Ads test account.
- **Google Search Console Integration:** Get the actual visit count, impressions & more for Each keyword.
- **Mobile App:** Add the PWA app to your mobile for a better mobile experience.
- **Zero Cost to RUN:** Run the App on mogenius.com or Fly.io for free.

#### How it Works

The App uses third party website scrapers like ScrapingAnt, ScrapingRobot, SearchApi, SerpApi, HasData or Your given Proxy ips to scrape google search results to see if your domain appears in the search result for the given keyword.

The Keyword Research and keyword generation feature works by integrating your Google Ads test accounts into SerpBear. You can also view the added keyword's monthly search volume data once you [integrate Google Ads](https://docs.serpbear.com/miscellaneous/integrate-google-ads).

When you [integrate Google Search Console](https://docs.serpbear.com/miscellaneous/integrate-google-search-console), the app shows actual search visits for each tracked keywords. You can also discover new keywords, and find the most performing keywords, countries, pages.you will be able to view the actual visits count from Google Search for the tracked keywords.

#### Install

The easiest way to run this fork is with our Docker image on Docker Hub: [`gigeritch/serpbear`](https://hub.docker.com/r/gigeritch/serpbear).

Use `latest` for the newest stable fork release, or pin a version tag for predictable deployments.

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

After the container starts, open `http://localhost:3000` and log in with the credentials you configured.

#### Getting Started

- **Step 1:** Install and run the App, preferably with the Docker image above.
- **Step 2:** Access your App and Login.
- **Step 3:** Add your First domain.
- **Step 4:** Pick a SERP provider from the list below. Several offer a free tier, or you can skip this step and use your own proxy IPs.
- **Step 5:** Setup the Scraping API/Proxy from the App's Settings interface.
- **Step 6:** Add your keywords and start tracking.
- **Step 7:** Optional. From the Settings panel, setup SMTP details to get notified of your keywords positions through email. You can use ElasticEmail and Sendpulse SMTP services that are free.

#### SerpBear Integrates with popular SERP scraping services

If you don't want to use proxies, you can use third party Scraping services to scrape Google Search results.

| Service           | Pricing                              | Free tier             | Included usage         | API |
| ----------------- | ------------------------------------ | --------------------- | ---------------------- | --- |
| hasdata.com       | From $49/mo                          | 1,000 requests/mo     | 200,000 requests/mo    | Yes |
| scrapingant.com   | From $19/mo                          | 10,000 API credits/mo | 100,000 API credits/mo | Yes |
| scrapingrobot.com | Usage-based from $0.00004/request    | 5,000 requests/mo     | Pay as you go          | Yes |
| searchapi.io      | From $40/mo                          | 100 requests          | 10,000 searches/mo     | Yes |
| serpapi.com       | From $25/mo                          | 250 searches/mo       | 1,000 searches/mo      | Yes |
| serper.dev        | Usage-based from $0.30/1,000 queries | 2,500 queries         | Pay as you go          | Yes |
| serply.io         | From $50/mo                          | 300 requests/mo       | 50,000 requests/mo     | Yes |
| spaceserp.com     | From $14.99/mo                       | None found            | 1,000 searches/mo      | Yes |
| valueserp.com     | From $50/mo                          | Free trial            | 25,000 credits/mo      | Yes |

Pricing and free-tier details were checked against the providers' public pricing pages on 2026-03-25 and may change over time.

**Tech Stack**

- Next.js for Frontend & Backend.
- Sqlite for Database.

#### Releases

- Source code releases are published in [`gigerIT/serpbear` releases](https://github.com/gigerIT/serpbear/releases).
- Docker images are published on Docker Hub at [`gigeritch/serpbear`](https://hub.docker.com/r/gigeritch/serpbear).
- We recommend pinning a version tag in production and moving to newer releases on your own schedule.

#### Release Automation

- GitHub Actions runs CI on every pull request and push to `main`.
- [`release-please`](https://github.com/googleapis/release-please) creates or updates the release PR after releasable commits land on `main`.
- Merging that release PR automatically creates the GitHub release, rebuilds the released tag, and publishes Docker images to the configured Docker Hub repository.
- Required repository secrets: `RELEASE_PLEASE_TOKEN`, `DOCKERHUB_TOKEN`.
- Required repository variables: `DOCKERHUB_USERNAME`, `DOCKERHUB_REPOSITORY`.
