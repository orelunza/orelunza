import { worldState } from '$lib/state/world.svelte';
import type { WorldCoordinate } from '../world/voxel-types';

export class WorldSyncService {
	private lastSent: { x: number; z: number } | null = null;

	async syncPosition(regionId: string, position: WorldCoordinate): Promise<void> {
		if (
			this.lastSent &&
			Math.hypot(this.lastSent.x - position.x, this.lastSent.z - position.z) < 1.5
		) {
			return;
		}

		this.lastSent = {
			x: position.x,
			z: position.z
		};

		await worldState.move({
			region_id: regionId,
			place_id: null,
			position_x: position.x,
			position_y: position.z
		});
	}
}
