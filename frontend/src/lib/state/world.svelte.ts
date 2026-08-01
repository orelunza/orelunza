import { ApiError } from '$lib/api/ApiError';

import {
	getMyPosition,
	getPlace,
	getRegion,
	getWorld,
	listRegionPlaces,
	listRegions,
	moveMe
} from '$lib/api/world';

import type {
	HumanPosition,
	MoveHumanRequest,
	WorldPlace,
	WorldRegion
} from '$lib/api/contracts/world';

export type WorldLoadingTarget =
	'world' | 'regions' | 'region' | 'places' | 'place' | 'position' | 'movement' | null;

/**
 * Reactive state for regions, places and human movement.
 */
class WorldState {
	worldId = $state<string | null>(null);

	regions = $state<WorldRegion[]>([]);
	places = $state<WorldPlace[]>([]);

	selectedRegion = $state<WorldRegion | null>(null);
	selectedPlace = $state<WorldPlace | null>(null);

	position = $state<HumanPosition | null>(null);

	loading = $state<WorldLoadingTarget>(null);
	error = $state<ApiError | null>(null);

	private requestVersions = {
		world: 0,
		regions: 0,
		region: 0,
		places: 0,
		place: 0,
		position: 0,
		movement: 0
	};

	get isLoading(): boolean {
		return this.loading !== null;
	}

	get currentRegionId(): string | null {
		return this.position?.region_id ?? this.selectedRegion?.id ?? null;
	}

	get currentPlaceId(): string | null {
		return this.position?.place_id ?? this.selectedPlace?.id ?? null;
	}

	get hasPosition(): boolean {
		return this.position !== null;
	}

	/**
	 * Load the world overview and its enabled regions.
	 */
	async loadWorld(signal?: AbortSignal): Promise<WorldRegion[]> {
		const version = ++this.requestVersions.world;

		this.loading = 'world';
		this.error = null;

		try {
			const response = await getWorld(signal);

			if (version !== this.requestVersions.world) {
				return this.regions;
			}

			this.worldId = response.world_id;
			this.regions = response.regions;

			return this.regions;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.world) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.world && this.loading === 'world') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load all enabled regions.
	 */
	async loadRegions(signal?: AbortSignal): Promise<WorldRegion[]> {
		const version = ++this.requestVersions.regions;

		this.loading = 'regions';
		this.error = null;

		try {
			const response = await listRegions(signal);

			if (version !== this.requestVersions.regions) {
				return this.regions;
			}

			this.regions = response.regions;

			return this.regions;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.regions) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.regions && this.loading === 'regions') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load and select one region.
	 */
	async selectRegion(regionId: string, signal?: AbortSignal): Promise<WorldRegion> {
		const version = ++this.requestVersions.region;

		this.loading = 'region';
		this.error = null;

		try {
			const response = await getRegion(regionId, signal);

			if (version !== this.requestVersions.region) {
				return response.region;
			}

			this.selectedRegion = response.region;

			if (this.selectedPlace?.region_id !== response.region.id) {
				this.selectedPlace = null;
				this.places = [];
			}

			return response.region;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.region) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.region && this.loading === 'region') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load all places belonging to one region.
	 */
	async loadRegionPlaces(regionId: string, signal?: AbortSignal): Promise<WorldPlace[]> {
		const version = ++this.requestVersions.places;

		this.loading = 'places';
		this.error = null;

		try {
			const response = await listRegionPlaces(regionId, signal);

			if (version !== this.requestVersions.places) {
				return this.places;
			}

			this.places = response.places;

			return this.places;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.places) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.places && this.loading === 'places') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load and select one place.
	 */
	async selectPlace(placeId: string, signal?: AbortSignal): Promise<WorldPlace> {
		const version = ++this.requestVersions.place;

		this.loading = 'place';
		this.error = null;

		try {
			const response = await getPlace(placeId, signal);

			if (version !== this.requestVersions.place) {
				return response.place;
			}

			this.selectedPlace = response.place;

			return response.place;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.place) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.place && this.loading === 'place') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load the authenticated human's current position.
	 */
	async loadPosition(signal?: AbortSignal): Promise<HumanPosition | null> {
		const version = ++this.requestVersions.position;

		this.loading = 'position';
		this.error = null;

		try {
			const response = await getMyPosition(signal);

			if (version !== this.requestVersions.position) {
				return this.position;
			}

			this.position = response.position;

			return this.position;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version !== this.requestVersions.position) {
				return this.position;
			}

			if (apiError.isNotFound && apiError.is('position_not_found')) {
				this.position = null;
				this.error = null;

				return null;
			}

			this.error = apiError;

			throw apiError;
		} finally {
			if (version === this.requestVersions.position && this.loading === 'position') {
				this.loading = null;
			}
		}
	}

	/**
	 * Move the authenticated human to a region or place.
	 */
	async move(request: MoveHumanRequest, signal?: AbortSignal): Promise<HumanPosition> {
		const version = ++this.requestVersions.movement;

		this.loading = 'movement';
		this.error = null;

		try {
			const response = await moveMe(request, signal);

			if (version !== this.requestVersions.movement) {
				return response.position;
			}

			this.position = response.position;

			const matchingRegion = this.regions.find(
				(region) => region.id === response.position.region_id
			);

			if (matchingRegion) {
				this.selectedRegion = matchingRegion;
			}

			if (response.position.place_id) {
				const matchingPlace = this.places.find((place) => place.id === response.position.place_id);

				if (matchingPlace) {
					this.selectedPlace = matchingPlace;
				}
			} else {
				this.selectedPlace = null;
			}

			return response.position;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.movement) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.movement && this.loading === 'movement') {
				this.loading = null;
			}
		}
	}

	/**
	 * Move directly to a known place using its coordinates.
	 */
	async moveToPlace(place: WorldPlace, signal?: AbortSignal): Promise<HumanPosition> {
		const position = await this.move(
			{
				region_id: place.region_id,
				place_id: place.id,
				position_x: place.position_x,
				position_y: place.position_y
			},
			signal
		);

		this.selectedPlace = place;

		return position;
	}

	clearSelection(): void {
		this.selectedRegion = null;
		this.selectedPlace = null;
		this.places = [];
	}

	clearError(): void {
		this.error = null;
	}

	reset(): void {
		for (const key of Object.keys(this.requestVersions) as Array<
			keyof typeof this.requestVersions
		>) {
			this.requestVersions[key]++;
		}

		this.worldId = null;
		this.regions = [];
		this.places = [];
		this.selectedRegion = null;
		this.selectedPlace = null;
		this.position = null;
		this.loading = null;
		this.error = null;
	}
}

/**
 * Shared reactive world state.
 */
export const worldState = new WorldState();
