import type { GeodeticCoordinate, PlanetPosition } from './GeodeticCoordinate';
import type { FloatingOriginState } from './FloatingOrigin';
import type { PlanetTileId } from './PlanetTileId';

export type WorldGeometry = 'local-flat' | 'planet-earth';

export interface PlanetFoundationState {
	worldGeometry: WorldGeometry;
	cameraGeodetic: GeodeticCoordinate;
	cameraPlanetPosition: PlanetPosition;
	floatingOrigin: FloatingOriginState;
	activeTiles: readonly PlanetTileId[];
	maximumLodLevel: number;
}
