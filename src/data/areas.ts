/**
 * Places, at the only resolution earshot is allowed to know them.
 *
 * A GPS reading is turned into one of these neighbourhood-sized areas the
 * moment it arrives (see `areaFromCoords`) and the coordinates are dropped.
 * Nothing finer than an area id is ever stored, compared or shown.
 */
import type { Area } from './types';

type Zone = Area & { lat: number; lng: number };

const ZONES: Zone[] = [
  // Toronto
  { id: 'to-downtown', name: 'Downtown core', city: 'Toronto', lat: 43.651, lng: -79.3832 },
  { id: 'to-queen-west', name: 'Queen West', city: 'Toronto', lat: 43.6468, lng: -79.408 },
  { id: 'to-kensington', name: 'Kensington & Chinatown', city: 'Toronto', lat: 43.6545, lng: -79.4005 },
  { id: 'to-annex', name: 'The Annex', city: 'Toronto', lat: 43.669, lng: -79.407 },
  { id: 'to-yorkville', name: 'U of T & Yorkville', city: 'Toronto', lat: 43.668, lng: -79.393 },
  { id: 'to-little-italy', name: 'Little Italy', city: 'Toronto', lat: 43.6553, lng: -79.418 },
  { id: 'to-liberty', name: 'Liberty Village', city: 'Toronto', lat: 43.638, lng: -79.42 },
  { id: 'to-parkdale', name: 'Parkdale', city: 'Toronto', lat: 43.64, lng: -79.437 },
  { id: 'to-roncy', name: 'Roncesvalles & High Park', city: 'Toronto', lat: 43.649, lng: -79.45 },
  { id: 'to-junction', name: 'The Junction', city: 'Toronto', lat: 43.6655, lng: -79.465 },
  { id: 'to-st-clair', name: 'St. Clair West', city: 'Toronto', lat: 43.68, lng: -79.43 },
  { id: 'to-leslieville', name: 'Leslieville', city: 'Toronto', lat: 43.6626, lng: -79.337 },
  { id: 'to-danforth', name: 'The Danforth', city: 'Toronto', lat: 43.678, lng: -79.349 },
  { id: 'to-east-york', name: 'East York', city: 'Toronto', lat: 43.691, lng: -79.328 },
  { id: 'to-beaches', name: 'The Beaches', city: 'Toronto', lat: 43.671, lng: -79.296 },
  { id: 'to-yonge-eg', name: 'Yonge & Eglinton', city: 'Toronto', lat: 43.7065, lng: -79.3985 },
  { id: 'to-north-york', name: 'North York Centre', city: 'Toronto', lat: 43.768, lng: -79.4125 },
  { id: 'to-york-u', name: 'York University', city: 'Toronto', lat: 43.7735, lng: -79.5019 },
  { id: 'to-scarborough', name: 'Scarborough Town Centre', city: 'Toronto', lat: 43.776, lng: -79.2578 },
  { id: 'to-etobicoke', name: 'Etobicoke lakeshore', city: 'Toronto', lat: 43.602, lng: -79.501 },
  // Vaughan
  { id: 'va-vmc', name: 'Vaughan Metropolitan Centre', city: 'Vaughan', lat: 43.794, lng: -79.527 },
  { id: 'va-woodbridge', name: 'Woodbridge', city: 'Vaughan', lat: 43.783, lng: -79.599 },
  { id: 'va-maple', name: 'Maple', city: 'Vaughan', lat: 43.853, lng: -79.509 },
  { id: 'va-thornhill', name: 'Thornhill', city: 'Vaughan', lat: 43.816, lng: -79.424 },
  // The rest of the GTA
  { id: 'mi-square-one', name: 'Square One', city: 'Mississauga', lat: 43.593, lng: -79.642 },
  { id: 'mi-port-credit', name: 'Port Credit', city: 'Mississauga', lat: 43.551, lng: -79.586 },
  { id: 'br-downtown', name: 'Downtown Brampton', city: 'Brampton', lat: 43.685, lng: -79.76 },
  { id: 'br-bramalea', name: 'Bramalea', city: 'Brampton', lat: 43.716, lng: -79.723 },
  { id: 'ma-unionville', name: 'Unionville', city: 'Markham', lat: 43.866, lng: -79.311 },
  { id: 'rh-centre', name: 'Richmond Hill Centre', city: 'Richmond Hill', lat: 43.878, lng: -79.438 },
  { id: 'oa-downtown', name: 'Downtown Oakville', city: 'Oakville', lat: 43.447, lng: -79.666 },
];

/** Areas you can pick by hand, without coordinates attached. */
export const areas: Area[] = ZONES.map(({ id, name, city }) => ({ id, name, city }));

/** The home cities on offer. The GTA region rolls all of them up. */
export const cities = ['Toronto', 'Vaughan', 'Mississauga', 'Brampton', 'Markham', 'Richmond Hill', 'Oakville'] as const;
export const REGION = 'GTA';

const OFF_MAP_PREFIX = 'cell:';

export function areaById(id: string): Area {
  const z = ZONES.find((a) => a.id === id);
  if (z) return { id: z.id, name: z.name, city: z.city };
  // Somewhere we have no neighbourhood names for: an anonymous ~5 km square.
  return { id, name: 'Somewhere off our map', city: null };
}

function km(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const x = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.hypot(x, y) * 6371;
}

/**
 * Coarsen a location reading. This is the only function in the app that takes
 * coordinates, and all it gives back is an area. Inside the GTA that's the
 * nearest named neighbourhood; anywhere else it's a ~5 km grid square, so
 * Nearby still works when you travel.
 */
export function areaFromCoords(lat: number, lng: number): Area {
  let best: Zone | null = null;
  let bestKm = Infinity;
  for (const z of ZONES) {
    const d = km(lat, lng, z.lat, z.lng);
    if (d < bestKm) {
      best = z;
      bestKm = d;
    }
  }
  if (best && bestKm <= 8) return { id: best.id, name: best.name, city: best.city };
  const cell = (v: number) => (Math.round(v / 0.05) * 0.05).toFixed(2);
  return areaById(`${OFF_MAP_PREFIX}${cell(lat)}:${cell(lng)}`);
}
