export interface MapPoint {
	x: number;
	y: number;
}
export interface GeographicBounds {
	west: number;
	south: number;
	east: number;
	north: number;
}
const MAX_LATITUDE = 85.05112878;
export function project(latitude: number, longitude: number): MapPoint {
	const lat = (Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude)) * Math.PI) / 180;
	return {
		x: (normalizeLongitude(longitude) + 180) / 360,
		y: (1 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.PI) / 2
	};
}
export function normalizeLongitude(longitude: number): number {
	if (!Number.isFinite(longitude)) return 0;
	return ((longitude + 540) % 360) - 180;
}
export function unproject(x: number, y: number): { latitude: number; longitude: number } {
	const longitude = x * 360 - 180;
	const n = Math.PI - 2 * Math.PI * y;
	return {
		latitude: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
		longitude: ((longitude + 540) % 360) - 180
	};
}
export function boundsFor(center: MapPoint, zoom: number, aspect: number): GeographicBounds {
	const span = 1 / 2 ** zoom;
	const west = unproject(center.x - (span * aspect) / 2, center.y).longitude,
		east = unproject(center.x + (span * aspect) / 2, center.y).longitude;
	const north = unproject(center.x, center.y - span / 2).latitude,
		south = unproject(center.x, center.y + span / 2).latitude;
	return { west, south, east, north };
}
