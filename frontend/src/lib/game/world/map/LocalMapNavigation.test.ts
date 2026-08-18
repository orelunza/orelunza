import { describe, expect, it } from 'vitest';
import {
	compassDirection,
	initialBearingDegrees,
	localDestinationVector
} from './LocalMapNavigation';

describe('local map navigation', () => {
	it('keeps nearby east/north displacement aligned with geography', () => {
		const vector = localDestinationVector(
			{ latitude: 0, longitude: 0 },
			{ latitude: 0.01, longitude: 0.01 }
		);
		expect(vector.northMeters).toBeGreaterThan(1100);
		expect(vector.eastMeters).toBeGreaterThan(1100);
		expect(vector.bearingDegrees).toBeGreaterThan(40);
		expect(vector.bearingDegrees).toBeLessThan(50);
	});

	it('computes cardinal bearings across the date line', () => {
		const bearing = initialBearingDegrees(
			{ latitude: 0, longitude: 179.9 },
			{ latitude: 0, longitude: -179.9 }
		);
		expect(bearing).toBeCloseTo(90, 5);
		expect(compassDirection(bearing)).toBe('E');
	});

	it('formats the eight principal compass directions', () => {
		expect(compassDirection(0)).toBe('N');
		expect(compassDirection(46)).toBe('NE');
		expect(compassDirection(181)).toBe('S');
		expect(compassDirection(315)).toBe('NW');
	});
});
