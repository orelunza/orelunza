import type { CountrySummary } from '../countries/CountryBoundary';
import type { EcologicalSample } from './EcologicalTile';
import type { LandCoverClass } from './LandCoverClass';
import type { PlanetBiomeId } from './PlanetBiome';

export interface PlanetSurfaceEcology {
	country: CountrySummary | null;
	landCover: LandCoverClass;
	biome: PlanetBiomeId;
	biomeLabel: string;
	zoneName: string;
	treeCoverDensity: number;
	vegetationDensity: number;
	surfaceMoisture: number;
	confidence: number;
	dataQuality: string;
}

export function createFallbackPlanetSurfaceEcology(
	country: CountrySummary | null = null,
	ecology: Partial<EcologicalSample> = {}
): PlanetSurfaceEcology {
	return {
		country,
		landCover: ecology.landCover ?? 'grassland',
		biome: 'grassland',
		biomeLabel: 'Grassland',
		zoneName: 'Planet Grassland',
		treeCoverDensity: clamp01(ecology.treeCoverDensity ?? 0.08),
		vegetationDensity: 0.64,
		surfaceMoisture: 0.32,
		confidence: clamp01(ecology.confidence ?? 0),
		dataQuality: 'fallback'
	};
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
