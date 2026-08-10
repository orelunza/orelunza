import type { GeodeticCoordinate } from '../GeodeticCoordinate';

/** Rendering-free contract used to move the one real game runtime. */
export interface PlanetTravelRequest {
	coordinate: GeodeticCoordinate;
	elevationMeters: number;
	countryId?: string | null;
	countryName?: string | null;
	biomeId?: string | null;
	biomeName?: string | null;
	settlementId?: string | null;
	settlementName?: string | null;
	totalDistanceKm?: number;
}
