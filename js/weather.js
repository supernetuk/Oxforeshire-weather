// Pure weather logic: no DOM, no network. Used by the page (js/app.js) and the tests.

export const TOWNS = [
  { name: 'Oxford',           lat: 51.7520, lon: -1.2577 },
  { name: 'Witney',           lat: 51.7859, lon: -1.4851 },
  { name: 'Banbury',          lat: 52.0629, lon: -1.3398 },
  { name: 'Bicester',         lat: 51.8998, lon: -1.1537 },
  { name: 'Abingdon',         lat: 51.6708, lon: -1.2880 },
  { name: 'Didcot',           lat: 51.6089, lon: -1.2408 },
  { name: 'Wantage',          lat: 51.5887, lon: -1.4265 },
  { name: 'Thame',            lat: 51.7448, lon: -0.9765 },
  { name: 'Henley-on-Thames', lat: 51.5357, lon: -0.9033 },
  { name: 'Chipping Norton',  lat: 51.9416, lon: -1.5450 },
];

const CURRENT = [
  'temperature_2m', 'apparent_temperature', 'weather_code',
  'wind_speed_10m', 'wind_gusts_10m', 'precipitation', 'is_day',
];
const DAILY = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min',
  'precipitation_probability_max', 'precipitation_sum', 'wind_gusts_10m_max',
  'sunrise', 'sunset',
];

// One Open-Meteo request for all towns (comma-separated coordinates).
export function buildForecastUrl(towns = TOWNS, days = 3) {
  const p = new URLSearchParams({
    latitude: towns.map(t => t.lat).join(','),
    longitude: towns.map(t => t.lon).join(','),
    current: CURRENT.join(','),
    daily: DAILY.join(','),
    wind_speed_unit: 'mph',
    timezone: 'Europe/London',
    forecast_days: String(days),
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

// WMO weather codes used by Open-Meteo.
const CODES = {
  0: ['Clear sky', '☀️', '🌙'],
  1: ['Mainly clear', '🌤️', '🌙'],
  2: ['Partly cloudy', '⛅', '☁️'],
  3: ['Overcast', '☁️', '☁️'],
  45: ['Fog', '🌫️', '🌫️'],
  48: ['Freezing fog', '🌫️', '🌫️'],
  51: ['Light drizzle', '🌦️', '🌧️'],
  53: ['Drizzle', '🌦️', '🌧️'],
  55: ['Heavy drizzle', '🌧️', '🌧️'],
  56: ['Freezing drizzle', '🌧️', '🌧️'],
  57: ['Heavy freezing drizzle', '🌧️', '🌧️'],
  61: ['Light rain', '🌦️', '🌧️'],
  63: ['Rain', '🌧️', '🌧️'],
  65: ['Heavy rain', '🌧️', '🌧️'],
  66: ['Freezing rain', '🌧️', '🌧️'],
  67: ['Heavy freezing rain', '🌧️', '🌧️'],
  71: ['Light snow', '🌨️', '🌨️'],
  73: ['Snow', '🌨️', '🌨️'],
  75: ['Heavy snow', '❄️', '❄️'],
  77: ['Snow grains', '🌨️', '🌨️'],
  80: ['Light showers', '🌦️', '🌧️'],
  81: ['Showers', '🌧️', '🌧️'],
  82: ['Violent showers', '⛈️', '⛈️'],
  85: ['Snow showers', '🌨️', '🌨️'],
  86: ['Heavy snow showers', '❄️', '❄️'],
  95: ['Thunderstorm', '⛈️', '⛈️'],
  96: ['Thunderstorm with hail', '⛈️', '⛈️'],
  99: ['Severe thunderstorm with hail', '⛈️', '⛈️'],
};

export function describeCode(code, isDay = true) {
  const c = CODES[code];
  if (!c) return { text: 'Unknown', icon: '❔' };
  return { text: c[0], icon: isDay ? c[1] : c[2] };
}

// Open-Meteo returns one object for one location, an array for several.
// Pair each result with its town.
export function parseForecast(json, towns = TOWNS) {
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== towns.length) {
    throw new Error(`Expected ${towns.length} locations, got ${list.length}`);
  }
  return list.map((r, i) => {
    const c = r.current || {};
    const d = r.daily || {};
    const days = (d.time || []).map((date, j) => ({
      date,
      code: d.weather_code?.[j],
      max: d.temperature_2m_max?.[j],
      min: d.temperature_2m_min?.[j],
      rainChance: d.precipitation_probability_max?.[j],
      rainMm: d.precipitation_sum?.[j],
      gustMax: d.wind_gusts_10m_max?.[j],
      sunrise: d.sunrise?.[j],
      sunset: d.sunset?.[j],
    }));
    return {
      town: towns[i].name,
      lat: towns[i].lat,
      lon: towns[i].lon,
      now: {
        time: c.time,
        temp: c.temperature_2m,
        feels: c.apparent_temperature,
        code: c.weather_code,
        wind: c.wind_speed_10m,
        gust: c.wind_gusts_10m,
        rain: c.precipitation,
        isDay: c.is_day === 1,
      },
      days,
    };
  });
}

const round = n => Math.round(n);

function maxBy(items, f) {
  return items.reduce((best, x) => (f(x) > f(best) ? x : best));
}
function minBy(items, f) {
  return items.reduce((best, x) => (f(x) < f(best) ? x : best));
}

// A short county-wide report for one day (0 = today) as plain sentences.
export function summarise(towns, dayIndex = 0) {
  const rows = towns
    .map(t => ({ town: t.town, ...t.days[dayIndex] }))
    .filter(r => typeof r.max === 'number' && typeof r.min === 'number');
  if (!rows.length) return [];

  const warm = maxBy(rows, r => r.max);
  const cold = minBy(rows, r => r.min);
  const wet = maxBy(rows, r => r.rainChance ?? 0);
  const windy = maxBy(rows, r => r.gustMax ?? 0);

  // Most common weather type across the county.
  const counts = {};
  for (const r of rows) counts[r.code] = (counts[r.code] || 0) + 1;
  const mainCode = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);

  const out = [];
  out.push(`${describeCode(mainCode).text} across most of Oxfordshire.`);
  out.push(`Highs of ${round(Math.min(...rows.map(r => r.max)))}–${round(warm.max)}°C, warmest in ${warm.town}.`);
  out.push(`Lows down to ${round(cold.min)}°C in ${cold.town}.`);

  const chance = wet.rainChance ?? 0;
  if (chance >= 60) out.push(`Rain likely: up to ${chance}% chance, highest around ${wet.town}.`);
  else if (chance >= 30) out.push(`Some showers possible: up to ${chance}% chance, mainly around ${wet.town}.`);
  else out.push('Mostly dry.');

  const gust = round(windy.gustMax ?? 0);
  if (gust >= 40) out.push(`Strong gusts up to ${gust} mph, especially near ${windy.town}.`);
  else if (gust >= 25) out.push(`Breezy, gusts up to ${gust} mph.`);

  if (cold.min <= 0) out.push('Frost or ice likely overnight — take care on the roads.');
  return out;
}

export function dayLabel(isoDate, index) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Europe/London' });
}
