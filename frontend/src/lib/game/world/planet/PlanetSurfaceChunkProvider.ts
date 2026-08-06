import type { ChunkCoordinate } from '../voxel-types';
import type { PlanetVoxelBridge } from './PlanetVoxelBridge';

export interface PlanetSurfaceChunkProviderDiagnostics {
	loadedChunks: number;
	lastCentre: ChunkCoordinate | null;
	streamRadius: number;
}

/** Thin streaming façade that keeps local chunk policy out of the planet session. */
export class PlanetSurfaceChunkProvider {
	private lastCentre: ChunkCoordinate | null = null;

	constructor(
		readonly bridge: PlanetVoxelBridge,
		readonly streamRadius = 2
	) {
		if (!Number.isInteger(streamRadius) || streamRadius < 0 || streamRadius > 12) {
			throw new RangeError('Planet surface stream radius must be an integer between 0 and 12.');
		}
	}

	get diagnostics(): PlanetSurfaceChunkProviderDiagnostics {
		return {
			loadedChunks: this.bridge.world.getLoadedChunks().length,
			lastCentre: this.lastCentre ? { ...this.lastCentre } : null,
			streamRadius: this.streamRadius
		};
	}

	update(position: Readonly<{ x: number; z: number }>): boolean {
		if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) {
			throw new RangeError('Planet surface streaming position must be finite.');
		}
		const centre = {
			x: Math.floor(position.x / 16),
			z: Math.floor(position.z / 16)
		};
		if (this.lastCentre?.x === centre.x && this.lastCentre.z === centre.z) {
			return false;
		}
		this.lastCentre = centre;
		return this.bridge.ensureChunksAround(position, this.streamRadius);
	}
}
