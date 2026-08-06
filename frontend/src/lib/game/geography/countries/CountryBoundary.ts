export type GeographicPoint = readonly [longitudeDegrees: number, latitudeDegrees: number];
export type GeographicRing = readonly GeographicPoint[];
export type GeographicPolygon = readonly GeographicRing[];

export interface CountryBoundary {
	id: string;
	isoA3: string | null;
	name: string;
	continent: string;
	bounds: readonly [
		minimumLongitude: number,
		minimumLatitude: number,
		maximumLongitude: number,
		maximumLatitude: number
	];
	label: GeographicPoint;
	polygons: readonly GeographicPolygon[];
}

export interface CountryBoundaryPayload {
	version: 1;
	source: {
		name: string;
		version: string;
		license: string;
		url: string;
	};
	countries: CountryBoundary[];
}

export interface CountrySummary {
	id: string;
	isoA3: string | null;
	name: string;
	continent: string;
	labelLongitudeDegrees: number;
	labelLatitudeDegrees: number;
}

export function countrySummary(country: Readonly<CountryBoundary>): CountrySummary {
	return {
		id: country.id,
		isoA3: country.isoA3,
		name: country.name,
		continent: country.continent,
		labelLongitudeDegrees: country.label[0],
		labelLatitudeDegrees: country.label[1]
	};
}

export function validateCountryBoundaryPayload(value: unknown): CountryBoundaryPayload {
	if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.countries)) {
		throw new TypeError('Unsupported country boundary payload.');
	}
	const payload = value as unknown as CountryBoundaryPayload;
	for (const country of payload.countries) {
		if (
			typeof country.id !== 'string' ||
			typeof country.name !== 'string' ||
			typeof country.continent !== 'string' ||
			!Array.isArray(country.bounds) ||
			country.bounds.length !== 4 ||
			!country.bounds.every(Number.isFinite) ||
			!Array.isArray(country.label) ||
			country.label.length !== 2 ||
			!country.label.every(Number.isFinite) ||
			!Array.isArray(country.polygons)
		) {
			throw new TypeError('Invalid country boundary record.');
		}
	}
	return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
