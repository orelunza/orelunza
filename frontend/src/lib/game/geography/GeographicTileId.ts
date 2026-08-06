import type { PlanetTileId } from '../planet/PlanetTileId';
import { planetTileKey, validatePlanetTileId } from '../planet/PlanetTileId';

export type GeographicTileId = PlanetTileId;

export function geographicTileKey(tile: Readonly<GeographicTileId>): string {
	return planetTileKey(tile);
}

export function geographicTilePath(template: string, tile: Readonly<GeographicTileId>): string {
	validatePlanetTileId(tile);
	return template
		.replaceAll('{face}', tile.face)
		.replaceAll('{level}', String(tile.level))
		.replaceAll('{x}', String(tile.x))
		.replaceAll('{y}', String(tile.y));
}

export function geographicTileAncestor(
	tile: Readonly<GeographicTileId>,
	level: number
): GeographicTileId {
	validatePlanetTileId(tile);
	if (!Number.isInteger(level) || level < 0 || level > tile.level) {
		throw new RangeError('Geographic ancestor level must be within the tile hierarchy.');
	}
	const divisor = 2 ** (tile.level - level);
	return {
		face: tile.face,
		level,
		x: Math.floor(tile.x / divisor),
		y: Math.floor(tile.y / divisor)
	};
}
