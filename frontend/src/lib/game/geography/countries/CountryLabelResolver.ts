import type { CountryBoundary, CountrySummary } from './CountryBoundary';

export function countryLabel(country: Readonly<CountryBoundary | CountrySummary>): string {
	return country.continent ? `${country.name} · ${country.continent}` : country.name;
}
