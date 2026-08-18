import { describe, expect, it } from 'vitest';
import {
	createViewport,
	fitLocations,
	geographicAtPixel,
	geographicCenter,
	pan,
	recenter,
	zoomAt
} from './MapViewport';

describe('MapViewport', () => {
	it('pans, clamps zoom, and recenters', () => {
		const viewport = createViewport(0, 0, 3);
		expect(geographicCenter(pan(viewport, 100, 0, 1000)).longitude).toBeLessThan(0);
		expect(zoomAt(viewport, 99).zoom).toBe(17);
		expect(zoomAt(viewport, -99).zoom).toBe(1);
		expect(geographicCenter(recenter(viewport, -1.2, 36.8)).latitude).toBeCloseTo(-1.2, 4);
	});

	it('converts a canvas pixel back into a geographic coordinate', () => {
		const viewport = createViewport(0.3476, 32.5825, 4);
		const center = geographicAtPixel(viewport, 600, 400, 1200, 800);
		expect(center.latitude).toBeCloseTo(0.3476, 5);
		expect(center.longitude).toBeCloseTo(32.5825, 5);

		const east = geographicAtPixel(viewport, 700, 400, 1200, 800);
		expect(east.longitude).toBeGreaterThan(center.longitude);
	});

	it('fits a dateline-crossing route without zooming out to the whole earth', () => {
		const fitted = fitLocations(
			createViewport(0, 0),
			[
				{ latitude: 1, longitude: 179 },
				{ latitude: 1, longitude: -179 }
			],
			1.6
		);
		expect(fitted.zoom).toBeGreaterThan(4);
	});
});
