import { boundsFor, project, unproject, type MapPoint } from './WorldMapProjection';
import type { WorldLocation } from '../geography/WorldLocation';
export interface MapViewport {
	center: MapPoint;
	zoom: number;
}
export function createViewport(latitude: number, longitude: number, zoom = 3): MapViewport {
	return { center: project(latitude, longitude), zoom };
}
export function pan(
	viewport: MapViewport,
	dxPixels: number,
	dyPixels: number,
	width: number
): MapViewport {
	const scale = 2 ** viewport.zoom * width;
	return {
		...viewport,
		center: {
			x: wrap(viewport.center.x - dxPixels / scale),
			y: Math.max(0, Math.min(1, viewport.center.y - dyPixels / scale))
		}
	};
}
export function zoomAt(viewport: MapViewport, delta: number): MapViewport {
	return { ...viewport, zoom: Math.max(1, Math.min(17, viewport.zoom + delta)) };
}
export function geographicCenter(viewport: MapViewport) {
	return unproject(viewport.center.x, viewport.center.y);
}
export function viewportBounds(viewport: MapViewport, aspect: number) {
	return boundsFor(viewport.center, viewport.zoom, Math.max(0.1, aspect));
}
export function recenter(viewport: MapViewport, latitude: number, longitude: number): MapViewport {
	return { ...viewport, center: project(latitude, longitude) };
}
export function fitLocations(
	viewport: MapViewport,
	locations: readonly Pick<WorldLocation, 'latitude' | 'longitude'>[],
	aspect: number
): MapViewport {
	if (!locations.length) return viewport;
	const points = locations.map((location) => project(location.latitude, location.longitude));
	const first = points[0];
	const xs = points.map((point) => unwrap(point.x, first.x));
	const minimumX = Math.min(...xs),
		maximumX = Math.max(...xs);
	const minimumY = Math.min(...points.map((point) => point.y)),
		maximumY = Math.max(...points.map((point) => point.y));
	const span = Math.max(
		1 / 512,
		((maximumX - minimumX) * 1.35) / Math.max(0.1, aspect),
		(maximumY - minimumY) * 1.35
	);
	return {
		center: {
			x: wrap((minimumX + maximumX) / 2),
			y: Math.max(0, Math.min(1, (minimumY + maximumY) / 2))
		},
		zoom: Math.max(1, Math.min(17, Math.log2(1 / span)))
	};
}
function wrap(value: number): number {
	return ((value % 1) + 1) % 1;
}
function unwrap(value: number, reference: number): number {
	let result = value;
	while (result - reference > 0.5) result -= 1;
	while (result - reference < -0.5) result += 1;
	return result;
}
