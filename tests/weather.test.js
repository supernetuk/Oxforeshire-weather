import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOWNS, buildForecastUrl, describeCode, parseForecast, summarise, dayLabel } from '../js/weather.js';
import { radarFrames, radarTileUrl, cacheKey, SATELLITE_LAYERS } from '../js/map.js';

// A fake Open-Meteo result for one location.
function fakeLocation({ temp = 8, code = 3, max = [10, 9, 8], min = [4, 2, -1], rain = [20, 70, 10], gust = [20, 45, 15] } = {}) {
  return {
    current: { time: '2026-11-18T12:00', temperature_2m: temp, apparent_temperature: temp - 3, weather_code: code, wind_speed_10m: 10, wind_gusts_10m: 20, precipitation: 0, is_day: 1 },
    daily: {
      time: ['2026-11-18', '2026-11-19', '2026-11-20'],
      weather_code: [code, 61, 0],
      temperature_2m_max: max,
      temperature_2m_min: min,
      precipitation_probability_max: rain,
      precipitation_sum: [0, 4.2, 0],
      wind_gusts_10m_max: gust,
      sunrise: ['2026-11-18T07:30', '2026-11-19T07:31', '2026-11-20T07:33'],
      sunset: ['2026-11-18T16:10', '2026-11-19T16:09', '2026-11-20T16:08'],
    },
  };
}

test('forecast URL asks for every town in one request', () => {
  const url = new URL(buildForecastUrl());
  assert.equal(url.hostname, 'api.open-meteo.com');
  assert.equal(url.searchParams.get('latitude').split(',').length, TOWNS.length);
  assert.equal(url.searchParams.get('longitude').split(',').length, TOWNS.length);
  assert.equal(url.searchParams.get('timezone'), 'Europe/London');
  assert.equal(url.searchParams.get('wind_speed_unit'), 'mph');
  assert.match(url.searchParams.get('daily'), /precipitation_probability_max/);
});

test('weather codes have a description and day/night icons', () => {
  assert.deepEqual(describeCode(0, true), { text: 'Clear sky', icon: '☀️' });
  assert.equal(describeCode(0, false).icon, '🌙');
  assert.equal(describeCode(63).text, 'Rain');
  assert.equal(describeCode(12345).text, 'Unknown');
});

test('parseForecast pairs each result with its town', () => {
  const towns = TOWNS.slice(0, 2);
  const parsed = parseForecast([fakeLocation({ temp: 7 }), fakeLocation({ temp: 9 })], towns);
  assert.equal(parsed[0].town, 'Oxford');
  assert.equal(parsed[1].town, 'Witney');
  assert.equal(parsed[1].now.temp, 9);
  assert.equal(parsed[0].days.length, 3);
  assert.equal(parsed[0].days[1].rainChance, 70);
});

test('parseForecast accepts a single object for one town', () => {
  const parsed = parseForecast(fakeLocation(), TOWNS.slice(0, 1));
  assert.equal(parsed.length, 1);
});

test('parseForecast rejects a wrong number of results', () => {
  assert.throws(() => parseForecast([fakeLocation()], TOWNS.slice(0, 2)), /Expected 2 locations/);
});

test('summary names the warmest and coldest towns', () => {
  const towns = TOWNS.slice(0, 2);
  const parsed = parseForecast([
    fakeLocation({ max: [10, 9, 8], min: [4, 2, 1] }),
    fakeLocation({ max: [12, 9, 8], min: [3, 2, 1] }),
  ], towns);
  const text = summarise(parsed, 0).join(' ');
  assert.match(text, /Highs of 10–12°C, warmest in Witney/);
  assert.match(text, /Lows down to 3°C in Witney/);
  assert.match(text, /Mostly dry/);
});

test('summary warns about rain, wind and frost', () => {
  const parsed = parseForecast([fakeLocation(), fakeLocation()], TOWNS.slice(0, 2));
  const tomorrow = summarise(parsed, 1).join(' ');
  assert.match(tomorrow, /Rain likely: up to 70% chance/);
  assert.match(tomorrow, /Strong gusts up to 45 mph/);
  const day3 = summarise(parsed, 2).join(' ');
  assert.match(day3, /Frost or ice likely/);
});

test('summary is empty when there is no data', () => {
  assert.deepEqual(summarise([], 0), []);
});

test('day labels', () => {
  assert.equal(dayLabel('2026-11-18', 0), 'Today');
  assert.equal(dayLabel('2026-11-19', 1), 'Tomorrow');
  assert.equal(dayLabel('2026-11-20', 2), 'Friday');
});

test('radar frames are sorted and turned into tile URLs', () => {
  const index = {
    host: 'https://tilecache.rainviewer.com',
    radar: { past: [{ time: 200, path: '/v2/radar/200' }, { time: 100, path: '/v2/radar/100' }, { bad: true }] },
  };
  const frames = radarFrames(index);
  assert.equal(frames.length, 2);
  assert.equal(frames[0].time, 100);
  assert.equal(frames[1].url, 'https://tilecache.rainviewer.com/v2/radar/200/256/{z}/{x}/{y}/2/1_1.png');
});

test('radar frames handle a broken response', () => {
  assert.deepEqual(radarFrames(null), []);
  assert.deepEqual(radarFrames({ radar: {} }), []);
});

test('radar tile URL options', () => {
  assert.equal(radarTileUrl('https://h', '/p', { size: 512, color: 4, smooth: 0, snow: 0 }), 'https://h/p/512/{z}/{x}/{y}/4/0_0.png');
});

test('satellite cache key changes every 15 minutes', () => {
  const t = Date.UTC(2026, 10, 18, 12, 0, 0);
  assert.equal(cacheKey(t), cacheKey(t + 14 * 60 * 1000));
  assert.notEqual(cacheKey(t), cacheKey(t + 15 * 60 * 1000));
});

test('satellite layers have unique ids and EUMETSAT layer names', () => {
  const ids = SATELLITE_LAYERS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of SATELLITE_LAYERS) assert.match(s.layer, /^(mtg_fd|msg_fes):/);
});
