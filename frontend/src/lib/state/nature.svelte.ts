import { ApiError } from '$lib/api/ApiError';

import {
	getBiome,
	getEnvironmentState,
	getNaturalArea,
	getNature,
	getPlaceNature,
	getRegionNature,
	listBiomeAreas,
	listBiomes
} from '$lib/api/nature';

import type { Biome, EnvironmentState, NaturalArea } from '$lib/api/contracts/nature';

export type NatureLoadingTarget =
	'nature' | 'biomes' | 'biome' | 'areas' | 'area' | 'environment' | 'region' | 'place' | null;

/**
 * Reactive state for biomes and natural environments.
 */
class NatureState {
	biomes = $state<Biome[]>([]);
	areas = $state<NaturalArea[]>([]);

	selectedBiome = $state<Biome | null>(null);
	selectedArea = $state<NaturalArea | null>(null);
	environment = $state<EnvironmentState | null>(null);

	loading = $state<NatureLoadingTarget>(null);
	error = $state<ApiError | null>(null);

	private requestVersions = {
		nature: 0,
		biomes: 0,
		biome: 0,
		areas: 0,
		area: 0,
		environment: 0,
		region: 0,
		place: 0
	};

	get isLoading(): boolean {
		return this.loading !== null;
	}

	get hasEnvironment(): boolean {
		return this.environment !== null;
	}

	get currentBiome(): Biome | null {
		if (this.selectedBiome) {
			return this.selectedBiome;
		}

		if (!this.selectedArea) {
			return null;
		}

		return this.biomes.find((biome) => biome.id === this.selectedArea?.biome_id) ?? null;
	}

	/**
	 * Load the complete public nature overview.
	 */
	async loadNature(signal?: AbortSignal): Promise<Biome[]> {
		const version = ++this.requestVersions.nature;

		this.loading = 'nature';
		this.error = null;

		try {
			const response = await getNature(signal);

			if (version !== this.requestVersions.nature) {
				return this.biomes;
			}

			this.biomes = response.biomes;

			return this.biomes;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.nature) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.nature && this.loading === 'nature') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load all enabled biomes.
	 */
	async loadBiomes(signal?: AbortSignal): Promise<Biome[]> {
		const version = ++this.requestVersions.biomes;

		this.loading = 'biomes';
		this.error = null;

		try {
			const response = await listBiomes(signal);

			if (version !== this.requestVersions.biomes) {
				return this.biomes;
			}

			this.biomes = response.biomes;

			return this.biomes;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.biomes) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.biomes && this.loading === 'biomes') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load and select one biome.
	 */
	async selectBiome(biomeId: string, signal?: AbortSignal): Promise<Biome> {
		const version = ++this.requestVersions.biome;

		this.loading = 'biome';
		this.error = null;

		try {
			const response = await getBiome(biomeId, signal);

			if (version !== this.requestVersions.biome) {
				return response.biome;
			}

			this.selectedBiome = response.biome;

			return response.biome;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.biome) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.biome && this.loading === 'biome') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load all natural areas using one biome.
	 */
	async loadBiomeAreas(biomeId: string, signal?: AbortSignal): Promise<NaturalArea[]> {
		const version = ++this.requestVersions.areas;

		this.loading = 'areas';
		this.error = null;

		try {
			const response = await listBiomeAreas(biomeId, signal);

			if (version !== this.requestVersions.areas) {
				return this.areas;
			}

			this.areas = response.areas;

			return this.areas;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.areas) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.areas && this.loading === 'areas') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load and select one natural area.
	 */
	async selectArea(naturalAreaId: string, signal?: AbortSignal): Promise<NaturalArea> {
		const version = ++this.requestVersions.area;

		this.loading = 'area';
		this.error = null;

		try {
			const response = await getNaturalArea(naturalAreaId, signal);

			if (version !== this.requestVersions.area) {
				return response.area;
			}

			this.selectedArea = response.area;
			this.environment = null;
			this.syncSelectedBiome(response.area);

			return response.area;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version === this.requestVersions.area) {
				this.error = apiError;
			}

			throw apiError;
		} finally {
			if (version === this.requestVersions.area && this.loading === 'area') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load the region-wide natural area.
	 *
	 * A region without configured nature returns null.
	 */
	async loadRegionNature(regionId: string, signal?: AbortSignal): Promise<NaturalArea | null> {
		const version = ++this.requestVersions.region;

		this.loading = 'region';
		this.error = null;

		try {
			const response = await getRegionNature(regionId, signal);

			if (version !== this.requestVersions.region) {
				return this.selectedArea;
			}

			this.selectedArea = response.area;
			this.environment = null;
			this.syncSelectedBiome(response.area);

			return response.area;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version !== this.requestVersions.region) {
				return this.selectedArea;
			}

			if (apiError.isNotFound && apiError.is('natural_area_not_found')) {
				this.selectedArea = null;
				this.environment = null;
				this.error = null;

				return null;
			}

			this.error = apiError;

			throw apiError;
		} finally {
			if (version === this.requestVersions.region && this.loading === 'region') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load the natural area attached to a place.
	 *
	 * A place without configured nature returns null.
	 */
	async loadPlaceNature(placeId: string, signal?: AbortSignal): Promise<NaturalArea | null> {
		const version = ++this.requestVersions.place;

		this.loading = 'place';
		this.error = null;

		try {
			const response = await getPlaceNature(placeId, signal);

			if (version !== this.requestVersions.place) {
				return this.selectedArea;
			}

			this.selectedArea = response.area;
			this.environment = null;
			this.syncSelectedBiome(response.area);

			return response.area;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version !== this.requestVersions.place) {
				return this.selectedArea;
			}

			if (apiError.isNotFound && apiError.is('natural_area_not_found')) {
				this.selectedArea = null;
				this.environment = null;
				this.error = null;

				return null;
			}

			this.error = apiError;

			throw apiError;
		} finally {
			if (version === this.requestVersions.place && this.loading === 'place') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load the current state of a natural area.
	 *
	 * An area without a state returns null.
	 */
	async loadEnvironment(
		naturalAreaId: string,
		signal?: AbortSignal
	): Promise<EnvironmentState | null> {
		const version = ++this.requestVersions.environment;

		this.loading = 'environment';
		this.error = null;

		try {
			const response = await getEnvironmentState(naturalAreaId, signal);

			if (version !== this.requestVersions.environment) {
				return this.environment;
			}

			this.environment = response.state;

			return response.state;
		} catch (error) {
			const apiError = ApiError.fromUnknown(error);

			if (version !== this.requestVersions.environment) {
				return this.environment;
			}

			if (apiError.isNotFound && apiError.is('environment_state_not_found')) {
				this.environment = null;
				this.error = null;

				return null;
			}

			this.error = apiError;

			throw apiError;
		} finally {
			if (version === this.requestVersions.environment && this.loading === 'environment') {
				this.loading = null;
			}
		}
	}

	/**
	 * Load a natural area and its optional environment state.
	 */
	async loadAreaEnvironment(
		naturalAreaId: string,
		signal?: AbortSignal
	): Promise<{
		area: NaturalArea;
		environment: EnvironmentState | null;
	}> {
		const area = await this.selectArea(naturalAreaId, signal);

		const environment = await this.loadEnvironment(naturalAreaId, signal);

		return {
			area,
			environment
		};
	}

	private syncSelectedBiome(area: NaturalArea): void {
		const biome = this.biomes.find((candidate) => candidate.id === area.biome_id);

		if (biome) {
			this.selectedBiome = biome;
		}
	}

	clearContext(): void {
		this.selectedArea = null;
		this.environment = null;
		this.areas = [];
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

		this.biomes = [];
		this.areas = [];
		this.selectedBiome = null;
		this.selectedArea = null;
		this.environment = null;
		this.loading = null;
		this.error = null;
	}
}

/**
 * Shared reactive nature state.
 */
export const natureState = new NatureState();
