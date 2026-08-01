import { apiClient, apiRoutes, type ApiClient } from '$lib/api/client';

import type {
	BiomeAreaListResponse,
	BiomeListResponse,
	BiomeResponse,
	EnvironmentStateResponse,
	NaturalAreaResponse,
	NatureOverviewResponse,
	PlaceNatureResponse,
	RegionNatureResponse
} from '$lib/api/contracts/nature';

function encodeIdentifier(identifier: string): string {
	const value = identifier.trim();

	if (!value) {
		throw new Error('A nature identifier is required.');
	}

	return encodeURIComponent(value);
}

/**
 * Client for the Orelunza nature module.
 */
export class NatureApi {
	constructor(private readonly client: ApiClient = apiClient) {}

	/**
	 * Return the public nature overview.
	 */
	getNature(signal?: AbortSignal): Promise<NatureOverviewResponse> {
		return this.client.get<NatureOverviewResponse>(apiRoutes.nature, {
			signal
		});
	}

	/**
	 * List all enabled biomes.
	 */
	listBiomes(signal?: AbortSignal): Promise<BiomeListResponse> {
		return this.client.get<BiomeListResponse>(`${apiRoutes.nature}/biomes`, {
			signal
		});
	}

	/**
	 * Return one enabled biome.
	 */
	getBiome(biomeId: string, signal?: AbortSignal): Promise<BiomeResponse> {
		return this.client.get<BiomeResponse>(
			`${apiRoutes.nature}/biomes/${encodeIdentifier(biomeId)}`,
			{
				signal
			}
		);
	}

	/**
	 * List enabled natural areas using a biome.
	 */
	listBiomeAreas(biomeId: string, signal?: AbortSignal): Promise<BiomeAreaListResponse> {
		return this.client.get<BiomeAreaListResponse>(
			`${apiRoutes.nature}/biomes/${encodeIdentifier(biomeId)}/areas`,
			{
				signal
			}
		);
	}

	/**
	 * Return one enabled natural area.
	 */
	getNaturalArea(naturalAreaId: string, signal?: AbortSignal): Promise<NaturalAreaResponse> {
		return this.client.get<NaturalAreaResponse>(
			`${apiRoutes.nature}/areas/${encodeIdentifier(naturalAreaId)}`,
			{
				signal
			}
		);
	}

	/**
	 * Return the current environmental state of a natural area.
	 */
	getEnvironmentState(
		naturalAreaId: string,
		signal?: AbortSignal
	): Promise<EnvironmentStateResponse> {
		return this.client.get<EnvironmentStateResponse>(
			`${apiRoutes.nature}/areas/${encodeIdentifier(naturalAreaId)}/state`,
			{
				signal
			}
		);
	}

	/**
	 * Return the region-wide natural area of a world region.
	 */
	getRegionNature(regionId: string, signal?: AbortSignal): Promise<RegionNatureResponse> {
		return this.client.get<RegionNatureResponse>(
			`${apiRoutes.nature}/regions/${encodeIdentifier(regionId)}`,
			{
				signal
			}
		);
	}

	/**
	 * Return the natural area attached to a world place.
	 */
	getPlaceNature(placeId: string, signal?: AbortSignal): Promise<PlaceNatureResponse> {
		return this.client.get<PlaceNatureResponse>(
			`${apiRoutes.nature}/places/${encodeIdentifier(placeId)}`,
			{
				signal
			}
		);
	}
}

/**
 * Shared nature API client.
 */
export const natureApi = new NatureApi();

/**
 * Return the public nature overview.
 */
export function getNature(signal?: AbortSignal): Promise<NatureOverviewResponse> {
	return natureApi.getNature(signal);
}

/**
 * List all enabled biomes.
 */
export function listBiomes(signal?: AbortSignal): Promise<BiomeListResponse> {
	return natureApi.listBiomes(signal);
}

/**
 * Return one biome.
 */
export function getBiome(biomeId: string, signal?: AbortSignal): Promise<BiomeResponse> {
	return natureApi.getBiome(biomeId, signal);
}

/**
 * List the natural areas using one biome.
 */
export function listBiomeAreas(
	biomeId: string,
	signal?: AbortSignal
): Promise<BiomeAreaListResponse> {
	return natureApi.listBiomeAreas(biomeId, signal);
}

/**
 * Return one natural area.
 */
export function getNaturalArea(
	naturalAreaId: string,
	signal?: AbortSignal
): Promise<NaturalAreaResponse> {
	return natureApi.getNaturalArea(naturalAreaId, signal);
}

/**
 * Return the current state of a natural area.
 */
export function getEnvironmentState(
	naturalAreaId: string,
	signal?: AbortSignal
): Promise<EnvironmentStateResponse> {
	return natureApi.getEnvironmentState(naturalAreaId, signal);
}

/**
 * Return the region-wide nature attached to a region.
 */
export function getRegionNature(
	regionId: string,
	signal?: AbortSignal
): Promise<RegionNatureResponse> {
	return natureApi.getRegionNature(regionId, signal);
}

/**
 * Return the nature attached to a place.
 */
export function getPlaceNature(
	placeId: string,
	signal?: AbortSignal
): Promise<PlaceNatureResponse> {
	return natureApi.getPlaceNature(placeId, signal);
}
