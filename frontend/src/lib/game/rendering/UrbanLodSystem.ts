import type { BlockType, ChunkCoordinate } from '../world/voxel-types';
import { CHUNK_SIZE } from '../world/voxel-types';

const CLOSE_DETAIL = new Set<BlockType>([
	'table',
	'bed',
	'mattress',
	'wardrobe',
	'clothes_rack',
	'shoe_rack',
	'chair',
	'sofa',
	'kitchen_counter',
	'kitchen_cabinet',
	'refrigerator',
	'sink',
	'toilet',
	'shower',
	'mirror',
	'radio',
	'bookshelf',
	'rug',
	'cooking_pot',
	'frying_pan',
	'plate_stack',
	'glass_cup',
	'fruit_bowl',
	'shopping_cart',
	'changing_bench'
]);
const MEDIUM_DETAIL = new Set<BlockType>([
	'floor_lamp',
	'ceiling_light',
	'store_shelf',
	'produce_crate',
	'drink_cooler',
	'checkout_counter',
	'bench',
	'trash_bin',
	'bollard',
	'bus_shelter',
	'pool_ladder',
	'elevator_call_button',
	'elevator_panel',
	'power_panel'
]);

export function urbanTypeVisible(
	type: BlockType,
	chunk: ChunkCoordinate,
	cameraX: number,
	cameraZ: number
): boolean {
	const centerX = chunk.x * CHUNK_SIZE + CHUNK_SIZE * 0.5;
	const centerZ = chunk.z * CHUNK_SIZE + CHUNK_SIZE * 0.5;
	const distance = Math.hypot(cameraX - centerX, cameraZ - centerZ);
	if (CLOSE_DETAIL.has(type)) return distance <= 42;
	if (MEDIUM_DETAIL.has(type)) return distance <= 72;
	return true;
}
