import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';
import type { GeographicSample } from '../GeographicTile';
import type { CountryResolver } from '../countries/CountryResolver';
import { planetBiomeProfile } from './PlanetBiomeProfile';
import { PlanetBiomeResolver } from './PlanetBiomeResolver';
import type { PlanetEcologyQuery } from './PlanetEcologyQuery';
import type { PlanetSurfaceEcology } from './PlanetSurfaceEcology';

export interface PlanetSurfaceContextSource {
	resolve(
		coordinate: Readonly<GeodeticCoordinate>,
		geography: Readonly<GeographicSample>,
		signal?: AbortSignal
	): Promise<PlanetSurfaceEcology>;
}

export class PlanetSurfaceContextResolver implements PlanetSurfaceContextSource {
	private readonly biomes = new PlanetBiomeResolver();

	constructor(
		private readonly countries: CountryResolver,
		private readonly ecology: PlanetEcologyQuery
	) {}

	async resolve(
		coordinate: Readonly<GeodeticCoordinate>,
		geography: Readonly<GeographicSample>,
		signal?: AbortSignal
	): Promise<PlanetSurfaceEcology> {
		const [country, sample] = await Promise.all([
			this.countries.resolve(coordinate, signal),
			this.ecology.sample(coordinate, undefined, signal)
		]);
		const biome = this.biomes.resolve(coordinate, geography, sample);
		const profile = planetBiomeProfile(biome);
		return {
			country,
			landCover: sample.landCover,
			biome,
			biomeLabel: profile.label,
			zoneName: profile.zoneName,
			treeCoverDensity: clamp01(sample.treeCoverDensity),
			vegetationDensity: clamp01(profile.vegetationDensity * (0.55 + sample.confidence * 0.45)),
			surfaceMoisture: profile.surfaceMoisture,
			confidence: clamp01(sample.confidence),
			dataQuality: this.ecology.diagnostics.dataQuality
		};
	}
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
