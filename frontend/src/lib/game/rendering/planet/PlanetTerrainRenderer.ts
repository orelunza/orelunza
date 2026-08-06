import type { PlanetDefinition } from '../../planet/PlanetDefinition';
import type { PlanetGeographySystem } from '../../planet/PlanetGeographySystem';
import type { PlanetTileId } from '../../planet/PlanetTileId';
import { PlanetTileRenderer, type PlanetTileGeometryResult } from './PlanetTileRenderer';

export class PlanetTerrainRenderer {
	static build(
		tiles: readonly PlanetTileId[],
		segmentsPerTile: number,
		definition: Readonly<PlanetDefinition>,
		geography: PlanetGeographySystem,
		reliefExaggeration: number
	): PlanetTileGeometryResult {
		return PlanetTileRenderer.buildGeometry(
			tiles,
			segmentsPerTile,
			definition,
			geography,
			reliefExaggeration
		);
	}
}
