import type { CountryBoundary, GeographicRing } from './CountryBoundary';

interface LatitudeBucket {
	countries: CountryBoundary[];
}

export class CountryBoundaryIndex {
	private readonly latitudeBuckets = new Map<number, LatitudeBucket>();
	private readonly byId = new Map<string, CountryBoundary>();

	constructor(
		readonly countries: readonly CountryBoundary[],
		private readonly bucketDegrees = 10
	) {
		if (!Number.isFinite(bucketDegrees) || bucketDegrees <= 0 || bucketDegrees > 45) {
			throw new RangeError('Country index bucket size must be between 0 and 45 degrees.');
		}
		for (const country of countries) {
			this.byId.set(country.id, country);
			const minimumBucket = this.bucketForLatitude(country.bounds[1]);
			const maximumBucket = this.bucketForLatitude(country.bounds[3]);
			for (let bucket = minimumBucket; bucket <= maximumBucket; bucket += 1) {
				const current = this.latitudeBuckets.get(bucket) ?? { countries: [] };
				current.countries.push(country);
				this.latitudeBuckets.set(bucket, current);
			}
		}
	}

	get(id: string): CountryBoundary | null {
		return this.byId.get(id) ?? null;
	}

	resolve(latitudeDegrees: number, longitudeDegrees: number): CountryBoundary | null {
		if (![latitudeDegrees, longitudeDegrees].every(Number.isFinite)) {
			throw new RangeError('Country coordinates must be finite.');
		}
		if (latitudeDegrees < -90 || latitudeDegrees > 90) {
			return null;
		}
		const longitude = normalizeLongitude(longitudeDegrees);
		const bucket = this.latitudeBuckets.get(this.bucketForLatitude(latitudeDegrees));
		if (!bucket) {
			return null;
		}
		for (const country of bucket.countries) {
			if (!boundsContain(country, latitudeDegrees, longitude)) {
				continue;
			}
			if (countryContains(country, latitudeDegrees, longitude)) {
				return country;
			}
		}
		return null;
	}

	private bucketForLatitude(latitudeDegrees: number): number {
		return Math.floor((Math.max(-90, Math.min(90, latitudeDegrees)) + 90) / this.bucketDegrees);
	}
}

export function countryContains(
	country: Readonly<CountryBoundary>,
	latitudeDegrees: number,
	longitudeDegrees: number
): boolean {
	for (const polygon of country.polygons) {
		const outer = polygon[0];
		if (!outer || !ringContains(outer, latitudeDegrees, longitudeDegrees)) {
			continue;
		}
		let insideHole = false;
		for (let index = 1; index < polygon.length; index += 1) {
			if (ringContains(polygon[index], latitudeDegrees, longitudeDegrees)) {
				insideHole = true;
				break;
			}
		}
		if (!insideHole) {
			return true;
		}
	}
	return false;
}

function boundsContain(
	country: Readonly<CountryBoundary>,
	latitudeDegrees: number,
	longitudeDegrees: number
): boolean {
	const [minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude] = country.bounds;
	if (latitudeDegrees < minimumLatitude || latitudeDegrees > maximumLatitude) {
		return false;
	}
	if (maximumLongitude - minimumLongitude >= 350) {
		return true;
	}
	return longitudeDegrees >= minimumLongitude && longitudeDegrees <= maximumLongitude;
}

function ringContains(
	ring: GeographicRing,
	latitudeDegrees: number,
	longitudeDegrees: number
): boolean {
	if (ring.length < 3) {
		return false;
	}
	let inside = false;
	for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
		const currentLongitude = unwrapLongitude(ring[current][0], longitudeDegrees);
		const previousLongitude = unwrapLongitude(ring[previous][0], longitudeDegrees);
		const currentLatitude = ring[current][1];
		const previousLatitude = ring[previous][1];
		const crosses =
			currentLatitude > latitudeDegrees !== previousLatitude > latitudeDegrees &&
			longitudeDegrees <
				((previousLongitude - currentLongitude) * (latitudeDegrees - currentLatitude)) /
					(previousLatitude - currentLatitude || Number.EPSILON) +
					currentLongitude;
		if (crosses) {
			inside = !inside;
		}
	}
	return inside;
}

function unwrapLongitude(value: number, reference: number): number {
	let result = value;
	while (result - reference > 180) result -= 360;
	while (result - reference < -180) result += 360;
	return result;
}

function normalizeLongitude(value: number): number {
	return ((((value + 180) % 360) + 360) % 360) - 180;
}
