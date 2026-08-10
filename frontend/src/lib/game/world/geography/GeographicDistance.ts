export interface GeographicDegrees {
	latitude: number;
	longitude: number;
}
const EARTH_RADIUS_KM = 6371.0088;
export function greatCircleDistanceKm(
	a: Readonly<GeographicDegrees>,
	b: Readonly<GeographicDegrees>
): number {
	const lat1 = radians(a.latitude),
		lat2 = radians(b.latitude);
	const dLat = lat2 - lat1,
		dLon = radians(normalizeLongitude(b.longitude - a.longitude));
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
function radians(value: number): number {
	return (value * Math.PI) / 180;
}
function normalizeLongitude(value: number): number {
	return ((value + 540) % 360) - 180;
}
