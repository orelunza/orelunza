import { PLANET_FACES } from './PlanetFace';
import type { PlanetTileId } from './PlanetTileId';
import { planetTileChildren } from './PlanetTileId';

export interface PlanetQuadtreeSelectionOptions {
	maximumLevel: number;
	maximumTiles?: number;
	shouldSubdivide: (tile: Readonly<PlanetTileId>) => boolean;
	isVisible?: (tile: Readonly<PlanetTileId>) => boolean;
}

export class PlanetQuadtree {
	select(options: Readonly<PlanetQuadtreeSelectionOptions>): PlanetTileId[] {
		if (
			!Number.isInteger(options.maximumLevel) ||
			options.maximumLevel < 0 ||
			options.maximumLevel > 24
		) {
			throw new RangeError('maximumLevel must be an integer between 0 and 24.');
		}

		const maximumTiles = Math.max(6, Math.floor(options.maximumTiles ?? 4096));
		const selected: PlanetTileId[] = [];
		const stack: PlanetTileId[] = PLANET_FACES.map((face) => ({ face, level: 0, x: 0, y: 0 }));

		while (stack.length > 0 && selected.length < maximumTiles) {
			const tile = stack.pop()!;
			if (options.isVisible && !options.isVisible(tile)) {
				continue;
			}

			const canAddChildren = selected.length + stack.length + 4 <= maximumTiles;
			if (tile.level < options.maximumLevel && canAddChildren && options.shouldSubdivide(tile)) {
				const children = planetTileChildren(tile);
				for (let index = children.length - 1; index >= 0; index -= 1) {
					stack.push(children[index]);
				}
			} else {
				selected.push(tile);
			}
		}

		while (stack.length > 0 && selected.length < maximumTiles) {
			selected.push(stack.pop()!);
		}

		return selected;
	}
}
