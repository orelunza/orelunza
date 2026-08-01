import { apiClient, apiRoutes, type ApiClient } from '$lib/api/client';

import type {
	HumanPositionResponse,
	MoveHumanRequest,
	PlaceListResponse,
	PlaceResponse,
	RegionListResponse,
	RegionResponse,
	WorldOverviewResponse
} from '$lib/api/contracts/world';

function encodeIdentifier(identifier: string): string {
	const value = identifier.trim();

	if (!value) {
		throw new Error('A world identifier is required.');
	}

	return encodeURIComponent(value);
}

/**
 * Client for the Orelunza world module.
 */
export class WorldApi {
	constructor(private readonly client: ApiClient = apiClient) {}

	/**
	 * Return the public world overview.
	 */
	getWorld(signal?: AbortSignal): Promise<WorldOverviewResponse> {
		return this.client.get<WorldOverviewResponse>(apiRoutes.world, {
			signal
		});
	}

	/**
	 * List all enabled world regions.
	 */
	listRegions(signal?: AbortSignal): Promise<RegionListResponse> {
		return this.client.get<RegionListResponse>(`${apiRoutes.world}/regions`, {
			signal
		});
	}

	/**
	 * Return one world region.
	 */
	getRegion(regionId: string, signal?: AbortSignal): Promise<RegionResponse> {
		return this.client.get<RegionResponse>(
			`${apiRoutes.world}/regions/${encodeIdentifier(regionId)}`,
			{
				signal
			}
		);
	}

	/**
	 * List all enabled places inside a region.
	 */
	listRegionPlaces(regionId: string, signal?: AbortSignal): Promise<PlaceListResponse> {
		return this.client.get<PlaceListResponse>(
			`${apiRoutes.world}/regions/${encodeIdentifier(regionId)}/places`,
			{
				signal
			}
		);
	}

	/**
	 * Return one world place.
	 */
	getPlace(placeId: string, signal?: AbortSignal): Promise<PlaceResponse> {
		return this.client.get<PlaceResponse>(
			`${apiRoutes.world}/places/${encodeIdentifier(placeId)}`,
			{
				signal
			}
		);
	}

	/**
	 * Return the authenticated human's current position.
	 */
	getMyPosition(signal?: AbortSignal): Promise<HumanPositionResponse> {
		return this.client.get<HumanPositionResponse>(`${apiRoutes.world}/me/position`, {
			signal
		});
	}

	/**
	 * Move the authenticated human.
	 */
	moveMe(request: MoveHumanRequest, signal?: AbortSignal): Promise<HumanPositionResponse> {
		return this.client.post<HumanPositionResponse, MoveHumanRequest>(
			`${apiRoutes.world}/me/move`,
			request,
			{
				signal
			}
		);
	}
}

/**
 * Shared world API client.
 */
export const worldApi = new WorldApi();

/**
 * Return the public Orelunza world overview.
 */
export function getWorld(signal?: AbortSignal): Promise<WorldOverviewResponse> {
	return worldApi.getWorld(signal);
}

/**
 * List all available regions.
 */
export function listRegions(signal?: AbortSignal): Promise<RegionListResponse> {
	return worldApi.listRegions(signal);
}

/**
 * Return one region.
 */
export function getRegion(regionId: string, signal?: AbortSignal): Promise<RegionResponse> {
	return worldApi.getRegion(regionId, signal);
}

/**
 * List places inside one region.
 */
export function listRegionPlaces(
	regionId: string,
	signal?: AbortSignal
): Promise<PlaceListResponse> {
	return worldApi.listRegionPlaces(regionId, signal);
}

/**
 * Return one place.
 */
export function getPlace(placeId: string, signal?: AbortSignal): Promise<PlaceResponse> {
	return worldApi.getPlace(placeId, signal);
}

/**
 * Return the current human position.
 */
export function getMyPosition(signal?: AbortSignal): Promise<HumanPositionResponse> {
	return worldApi.getMyPosition(signal);
}

/**
 * Move the authenticated human.
 */
export function moveMe(
	request: MoveHumanRequest,
	signal?: AbortSignal
): Promise<HumanPositionResponse> {
	return worldApi.moveMe(request, signal);
}
