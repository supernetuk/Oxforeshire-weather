/* global L */
import { TOWNS, buildForecastUrl, parseForecast, describeCode, summarise, dayLabel } from './weather.js';
import {
  OXFORDSHIRE_CENTRE, EUMETSAT_WMS, SATELLITE_LAYERS, RAINVIEWER_INDEX,
  RAINVIEWER_MAX_ZOOM, radarFrames, formatTime, cacheKey,
} from './map.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = v => (typeof v === 'number' ? Math.round(v) : '–');

let selectedDay = 0;
let forecast = [];

// ------------------------------------------------------------- weather report
async function loadForecast() {
  const status = $('#report-status');
  status.textContent = 'Loading forecast…';
  try {
    const res = await fetch(buildForecastUrl());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    forecast = parseForecast(await res.json());
    renderReport();
    renderTowns();
    addTownMarkers();
    status.textContent = `Updated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (e) {
    status.textContent = `Could not load the forecast (${e.message}). Try again later.`;
  }
}

function renderDayTabs() {
  const tabs = $('#day-tabs');
  const days = forecast[0]?.days || [];
  tabs.innerHTML = days.map((d, i) =>
    `<button role="tab" aria-selected="${i === selectedDay}" data-day="${i}">${esc(dayLabel(d.date, i))}</button>`
  ).join('');
  tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    selectedDay = Number(b.dataset.day);
    renderReport();
    renderTowns();
  }));
}

function renderReport() {
  renderDayTabs();
  const lines = summarise(forecast, selectedDay);
  $('#report-text').innerHTML = lines.map(l => `<p>${esc(l)}</p>`).join('');
}

function renderTowns() {
  $('#towns').innerHTML = forecast.map(t => {
    const d = t.days[selectedDay] || {};
    const showNow = selectedDay === 0;
    const w = describeCode(showNow ? t.now.code : d.code, showNow ? t.now.isDay : true);
    return `
      <article class="town">
        <h3>${esc(t.town)}</h3>
        <div class="big"><span class="icon" aria-hidden="true">${w.icon}</span>
          ${showNow ? `<span class="temp">${n(t.now.temp)}°</span>` : ''}</div>
        <p class="desc">${esc(w.text)}</p>
        <dl>
          <dt>High / low</dt><dd>${n(d.max)}° / ${n(d.min)}°</dd>
          <dt>Rain</dt><dd>${n(d.rainChance)}% · ${d.rainMm ?? '–'} mm</dd>
          <dt>Gusts</dt><dd>${n(d.gustMax)} mph</dd>
          ${showNow ? `<dt>Feels like</dt><dd>${n(t.now.feels)}°</dd><dt>Wind now</dt><dd>${n(t.now.wind)} mph</dd>` : ''}
        </dl>
      </article>`;
  }).join('');
}

// ------------------------------------------------------------- map
const map = L.map('map', { zoomControl: true }).setView(OXFORDSHIRE_CENTRE, 8);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 12,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const satellite = {};
for (const s of SATELLITE_LAYERS) {
  satellite[s.name] = L.tileLayer.wms(EUMETSAT_WMS, {
    layers: s.layer,
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    opacity: 0.85,
    attribution: 'Satellite &copy; <a href="https://view.eumetsat.int">EUMETSAT</a>',
    v: cacheKey(),          // extra option → URL parameter, forces a fresh image every 15 min
  });
}
satellite[SATELLITE_LAYERS[0].name].addTo(map);

const radarGroup = L.layerGroup().addTo(map);
L.control.layers(satellite, { 'Rain radar (last 2 hours)': radarGroup }, { collapsed: false }).addTo(map);

let townLayer;
function addTownMarkers() {
  if (townLayer) townLayer.remove();
  townLayer = L.layerGroup(forecast.map(t => {
    const w = describeCode(t.now.code, t.now.isDay);
    return L.marker([t.lat, t.lon], {
      icon: L.divIcon({ className: 'town-pin', html: `${w.icon}<b>${n(t.now.temp)}°</b>`, iconSize: null }),
      title: t.town,
    }).bindPopup(`<b>${esc(t.town)}</b><br>${esc(w.text)}, ${n(t.now.temp)}°C<br>Wind ${n(t.now.wind)} mph`);
  })).addTo(map);
}

// ------------------------------------------------------------- radar animation
let frames = [];
let frameLayers = [];
let frameIndex = 0;
let timer = null;

async function loadRadar() {
  try {
    const res = await fetch(RAINVIEWER_INDEX);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    frames = radarFrames(await res.json());
  } catch {
    frames = [];
  }
  radarGroup.clearLayers();
  frameLayers = frames.map(f => L.tileLayer(f.url, {
    opacity: 0, maxNativeZoom: RAINVIEWER_MAX_ZOOM, maxZoom: 12,
    attribution: 'Radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>',
  }).addTo(radarGroup));
  frameIndex = Math.max(0, frames.length - 1);
  showFrame(frameIndex);
  $('#radar-status').textContent = frames.length ? '' : 'Radar unavailable right now.';
}

function showFrame(i) {
  if (!frameLayers.length) return;
  frameLayers.forEach((l, j) => l.setOpacity(j === i ? 0.7 : 0));
  $('#radar-time').textContent = `Radar ${formatTime(frames[i].time)}`;
}

$('#play').addEventListener('click', () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    $('#play').textContent = '▶ Play radar';
    return;
  }
  $('#play').textContent = '⏸ Pause';
  timer = setInterval(() => {
    frameIndex = (frameIndex + 1) % frameLayers.length;
    showFrame(frameIndex);
  }, 700);
});

// ------------------------------------------------------------- start
loadForecast();
loadRadar();
setInterval(loadForecast, 30 * 60 * 1000);   // forecast every 30 min
setInterval(loadRadar, 10 * 60 * 1000);      // radar frames every 10 min
