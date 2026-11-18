/**
 * The one place earshot touches the phone's location.
 *
 * A reading is turned into a coarse area on the spot and the coordinates go
 * out of scope right here. They are never returned, stored, logged or sent.
 * Foreground only: there is no background location anywhere in the app.
 */
import * as Location from 'expo-location';
import { areaFromCoords } from './areas';
import type { Area } from './types';

export type LocateResult = { ok: true; area: Area } | { ok: false; reason: 'denied' | 'off' | 'unavailable' };

const timeout = <T,>(ms: number) => new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

async function read(): Promise<Area> {
  // A position the phone already has from the last ten minutes is plenty for a neighbourhood, and instant.
  const recent = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 }).catch(() => null);
  // Not "Low": on Android that never wakes the location hardware, so it waits for another app to ask and times out.
  const pos =
    recent ??
    (await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeout<Location.LocationObject>(20_000)]));
  return areaFromCoords(pos.coords.latitude, pos.coords.longitude);
}

/** Ask permission (this shows the system prompt the first time), then find the area. */
export async function locateArea(): Promise<LocateResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };
    if (!(await Location.hasServicesEnabledAsync().catch(() => true))) return { ok: false, reason: 'off' };
    return { ok: true, area: await read() };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** Re-check the area without ever prompting: only works if permission was already given. */
export async function relocateQuietly(): Promise<Area | null> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    return await read();
  } catch {
    return null;
  }
}
