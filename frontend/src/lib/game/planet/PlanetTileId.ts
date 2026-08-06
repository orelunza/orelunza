import type { PlanetFace } from './PlanetFace';

export interface PlanetTileId {
	face: PlanetFace;
	level: number;
	x: number;
	y: number;
}

export interface PlanetTileUvBounds {
	minU: number;
	minV: number;
	maxU: number;
	maxV: number;
}

export function planetTileKey(tile: Readonly<PlanetTileId>): string {
	validatePlanetTileId(tile);
	return `${tile.face}/${tile.level}/${tile.x}/${tile.y}`;
}

export function validatePlanetTileId(tile: Readonly<PlanetTileId>): void {
	if (!Number.isInteger(tile.level) || tile.level < 0 || tile.level > 24) {
		throw new RangeError('Planet tile level must be an integer between 0 and 24.');
	}

	const side = 2 ** tile.level;
	if (
		!Number.isInteger(tile.x) ||
		!Number.isInteger(tile.y) ||
		tile.x < 0 ||
		tile.y < 0 ||
		tile.x >= side ||
		tile.y >= side
	) {
		throw new RangeError('Planet tile coordinates are outside the level bounds.');
	}
}

export function planetTileUvBounds(tile: Readonly<PlanetTileId>): PlanetTileUvBounds {
	validatePlanetTileId(tile);
	const side = 2 ** tile.level;
	return {
		minU: tile.x / side,
		minV: tile.y / side,
		maxU: (tile.x + 1) / side,
		maxV: (tile.y + 1) / side
	};
}

export function planetTileChildren(tile: Readonly<PlanetTileId>): PlanetTileId[] {
	validatePlanetTileId(tile);
	const level = tile.level + 1;
	const x = tile.x * 2;
	const y = tile.y * 2;
	return [
		{ face: tile.face, level, x, y },
		{ face: tile.face, level, x: x + 1, y },
		{ face: tile.face, level, x, y: y + 1 },
		{ face: tile.face, level, x: x + 1, y: y + 1 }
	];
}

export function planetTileParent(tile: Readonly<PlanetTileId>): PlanetTileId | null {
	validatePlanetTileId(tile);
	if (tile.level === 0) {
		return null;
	}

	return {
		face: tile.face,
		level: tile.level - 1,
		x: Math.floor(tile.x / 2),
		y: Math.floor(tile.y / 2)
	};
}
