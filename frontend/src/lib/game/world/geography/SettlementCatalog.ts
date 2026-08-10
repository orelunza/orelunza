import type { CountrySummary } from '../../geography/countries/CountryBoundary';

export interface SettlementAnchor {
	id: string;
	name: string;
	countryId: string;
	countryName: string;
	latitude: number;
	longitude: number;
	type: 'city' | 'entry-settlement';
	generationSeed: string;
}

// Small bundled verified seed catalog. Countries not listed use their country-boundary label,
// deliberately named as an entry settlement rather than inventing a real city.
const PRIMARY_SETTLEMENTS: readonly SettlementAnchor[] = [
	{
		id: 'ug-kampala',
		name: 'Kampala',
		countryId: 'UGA',
		countryName: 'Uganda',
		latitude: 0.3476,
		longitude: 32.5825,
		type: 'city',
		generationSeed: 'ug-kampala'
	},
	{
		id: 'ke-nairobi',
		name: 'Nairobi',
		countryId: 'KEN',
		countryName: 'Kenya',
		latitude: -1.2864,
		longitude: 36.8172,
		type: 'city',
		generationSeed: 'ke-nairobi'
	}
];
export function settlementForCountry(country: Readonly<CountrySummary>): SettlementAnchor {
	const known = PRIMARY_SETTLEMENTS.find(
		(entry) => entry.countryId === country.isoA3 || entry.countryId === country.id
	);
	return (
		known ?? {
			id: `entry/${country.id}`,
			name: `${country.name} Entry Settlement`,
			countryId: country.id,
			countryName: country.name,
			latitude: country.labelLatitudeDegrees,
			longitude: country.labelLongitudeDegrees,
			type: 'entry-settlement',
			generationSeed: `entry/${country.id}`
		}
	);
}
