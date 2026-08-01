import type { ApiSuccessResponse } from '$lib/api/contracts/common';

/**
 * Region exposed by the world module.
 */
export interface WorldRegion {
	id: string;
	name: string;
	slug: string;
	description: string;

	enabled: boolean;

	created_at: number;
	updated_at: number;
}

/**
 * Place exposed by the world module.
 */
export interface WorldPlace {
	id: string;
	region_id: string;

	name: string;
	description: string;
	type: string;

	position_x: number;
	position_y: number;

	enabled: boolean;

	created_at: number;
	updated_at: number;
}

/**
 * Persisted position of the authenticated human.
 */
export interface HumanPosition {
	human_id: string;
	region_id: string;
	place_id: string | null;

	position_x: number;
	position_y: number;

	updated_at: number;
}

/**
 * Payload used to move the authenticated human.
 */
export interface MoveHumanRequest {
	region_id: string;
	place_id: string | null;

	position_x: number;
	position_y: number;
}

/**
 * Response returned by `GET /api/world`.
 */
export interface WorldOverviewResponse extends ApiSuccessResponse {
	ok: true;
	world_id: string;
	regions: WorldRegion[];
}

/**
 * Response returned by `GET /api/world/regions`.
 */
export interface RegionListResponse extends ApiSuccessResponse {
	ok: true;
	regions: WorldRegion[];
}

/**
 * Response returned by `GET /api/world/regions/{id}`.
 */
export interface RegionResponse extends ApiSuccessResponse {
	ok: true;
	region: WorldRegion;
}

/**
 * Response returned by
 * `GET /api/world/regions/{id}/places`.
 */
export interface PlaceListResponse extends ApiSuccessResponse {
	ok: true;
	region_id: string;
	places: WorldPlace[];
}

/**
 * Response returned by `GET /api/world/places/{id}`.
 */
export interface PlaceResponse extends ApiSuccessResponse {
	ok: true;
	place: WorldPlace;
}

/**
 * Response returned when reading or updating a human position.
 */
export interface HumanPositionResponse extends ApiSuccessResponse {
	ok: true;
	position: HumanPosition;
}
