// Pure map helpers (no DOM, no network) so they can be tested.

export const OXFORDSHIRE_CENTRE = [51.78, -1.30];

// EUMETSAT EUMETView WMS (free, no key). Without a TIME parameter the
// server returns its latest image.
export const EUMETSAT_WMS = 'https://view.eumetsat.int/geoserver/wms';

export const SATELLITE_LAYERS = [
  { id: 'geocolour', name: 'Satellite – colour (day & night)', layer: 'mtg_fd:rgb_geocolour' },
  { id: 'ir',        name: 'Satellite – infrared (clouds)',     layer: 'msg_fes:ir108' },
  { id: 'airmass',   name: 'Satellite – airmass',               layer: 'msg_fes:rgb_airmass' },
];

export const RAINVIEWER_INDEX = 'https://api.rainviewer.com/public/weather-maps.json';
export const RAINVIEWER_MAX_ZOOM = 7;   // RainViewer tiles stop at zoom 7

// Tile URL template for one RainViewer radar frame, for Leaflet's {z}/{x}/{y}.
// color 2 = "Universal Blue"; options "1_1" = smoothed, snow shown separately.
export function radarTileUrl(host, path, { size = 256, color = 2, smooth = 1, snow = 1 } = {}) {
  return `${host}${path}/${size}/{z}/{x}/{y}/${color}/${smooth}_${snow}.png`;
}

// The past radar frames (oldest first), from RainViewer's weather-maps.json.
export function radarFrames(index) {
  const past = index?.radar?.past;
  if (!Array.isArray(past) || !index.host) return [];
  return past
    .filter(f => f && typeof f.time === 'number' && typeof f.path === 'string')
    .sort((a, b) => a.time - b.time)
    .map(f => ({ time: f.time, url: radarTileUrl(index.host, f.path) }));
}

export function formatTime(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London',
  });
}

// A value that changes every `minutes`, used to make the browser fetch the
// newest satellite image instead of a cached one.
export function cacheKey(now = Date.now(), minutes = 15) {
  return String(Math.floor(now / (minutes * 60 * 1000)));
}
