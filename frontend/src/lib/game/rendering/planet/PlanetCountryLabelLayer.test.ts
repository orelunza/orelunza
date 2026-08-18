import { describe, expect, it } from 'vitest';

import type { CountryBoundary } from '../../geography/countries/CountryBoundary';
import {
	countryLabelDistanceScale,
	countryLabelHeightUnits,
	countryLabelImportance,
	countryLabelLines,
	countryLabelPixelHeight,
	countryLabelPlacementCandidates,
	screenRectFitsCircle
} from './PlanetCountryLabelLayer';

function country(name: string, bounds: CountryBoundary['bounds']): CountryBoundary {
	return {
		id: name.toLowerCase(),
		isoA3: null,
		name,
		continent: 'Test',
		bounds,
		label: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
		polygons: []
	};
}

describe('PlanetCountryLabelLayer sizing', () => {
	it('gives geographically larger countries more surface label area', () => {
		const small = country('Small', [0, 0, 2, 2]);
		const large = country('Large', [0, 0, 30, 20]);
		expect(countryLabelImportance(large)).toBeGreaterThan(countryLabelImportance(small));
		expect(countryLabelHeightUnits(large)).toBeGreaterThan(countryLabelHeightUnits(small));
	});

	it('keeps legacy marker scaling bounded when the camera approaches the surface', () => {
		expect(countryLabelDistanceScale(118, 100)).toBeGreaterThanOrEqual(0.34);
		expect(countryLabelDistanceScale(285, 100)).toBeCloseTo(1, 5);
		expect(countryLabelDistanceScale(900, 100)).toBeLessThanOrEqual(1.35);
	});

	it('keeps country text within a restrained readable screen-size range', () => {
		const uganda = country('Uganda', [29.5, -1.5, 35, 4.5]);
		const drc = country('Democratic Republic of the Congo', [12, -14, 31, 5.5]);
		for (const distance of [118, 285, 900]) {
			expect(countryLabelPixelHeight(uganda, distance, 100)).toBeGreaterThanOrEqual(11);
			expect(countryLabelPixelHeight(uganda, distance, 100)).toBeLessThanOrEqual(18);
			expect(countryLabelPixelHeight(drc, distance, 100)).toBeGreaterThanOrEqual(11);
			expect(countryLabelPixelHeight(drc, distance, 100)).toBeLessThanOrEqual(18);
		}
		expect(countryLabelPixelHeight(drc, 285, 100)).toBeGreaterThan(
			countryLabelPixelHeight(uganda, 285, 100)
		);
	});

	it('uses up to three lines for very long country names', () => {
		expect(countryLabelLines('Uganda')).toEqual(['Uganda']);
		expect(countryLabelLines('Central African Republic')).toEqual(['Central African', 'Republic']);
		expect(countryLabelLines('Democratic Republic of the Congo')).toHaveLength(3);
		expect(
			Math.max(...countryLabelLines('Democratic Republic of the Congo').map((line) => line.length))
		).toBeLessThan(20);
	});

	it('rejects labels whose rectangle crosses the visible globe silhouette', () => {
		const globe = { x: 100, y: 100, radius: 80 };
		expect(screenRectFitsCircle({ left: 70, top: 80, right: 130, bottom: 120 }, globe, 4)).toBe(
			true
		);
		expect(screenRectFitsCircle({ left: 5, top: 90, right: 55, bottom: 110 }, globe, 4)).toBe(
			false
		);
	});

	it('tries the geographic anchor first and then moves labels toward the globe centre', () => {
		const candidates = countryLabelPlacementCandidates(20, 100, { x: 100, y: 100, radius: 80 });
		expect(candidates[0]).toEqual({ dx: 0, dy: 0 });
		expect(candidates[1].dx).toBeGreaterThan(0);
		expect(Math.abs(candidates[1].dy)).toBeLessThan(1e-6);
		expect(candidates[3].dx).toBeGreaterThan(candidates[1].dx);
	});
});
