import type { WorldLocation } from '../geography/WorldLocation';

/**
 * A place the player intends to reach.
 *
 * This is deliberately not a route and not travel state. It records only the
 * chosen geographic destination plus the straight-line distance from the
 * player's position when it was selected. A route must be computed separately
 * from real transport and terrain data before movement can begin.
 */
export interface NavigationDestination {
	location: WorldLocation;
	directDistanceKm: number | null;
}

export function createNavigationDestination(
	location: Readonly<WorldLocation>,
	directDistanceKm: number | null | undefined
): NavigationDestination {
	return {
		location: { ...location },
		directDistanceKm:
			typeof directDistanceKm === 'number' && Number.isFinite(directDistanceKm)
				? Math.max(0, directDistanceKm)
				: null
	};
}
