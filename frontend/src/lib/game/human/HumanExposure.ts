import type { PlayerState } from '../player/PlayerState';
import { BlockRegistry } from '../world/BlockRegistry';
import type { BlockCoordinate, VoxelBlock } from '../world/voxel-types';
import { WORLD_MAX_Y } from '../world/voxel-types';

export interface HumanExposureWorldQuery {
	getLoadedBlock(position: BlockCoordinate): VoxelBlock | null;
	readonly modificationVersion?: number;
}

export interface HumanExposureSnapshot {
	sheltered: boolean;
	skyExposure: number;
	windExposure: number;
	precipitationExposure: number;
	nearbyHeatCelsius: number;
}

const ROOF_SCAN_HEIGHT = 28;
const WIND_SCAN_DISTANCE = 5;
const HEAT_SCAN_RADIUS = 4;

interface HeatSampleCache {
	x: number;
	y: number;
	z: number;
	version: number;
	heat: number;
}

const heatSamples = new WeakMap<object, HeatSampleCache>();

export function sampleHumanExposure(
	world: HumanExposureWorldQuery,
	player: Readonly<PlayerState>,
	windDirectionRadians: number
): HumanExposureSnapshot {
	const blockX = Math.floor(player.position.x);
	const blockZ = Math.floor(player.position.z);
	const headY = Math.floor(player.position.y + player.height * 0.92);
	const chestY = Math.floor(player.position.y + player.height * 0.58);

	const roofOcclusion = scanRoofOcclusion(world, blockX, headY, blockZ);
	const skyExposure = clamp01(1 - roofOcclusion);
	const windExposure = sampleWindExposure(
		world,
		blockX,
		chestY,
		blockZ,
		finiteOr(windDirectionRadians, 0),
		roofOcclusion
	);
	const precipitationExposure = skyExposure;
	const sheltered = skyExposure <= 0.18 && windExposure <= 0.72;
	const nearbyHeatCelsius = sampleNearbyHeat(world, player);

	return {
		sheltered,
		skyExposure,
		windExposure,
		precipitationExposure,
		nearbyHeatCelsius
	};
}

function sampleNearbyHeat(world: HumanExposureWorldQuery, player: Readonly<PlayerState>): number {
	const centerX = Math.floor(player.position.x);
	const centerY = Math.floor(player.position.y + player.height * 0.45);
	const centerZ = Math.floor(player.position.z);
	const version = Number.isFinite(world.modificationVersion)
		? (world.modificationVersion as number)
		: -1;
	const cached = heatSamples.get(world as object);
	if (
		cached &&
		cached.x === centerX &&
		cached.y === centerY &&
		cached.z === centerZ &&
		cached.version === version
	) {
		return cached.heat;
	}
	let heat = 0;
	for (let x = centerX - HEAT_SCAN_RADIUS; x <= centerX + HEAT_SCAN_RADIUS; x += 1) {
		for (let y = centerY - 2; y <= centerY + 2; y += 1) {
			for (let z = centerZ - HEAT_SCAN_RADIUS; z <= centerZ + HEAT_SCAN_RADIUS; z += 1) {
				const block = world.getLoadedBlock({ x, y, z });
				if (!block) continue;
				const definition = BlockRegistry.get(block.type);
				if (!definition.heatCelsius || !BlockRegistry.isLit(block)) continue;
				const dx = x + 0.5 - player.position.x;
				const dy = y + 0.5 - (player.position.y + player.height * 0.45);
				const dz = z + 0.5 - player.position.z;
				const distance = Math.max(0.75, Math.hypot(dx, dy, dz));
				heat += definition.heatCelsius / Math.pow(distance, 1.35);
			}
		}
	}
	const result = Math.min(10, Math.max(0, heat));
	heatSamples.set(world as object, { x: centerX, y: centerY, z: centerZ, version, heat: result });
	return result;
}

function scanRoofOcclusion(
	world: HumanExposureWorldQuery,
	x: number,
	headY: number,
	z: number
): number {
	const endY = Math.min(WORLD_MAX_Y, headY + ROOF_SCAN_HEIGHT);
	for (let y = headY + 1; y <= endY; y += 1) {
		const block = world.getLoadedBlock({ x, y, z });
		if (!block || !block.solid || block.passable) continue;
		return block.type === 'leaves' ? 0.58 : 1;
	}
	return 0;
}

function sampleWindExposure(
	world: HumanExposureWorldQuery,
	x: number,
	y: number,
	z: number,
	windDirectionRadians: number,
	roofOcclusion: number
): number {
	// Sample the upwind direction plus two neighbouring rays. This is stable on
	// a voxel grid and lets walls/caves reduce wind without needing a special
	// "house" concept.
	const rays = [-Math.PI / 4, 0, Math.PI / 4];
	let openness = 0;
	for (const offset of rays) {
		const angle = windDirectionRadians + Math.PI + offset;
		const dx = Math.sin(angle);
		const dz = Math.cos(angle);
		let blocked = false;
		for (let distance = 1; distance <= WIND_SCAN_DISTANCE; distance += 1) {
			const sampleX = Math.floor(x + dx * distance);
			const sampleZ = Math.floor(z + dz * distance);
			for (let dy = -1; dy <= 1; dy += 1) {
				const block = world.getLoadedBlock({ x: sampleX, y: y + dy, z: sampleZ });
				if (block?.solid && !block.passable) {
					blocked = true;
					break;
				}
			}
			if (blocked) break;
		}
		openness += blocked ? 0 : 1;
	}

	const horizontal = openness / rays.length;
	return clamp01(horizontal * (1 - roofOcclusion * 0.18));
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
