import { PlanetGeographyQuery } from '../../geography/PlanetGeographyQuery';
import { CountryResolver } from '../../geography/countries/CountryResolver';
import { PlanetEcologyQuery } from '../../geography/ecology/PlanetEcologyQuery';
import { PlanetSurfaceContextResolver } from '../../geography/ecology/PlanetSurfaceContextResolver';
import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';
import {
	resolveSurfaceDestination,
	type PlanetSurfaceDestination
} from '../../planet/surface/PlanetSurfaceDestination';
import type { PlanetTravelRequest } from '../../planet/surface/PlanetTravelRequest';
import { greatCircleDistanceKm, type GeographicDegrees } from '../geography/GeographicDistance';
import { settlementForCountry, type SettlementAnchor } from '../geography/SettlementCatalog';

export interface ResolvedTravelDestination {
	destination: PlanetSurfaceDestination;
	request: PlanetTravelRequest | null;
	settlement: SettlementAnchor | null;
	distanceKm: number | null;
}

/**
 * Resolves a raw planet coordinate into the same geographic, ecological and
 * travel metadata used by the globe and the 2D world map.
 */
export class TravelDestinationResolver {
	private readonly geography = new PlanetGeographyQuery();
	private readonly countries = new CountryResolver();
	private readonly ecology = new PlanetEcologyQuery();
	private readonly context = new PlanetSurfaceContextResolver(this.countries, this.ecology);
	private disposed = false;

	async resolve(
		coordinate: Readonly<GeodeticCoordinate>,
		origin: Readonly<GeographicDegrees> | null = null
	): Promise<ResolvedTravelDestination> {
		if (this.disposed) throw new Error('Travel destination resolver has been disposed.');

		const sample = await this.geography.sample(coordinate);
		const details = await this.context.resolve(coordinate, sample);
		const destination = resolveSurfaceDestination(coordinate, sample, 0.55, details);
		const settlement = details.country ? settlementForCountry(details.country) : null;
		const latitude = (destination.coordinate.latitudeRadians * 180) / Math.PI;
		const longitude = (destination.coordinate.longitudeRadians * 180) / Math.PI;
		const distanceKm = origin ? greatCircleDistanceKm(origin, { latitude, longitude }) : null;

		return {
			destination,
			settlement,
			distanceKm,
			request:
				destination.status === 'land' && destination.sample
					? {
							coordinate: destination.coordinate,
							elevationMeters: destination.sample.elevationMeters,
							countryId: details.country?.id ?? null,
							countryName: details.country?.name ?? null,
							biomeId: details.biome,
							biomeName: details.biomeLabel,
							settlementId: settlement?.id ?? null,
							settlementName: settlement?.name ?? null,
							totalDistanceKm: distanceKm ?? undefined
						}
					: null
		};
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.geography.dispose();
		this.countries.dispose();
		this.ecology.dispose();
	}
}
