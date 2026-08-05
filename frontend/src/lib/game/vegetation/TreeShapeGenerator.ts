import type { BlockCoordinate, BlockType } from '../world/voxel-types';
import type { TreeSpeciesId } from './VegetationFamily';
import { vegetationRandom } from './VegetationDistribution';
import { VegetationRegistry } from './VegetationRegistry';

export interface TreeBlock {
	position: BlockCoordinate;
	type: Extract<BlockType, 'wood' | 'leaves'>;
}

export interface TreeShapeBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	minZ: number;
	maxZ: number;
}

export function generateTreeShape(
	speciesId: TreeSpeciesId,
	x: number,
	groundY: number,
	z: number,
	seed: number
): TreeBlock[] {
	const species = VegetationRegistry.tree(speciesId);
	const heightRange = species.maxHeight - species.minHeight + 1;
	const height = species.minHeight + Math.floor(vegetationRandom(seed, x, z, 0xd3c1) * heightRange);
	const blocks = new Map<string, TreeBlock>();
	const add = (bx: number, by: number, bz: number, type: TreeBlock['type']): void => {
		const position = { x: Math.round(bx), y: Math.round(by), z: Math.round(bz) };
		blocks.set(`${position.x},${position.y},${position.z}`, { position, type });
	};

	switch (speciesId) {
		case 'oak_round':
			addStraightTrunk(add, x, groundY, z, height);
			addEllipsoidCanopy(add, x, groundY + height, z, 2, 2, 2, seed);
			break;
		case 'acacia_spreading':
			addStraightTrunk(add, x, groundY, z, height - 1);
			addBranch(add, x, groundY + height - 2, z, 1, 0, 2);
			addBranch(add, x, groundY + height - 2, z, -1, 0, 2);
			addBranch(add, x, groundY + height - 1, z, 0, 1, 2);
			addFlatCanopy(add, x, groundY + height, z, 3, seed);
			break;
		case 'pine_layered':
			addStraightTrunk(add, x, groundY, z, height);
			addPineCanopy(add, x, groundY, z, height, seed);
			break;
		case 'kapok_emergent':
			addButtressRoots(add, x, groundY, z);
			addStraightTrunk(add, x, groundY, z, height);
			addBranch(add, x, groundY + height - 2, z, 1, 0, 3);
			addBranch(add, x, groundY + height - 1, z, -1, 1, 3);
			addBranch(add, x, groundY + height - 2, z, 0, -1, 3);
			addEmergentCanopy(add, x, groundY + height, z, seed);
			break;
		case 'palm_crown':
			addCurvedTrunk(add, x, groundY, z, height, seed);
			addPalmFronds(
				add,
				x + palmCurveOffset(height, seed, x, z).x,
				groundY + height,
				z + palmCurveOffset(height, seed, x, z).z
			);
			break;
		case 'willow_drooping':
			addStraightTrunk(add, x, groundY, z, height - 1);
			addBranch(add, x, groundY + height - 2, z, 1, 0, 2);
			addBranch(add, x, groundY + height - 2, z, -1, 0, 2);
			addDroopingCanopy(add, x, groundY + height, z, seed);
			break;
	}

	return [...blocks.values()];
}

export function treeShapeBounds(blocks: readonly TreeBlock[]): TreeShapeBounds {
	if (blocks.length === 0) {
		return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
	}

	const first = blocks[0].position;
	const bounds: TreeShapeBounds = {
		minX: first.x,
		maxX: first.x,
		minY: first.y,
		maxY: first.y,
		minZ: first.z,
		maxZ: first.z
	};

	for (const block of blocks) {
		bounds.minX = Math.min(bounds.minX, block.position.x);
		bounds.maxX = Math.max(bounds.maxX, block.position.x);
		bounds.minY = Math.min(bounds.minY, block.position.y);
		bounds.maxY = Math.max(bounds.maxY, block.position.y);
		bounds.minZ = Math.min(bounds.minZ, block.position.z);
		bounds.maxZ = Math.max(bounds.maxZ, block.position.z);
	}

	return bounds;
}

function addStraightTrunk(
	add: (x: number, y: number, z: number, type: TreeBlock['type']) => void,
	x: number,
	groundY: number,
	z: number,
	height: number
): void {
	for (let offset = 1; offset <= height; offset += 1) {
		add(x, groundY + offset, z, 'wood');
	}
}

function addCurvedTrunk(
	add: (x: number, y: number, z: number, type: TreeBlock['type']) => void,
	x: number,
	groundY: number,
	z: number,
	height: number,
	seed: number
): void {
	for (let offset = 1; offset <= height; offset += 1) {
		const curve = palmCurveOffset(offset, seed, x, z);
		add(x + curve.x, groundY + offset, z + curve.z, 'wood');
	}
}

function palmCurveOffset(
	offset: number,
	seed: number,
	x: number,
	z: number
): { x: number; z: number } {
	const direction = vegetationRandom(seed, x, z, 0xe4d3) * Math.PI * 2;
	const amount = Math.floor(offset / 4);

	return {
		x: Math.round(Math.cos(direction) * amount),
		z: Math.round(Math.sin(direction) * amount)
	};
}

function addBranch(
	add: (x: number, y: number, z: number, type: TreeBlock['type']) => void,
	x: number,
	y: number,
	z: number,
	dx: number,
	dz: number,
	length: number
): void {
	for (let step = 1; step <= length; step += 1) {
		add(x + dx * step, y + Math.floor(step / 2), z + dz * step, 'wood');
	}
}

function addEllipsoidCanopy(
	add: (x: number, y: number, z: number, type: TreeBlock['type']) => void,
	x: number,
	y: number,
	z: number,
	rx: number,
	ry: number,
	rz: number,
	seed: number
): void {
	for (let dx = -rx; dx <= rx; dx += 1) {
		for (let dy = -ry; dy <= ry; dy += 1) {
			for (let dz = -rz; dz <= rz; dz += 1) {
				const distance = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
				const edgeNoise = vegetationRandom(seed, x + dx, z + dz, y + dy) * 0.22;

				if (distance <= 1.05 + edgeNoise) {
					add(x + dx, y + dy, z + dz, 'leaves');
				}
			}
		}
	}
}

function addFlatCanopy(
	add: (x: number, y: number, z: number, type: TreeBlock['type']) => void,
	x: number,
	y: number,
	z: number,
	radius: number,
	seed: number
): void {
	for (let dx = -radius; dx <= radius; dx += 1) {
		for (let dz = -radius; dz <= radius; dz += 1) {
			const distance = Math.hypot(dx, dz);
			const irregularity = vegetationRandom(seed, x + dx, z + dz, 0xf5e5) * 0.7;

			if (distance <= radius - 0.35 + irregularity) {
				add(x + dx, y, z + dz, 'leaves');

				if (distance < radius - 1 && (dx + dz) % 2 === 0) {
					add(x + dx, y + 1, z + dz, 'leaves');
				}
			}
		}
	}
}

function addPineCanopy(
	add: (x: number, y: number, z: number, type: TreeBlock['type']) => void,
	x: number,
	groundY: number,
	z: number,
	height: number,
	seed: number
): void {
	const crownStart = Math.max(groundY + 3, groundY + Math.floor(height * 0.32));
	const top = groundY + height + 1;

	for (let y = crownStart; y <= top; y += 1) {
		const normalized = (y - crownStart) / Math.max(1, top - crownStart);
		const tier = Math.floor((y - crownStart) / 2);
		const radius = Math.max(0, Math.round(3 * (1 - normalized) + (tier % 2 === 0 ? 0.6 : 0)));

		for (let dx = -radius; dx <= radius; dx += 1) {
			for (let dz = -radius; dz <= radius; dz += 1) {
				const distance = Math.hypot(dx, dz);
				const noise = vegetationRandom(seed, x + dx, z + dz, y) * 0.35;

				if (distance <= radius + noise && !(dx === 0 && dz === 0 && y <= groundY + height)) {
					add(x + dx, y, z + dz, 'leaves');
				}
			}
		}
	}
}

function addButtressRoots(
	add: (x: number, y: number, z: number, type: TreeBlock['type']) => void,
	x: number,
	groundY: number,
	z: number
): void {
	add(x, groundY + 1, z, 'wood');

	for (const [dx, dz] of [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	] as const) {
		add(x + dx, groundY + 1, z + dz, 'wood');
		add(x + dx * 2, groundY + 1, z + dz * 2, 'wood');
	}
}

function addEmergentCanopy(
	add: (x: number, y: number, z: number, type: TreeBlock['type']) => void,
	x: number,
	y: number,
	z: number,
	seed: number
): void {
	addEllipsoidCanopy(add, x, y, z, 4, 2, 4, seed ^ 0x1155);
	addEllipsoidCanopy(add, x + 2, y - 1, z - 1, 2, 1, 2, seed ^ 0x2266);
	addEllipsoidCanopy(add, x - 2, y, z + 1, 2, 1, 2, seed ^ 0x3377);
}

function addPalmFronds(
	add: (x: number, y: number, z: number, type: TreeBlock['type']) => void,
	x: number,
	y: number,
	z: number
): void {
	add(x, y, z, 'leaves');

	const directions = [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1],
		[1, 1],
		[-1, 1],
		[1, -1],
		[-1, -1]
	] as const;

	for (const [dx, dz] of directions) {
		for (let step = 1; step <= 4; step += 1) {
			const length = Math.hypot(dx, dz);
			const px = x + Math.round((dx / length) * step);
			const pz = z + Math.round((dz / length) * step);
			const drop = step >= 3 ? 1 : 0;
			add(px, y - drop, pz, 'leaves');
		}
	}
}

function addDroopingCanopy(
	add: (x: number, y: number, z: number, type: TreeBlock['type']) => void,
	x: number,
	y: number,
	z: number,
	seed: number
): void {
	addEllipsoidCanopy(add, x, y, z, 3, 2, 3, seed ^ 0x4488);

	for (let dx = -3; dx <= 3; dx += 1) {
		for (let dz = -3; dz <= 3; dz += 1) {
			const distance = Math.hypot(dx, dz);

			if (distance < 2.1 || distance > 3.35) {
				continue;
			}

			const length = 1 + Math.floor(vegetationRandom(seed, x + dx, z + dz, 0x5599) * 3);

			for (let drop = 1; drop <= length; drop += 1) {
				add(x + dx, y - drop, z + dz, 'leaves');
			}
		}
	}
}
