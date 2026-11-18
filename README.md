# Oxforeshire-weather

Oxfordshire weather report with a live satellite and rain radar map. Built by Supernet UK Limited.

A single static web page. No server code, no build step and no API keys.

## What it shows

- **Weather report**: a short county-wide summary for today, tomorrow and the day after (temperature range, warmest and coldest towns, chance of rain, strong gusts, frost warning).
- **Satellite map**: the latest Meteosat image from EUMETSAT, with three views: colour (day and night), infrared clouds and airmass.
- **Rain radar**: the last 2 hours of radar, with a play button to animate it.
- **Towns**: current conditions and the daily forecast for Oxford, Witney, Banbury, Bicester, Abingdon, Didcot, Wantage, Thame, Henley-on-Thames and Chipping Norton.

Works on phones and supports dark mode.

## Files

| File | Purpose |
|---|---|
| `index.html` | The page |
| `style.css` | Layout and colours |
| `js/app.js` | Loads the data and draws the report, town cards and map (Leaflet) |
| `js/weather.js` | Towns, forecast URL, weather codes and report wording (no DOM, tested) |
| `js/map.js` | Satellite layers and radar frame helpers (no DOM, tested) |
| `tests/weather.test.js` | Tests for `weather.js` and `map.js` |

## Run it locally

```bash
npm start          # serves the folder on http://localhost:8080
```

Any static web server works; opening `index.html` straight from disk will not, because the scripts are ES modules.

## Tests

Uses Node's built-in test runner (Node 18 or later), so nothing needs installing.

```bash
npm test
```

## Deploy

Upload `index.html`, `style.css` and the `js/` folder to any web host, for example a folder on the cPanel site. Nothing else is needed.

## Data sources

| Data | Source | Notes |
|---|---|---|
| Forecast | [Open-Meteo](https://open-meteo.com/) | One request for all towns. Free for non-commercial use; commercial use needs an Open-Meteo API plan. |
| Satellite | [EUMETSAT EUMETView](https://view.eumetsat.int) WMS | Layers `mtg_fd:rgb_geocolour`, `msg_fes:ir108`, `msg_fes:rgb_airmass`. Latest image, refreshed about every 15 minutes. |
| Rain radar | [RainViewer](https://www.rainviewer.com/) | Free for personal and small-scale use; tiles go up to zoom 7. |
| Base map | [OpenStreetMap](https://www.openstreetmap.org/copyright) | Attribution must stay visible. |

To add or change towns, edit `TOWNS` in `js/weather.js`.

## Before using this for a client or a commercial site

- Take an Open-Meteo commercial plan. The API key would then be visible in a static page, so route forecast requests through a small Cloudflare Worker that keeps the key with `wrangler secret put`.
- Check RainViewer's terms for commercial use, or replace the radar layer.
