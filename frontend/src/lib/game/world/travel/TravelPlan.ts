import type { WorldLocation } from '../geography/WorldLocation';
export interface TravelPlan {
	id: string;
	origin: WorldLocation;
	destination: WorldLocation;
	totalDistanceKm: number;
	travelledDistanceKm: number;
	remainingDistanceKm: number;
	progress: number;
	status: 'planned' | 'active' | 'completed' | 'cancelled' | 'blocked';
	segments: RouteSegment[];
	transportMode: 'walking';
}
export type RouteSegmentType = 'land' | 'road' | 'trail' | 'water' | 'air' | 'unknown';
export type TransportMode = 'walking' | 'bicycle' | 'motorcycle' | 'car' | 'boat' | 'aircraft';
export interface RouteSegment {
	id: string;
	type: RouteSegmentType;
	origin: WorldLocation;
	destination: WorldLocation;
	distanceKm: number;
	allowedTransportModes: TransportMode[];
}
export function createTravelPlan(
	origin: WorldLocation,
	destination: WorldLocation,
	totalDistanceKm: number
): TravelPlan {
	return {
		id: `${origin.worldAnchorId}:${destination.worldAnchorId}`,
		origin,
		destination,
		totalDistanceKm,
		travelledDistanceKm: 0,
		remainingDistanceKm: totalDistanceKm,
		progress: 0,
		status: 'planned',
		segments: [
			{
				id: 'direct-land',
				type: 'unknown',
				origin,
				destination,
				distanceKm: totalDistanceKm,
				allowedTransportModes: ['walking', 'bicycle', 'motorcycle', 'car']
			}
		],
		transportMode: 'walking'
	};
}
