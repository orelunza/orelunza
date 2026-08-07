import { describe, expect, it } from 'vitest';
import type { BlockType } from '../voxel-types';
import {
	HydraulicErosionSystem,
	type HydraulicErosionCell,
	type HydraulicErosionWorld
} from './HydraulicErosionSystem';
import type { HydraulicErosionSaveState, NaturalTerrainEditSaveState } from './ErosionState';

const FAST_FLOW: HydraulicErosionCell = {
	x: 0,
	z: 0,
	active: true,
	groundHeight: 4,
	waterDepth: 2,
	velocityX: 2,
	velocityZ: 0,
	groundSlope: 1,
	waterBody: 'river'
};

describe('HydraulicErosionSystem', () => {
	it('detaches natural terrain into conserved suspended sediment', () => {
		const world = new FakeErosionWorld();
		world.setSurface(0, 0, 4, 'dirt');
		world.setSurface(1, 0, 3, 'dirt');
		const erosion = new HydraulicErosionSystem(world, {
			erosionScale: 1000,
			maximumTerrainChangesPerStep: 1
		});

		const result = erosion.step(1, [FAST_FLOW, { ...FAST_FLOW, x: 1, groundHeight: 3 }]);
		expect(result.erodedVoxels).toBe(1);
		expect(world.eroded).toHaveLength(1);
		expect(erosion.diagnostics.totalSediment).toBeCloseTo(1, 12);
		expect(erosion.diagnostics.sedimentMassResidual).toBeCloseTo(0, 12);
	});

	it('never erodes a player-protected column', () => {
		const world = new FakeErosionWorld();
		world.setSurface(0, 0, 4, 'dirt', true);
		const erosion = new HydraulicErosionSystem(world, { erosionScale: 1000 });
		for (let step = 0; step < 10; step += 1) erosion.step(1, [FAST_FLOW]);
		expect(world.eroded).toHaveLength(0);
		expect(erosion.diagnostics.protectedColumns).toBe(1);
	});

	it('deposits suspended sediment when a lake loses carrying capacity', () => {
		const world = new FakeErosionWorld();
		world.setSurface(0, 0, 2, 'sand');
		const erosion = new HydraulicErosionSystem(world, { maximumTerrainChangesPerStep: 1 });
		const save: HydraulicErosionSaveState = {
			version: 1,
			cells: [{ x: 0, z: 0, sediment: 1, wear: 0 }],
			terrainEdits: [],
			totalErodedVoxels: 1,
			totalDepositedVoxels: 0
		};
		erosion.restore(save);
		const result = erosion.step(1, [
			{
				...FAST_FLOW,
				groundHeight: 2,
				waterDepth: 0.05,
				velocityX: 0.03,
				groundSlope: 0.02,
				waterBody: 'lake'
			}
		]);
		expect(result.depositedVoxels).toBe(1);
		expect(world.deposited).toHaveLength(1);
		expect(world.deposited[0]?.type).toBe('sand');
		expect(erosion.diagnostics.totalSediment).toBeCloseTo(0, 12);
		expect(erosion.diagnostics.sedimentMassResidual).toBeCloseTo(0, 12);
	});

	it('persists sediment progress and natural terrain edits deterministically', () => {
		const world = new FakeErosionWorld();
		world.setSurface(0, 0, 4, 'grass');
		world.edits = [{ position: { x: 3, y: 2, z: 4 }, type: 'air' }];
		const erosion = new HydraulicErosionSystem(world, { erosionScale: 250 });
		erosion.step(1, [FAST_FLOW]);
		const save = erosion.serialize();

		const restoredWorld = new FakeErosionWorld();
		const restored = new HydraulicErosionSystem(restoredWorld);
		restored.restore(save);
		expect(restored.serialize()).toEqual(save);
		expect(restoredWorld.loadedEdits).toEqual(save.terrainEdits);
	});
});

class FakeErosionWorld implements HydraulicErosionWorld {
	readonly surfaces = new Map<string, { y: number; type: BlockType; protected: boolean }>();
	readonly eroded: Array<{ x: number; y: number; z: number; type: BlockType }> = [];
	readonly deposited: Array<{ x: number; y: number; z: number; type: 'dirt' | 'sand' }> = [];
	edits: NaturalTerrainEditSaveState[] = [];
	loadedEdits: NaturalTerrainEditSaveState[] = [];

	setSurface(x: number, z: number, y: number, type: BlockType, protectedByPlayer = false): void {
		this.surfaces.set(`${x},${z}`, { y, type, protected: protectedByPlayer });
	}

	getErosionSurfaceProfile(x: number, z: number) {
		const surface = this.surfaces.get(`${Math.floor(x)},${Math.floor(z)}`) ?? {
			y: 0,
			type: 'dirt' as BlockType,
			protected: false
		};
		return {
			loaded: true,
			protectedByPlayer: surface.protected,
			surfaceY: surface.y,
			type: surface.type
		};
	}

	erodeNaturalSurface(x: number, z: number) {
		const key = `${Math.floor(x)},${Math.floor(z)}`;
		const surface = this.surfaces.get(key);
		if (!surface || surface.protected) return null;
		const position = { x: Math.floor(x), y: surface.y, z: Math.floor(z) };
		this.eroded.push({ ...position, type: surface.type });
		this.surfaces.set(key, { ...surface, y: surface.y - 1, type: 'dirt' });
		return { position };
	}

	depositNaturalSurface(x: number, z: number, type: 'dirt' | 'sand') {
		const key = `${Math.floor(x)},${Math.floor(z)}`;
		const surface = this.surfaces.get(key) ?? { y: 0, type: 'dirt' as BlockType, protected: false };
		if (surface.protected) return null;
		const position = { x: Math.floor(x), y: surface.y + 1, z: Math.floor(z) };
		this.deposited.push({ ...position, type });
		this.surfaces.set(key, { ...surface, y: position.y, type });
		return { position };
	}

	exportNaturalTerrainEdits(): NaturalTerrainEditSaveState[] {
		return this.edits.map((edit) => ({ ...edit, position: { ...edit.position } }));
	}

	loadNaturalTerrainEdits(edits: NaturalTerrainEditSaveState[]): void {
		this.loadedEdits = edits.map((edit) => ({ ...edit, position: { ...edit.position } }));
		this.edits = this.loadedEdits.map((edit) => ({ ...edit, position: { ...edit.position } }));
	}
}
