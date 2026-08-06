import type { GeodeticCoordinate } from '../GeodeticCoordinate';
import type { FloatingOriginState } from '../FloatingOrigin';
import type { PlanetSurfaceAnchorSaveState } from './PlanetSurfaceAnchor';
import type { PlanetTerrainEditStoreSaveState } from '../../world/planet/PlanetTerrainEditStore';
import type { PlanetSurfaceEcology } from '../../geography/ecology/PlanetSurfaceEcology';

export interface PlanetSurfacePlayerPosition {
	x: number;
	y: number;
	z: number;
}

export interface PlanetSurfaceSaveState {
	version: 1;
	anchor: PlanetSurfaceAnchorSaveState;
	playerLocalPosition: PlanetSurfacePlayerPosition;
	playerGeodeticPosition: GeodeticCoordinate;
	floatingOrigin: FloatingOriginState;
	terrainEdits: PlanetTerrainEditStoreSaveState;
	ecology?: PlanetSurfaceEcology;
}

export function isPlanetSurfaceSaveState(value: unknown): value is PlanetSurfaceSaveState {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const state = value as Partial<PlanetSurfaceSaveState>;
	return (
		state.version === 1 &&
		!!state.anchor &&
		!!state.playerLocalPosition &&
		!!state.playerGeodeticPosition &&
		!!state.floatingOrigin &&
		!!state.terrainEdits
	);
}
