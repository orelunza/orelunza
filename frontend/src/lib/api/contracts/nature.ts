import type { ApiSuccessResponse } from '$lib/api/contracts/common';

/**
 * Biome exposed by the nature module.
 */
export interface Biome {
	id: string;
	name: string;
	slug: string;
	description: string;

	terrain_type: string;
	vegetation_type: string;

	enabled: boolean;

	created_at: number;
	updated_at: number;
}

/**
 * Natural area associated with a world region or place.
 */
export interface NaturalArea {
	id: string;
	biome_id: string;
	region_id: string;
	place_id: string | null;

	name: string;
	description: string;

	enabled: boolean;

	created_at: number;
	updated_at: number;
}

/**
 * Current environmental state of a natural area.
 */
export interface EnvironmentState {
	natural_area_id: string;

	terrain_condition: string;
	vegetation_condition: string;
	ambient_description: string;

	vegetation_density: number;
	water_level: number;

	updated_at: number;
}

/**
 * Response returned by `GET /api/nature`.
 */
export interface NatureOverviewResponse extends ApiSuccessResponse {
	ok: true;
	biomes: Biome[];
}

/**
 * Response returned by `GET /api/nature/biomes`.
 */
export interface BiomeListResponse extends ApiSuccessResponse {
	ok: true;
	biomes: Biome[];
}

/**
 * Response returned by `GET /api/nature/biomes/{id}`.
 */
export interface BiomeResponse extends ApiSuccessResponse {
	ok: true;
	biome: Biome;
}

/**
 * Response returned by
 * `GET /api/nature/biomes/{id}/areas`.
 */
export interface BiomeAreaListResponse extends ApiSuccessResponse {
	ok: true;
	biome_id: string;
	areas: NaturalArea[];
}

/**
 * Response returned by `GET /api/nature/areas/{id}`.
 */
export interface NaturalAreaResponse extends ApiSuccessResponse {
	ok: true;
	area: NaturalArea;
}

/**
 * Response returned by
 * `GET /api/nature/areas/{id}/state`.
 */
export interface EnvironmentStateResponse extends ApiSuccessResponse {
	ok: true;
	state: EnvironmentState;
}

/**
 * Response returned by
 * `GET /api/nature/regions/{region_id}`.
 */
export interface RegionNatureResponse extends ApiSuccessResponse {
	ok: true;
	region_id: string;
	area: NaturalArea;
}

/**
 * Response returned by
 * `GET /api/nature/places/{place_id}`.
 */
export interface PlaceNatureResponse extends ApiSuccessResponse {
	ok: true;
	place_id: string;
	area: NaturalArea;
}
