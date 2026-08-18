import { describe, expect, it } from 'vitest';

import type { CountryBoundary } from '../../geography/countries/CountryBoundary';
import {
	countryLabelDistanceScale,
	countryLabelHeightUnits,
	countryLabelImportance
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

	it('keeps labels bounded when the camera approaches the surface', () => {
		expect(countryLabelDistanceScale(118, 100)).toBeGreaterThanOrEqual(0.34);
		expect(countryLabelDistanceScale(285, 100)).toBeCloseTo(1, 5);
		expect(countryLabelDistanceScale(900, 100)).toBeLessThanOrEqual(1.35);
	});
});
