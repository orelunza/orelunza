import { describe, expect, it } from 'vitest';
import {
	createViewport,
	fitLocations,
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
