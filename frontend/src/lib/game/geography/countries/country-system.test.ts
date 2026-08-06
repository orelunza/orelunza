import { describe, expect, test } from 'vitest';
import countryData from '../../../../../static/planet-data/preview/countries-110m.json';
import { CountryBoundaryIndex } from './CountryBoundaryIndex';
import { validateCountryBoundaryPayload } from './CountryBoundary';

const payload = validateCountryBoundaryPayload(countryData);
const index = new CountryBoundaryIndex(payload.countries);

describe('real country boundaries', () => {
	test.each([
		['Kampala', 0.3476, 32.5825, 'Uganda'],
		['Nairobi', -1.2864, 36.8172, 'Kenya'],
		['Kinshasa', -4.4419, 15.2663, 'Democratic Republic of the Congo'],
		['Paris', 48.8566, 2.3522, 'France'],
		['Brasília', -15.7939, -47.8828, 'Brazil']
	] as const)(
		'resolves %s to its Natural Earth country polygon',
		(_city: string, latitude: number, longitude: number, name: string) => {
			expect(index.resolve(latitude, longitude)?.name).toBe(name);
		}
	);

	test('returns no terrestrial country in the central Pacific', () => {
		expect(index.resolve(0, -140)).toBeNull();
	});

	test('keeps every record finite and indexable', () => {
		expect(payload.countries.length).toBeGreaterThan(170);
		for (const country of payload.countries) {
			expect(country.bounds.every(Number.isFinite)).toBe(true);
			expect(country.polygons.length).toBeGreaterThan(0);
			expect(index.get(country.id)?.name).toBe(country.name);
		}
	});
});
