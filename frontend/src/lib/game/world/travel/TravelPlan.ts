import type { WorldLocation } from '../geography/WorldLocation';
export interface TravelPlan {
	origin: WorldLocation;
	destination: WorldLocation;
	totalDistanceKm: number;
	travelledDistanceKm: number;
	remainingDistanceKm: number;
	progress: number;
	status: 'planned' | 'travelling' | 'arrived' | 'failed';
	transportMode: 'overland';
}
export function createTravelPlan(
	origin: WorldLocation,
	destination: WorldLocation,
	totalDistanceKm: number
): TravelPlan {
	return {
		origin,
		destination,
		totalDistanceKm,
		travelledDistanceKm: 0,
		remainingDistanceKm: totalDistanceKm,
		progress: 0,
		status: 'planned',
		transportMode: 'overland'
	};
}
