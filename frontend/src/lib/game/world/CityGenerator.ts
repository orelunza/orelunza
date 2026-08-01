import type { BlockCoordinate, BlockType } from './voxel-types';
import { CENTRAL_CITY_CENTER } from './voxel-types';

export interface CityBlock {
	position: BlockCoordinate;
	type: BlockType;
}

export class CityGenerator {
	generateForColumn(x: number, groundY: number, z: number): CityBlock[] {
		const blocks: CityBlock[] = [];
		const localX = x - CENTRAL_CITY_CENTER.x;
		const localZ = z - CENTRAL_CITY_CENTER.z;

		if (Math.abs(localX) <= 5 && Math.abs(localZ) <= 5) {
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'stone' });
		}

		if (Math.abs(localX) <= 2 && Math.abs(localZ) <= 2) {
			this.addBuilding(blocks, x, groundY, z, 9, 'brick');
		}

		const houses = [
			{ x: -13, z: -8 },
			{ x: 13, z: -9 },
			{ x: -12, z: 10 },
			{ x: 12, z: 11 },
			{ x: 0, z: 16 }
		];

		for (const house of houses) {
			const dx = localX - house.x;
			const dz = localZ - house.z;

			if (Math.abs(dx) <= 3 && Math.abs(dz) <= 3) {
				this.addBuilding(blocks, x, groundY, z, 4, 'wooden_plank');
			}
		}

		if (
			(Math.abs(localX) === 7 && Math.abs(localZ) === 7) ||
			(Math.abs(localX) === 18 && localZ === 0)
		) {
			blocks.push({ position: { x, y: groundY + 1, z }, type: 'wood' });
			blocks.push({ position: { x, y: groundY + 2, z }, type: 'glass' });
		}

		return blocks;
	}

	private addBuilding(
		blocks: CityBlock[],
		x: number,
		groundY: number,
		z: number,
		height: number,
		wall: BlockType
	): void {
		for (let y = groundY + 1; y <= groundY + height; y += 1) {
			blocks.push({ position: { x, y, z }, type: y === groundY + height ? 'stone' : wall });
		}
	}
}
