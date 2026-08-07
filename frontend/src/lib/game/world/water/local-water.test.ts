import { describe, expect, it } from 'vitest';
import { isLocalWaterSaveState, type LocalWaterForcing } from './LocalWaterState';
import { ShallowWaterSolver } from './ShallowWaterSolver';
import { LocalWaterSystem } from './LocalWaterSystem';
import type { VoxelWorld, LoadedWaterColumnProfile } from '../VoxelWorld';

const DRY: LocalWaterForcing = {
	rainIntensity: 0,
	snowIntensity: 0,
	rainShelter: 0,
	precipitationType: 'none',
	temperatureCelsius: 0,
	humidity: 1,
	daylight: 0,
	windStrength: 0
};

describe('ShallowWaterSolver', () => {
	it('conserves water while redistributing it on a closed domain', () => {
		const solver = new ShallowWaterSolver(2, 1, [
			{ groundHeight: 0, waterDepth: 1 },
			{ groundHeight: 0, waterDepth: 0 }
		]);

		for (let step = 0; step < 50; step += 1) {
			solver.step(0.1, DRY, {
				sourceRechargeRate: 0,
				allowBoundaryOutflow: false,
				evaporationScale: 0
			});
		}

		expect(solver.waterDepth[0] + solver.waterDepth[1]).toBeCloseTo(1, 9);
		expect(solver.waterDepth[0]).toBeCloseTo(solver.waterDepth[1], 3);
	});

	it('blocks water behind a voxel crest and overflows above it', () => {
		const blocked = new ShallowWaterSolver(2, 1, [
			{ groundHeight: 0, waterDepth: 1.5 },
			{ groundHeight: 2, waterDepth: 0 }
		]);
		blocked.step(0.1, DRY, { sourceRechargeRate: 0, evaporationScale: 0 });
		expect(blocked.waterDepth[1]).toBe(0);

		const overflowing = new ShallowWaterSolver(2, 1, [
			{ groundHeight: 0, waterDepth: 2.5 },
			{ groundHeight: 2, waterDepth: 0 }
		]);
		overflowing.step(0.1, DRY, { sourceRechargeRate: 0, evaporationScale: 0 });
		expect(overflowing.waterDepth[1]).toBeGreaterThan(0);
	});

	it('adds rain and never evaporates below zero', () => {
		const rainy = new ShallowWaterSolver(1, 1, [{ groundHeight: 0, waterDepth: 0 }]);
		const rain = rainy.step(
			0.1,
			{ ...DRY, rainIntensity: 1, precipitationType: 'rain' },
			{ sourceRechargeRate: 0, evaporationScale: 0 }
		);
		expect(rain.rainAdded).toBeCloseTo(0.000008, 10);
		expect(rainy.waterDepth[0]).toBeCloseTo(0.000008, 10);

		const hot = new ShallowWaterSolver(1, 1, [{ groundHeight: 0, waterDepth: 0.000001 }]);
		for (let step = 0; step < 1000; step += 1) {
			hot.step(
				0.1,
				{
					...DRY,
					temperatureCelsius: 55,
					humidity: 0,
					daylight: 1,
					windStrength: 1
				},
				{ sourceRechargeRate: 0 }
			);
		}
		expect(hot.waterDepth[0]).toBe(0);
	});

	it('is deterministic and remains finite during a long simulation', () => {
		const initialization = Array.from({ length: 81 }, (_, index) => ({
			groundHeight: Math.sin(index * 0.37) * 2,
			waterDepth: index % 7 === 0 ? 1 : 0,
			sourceDepth: index % 19 === 0 ? 0.25 : 0
		}));
		const left = new ShallowWaterSolver(9, 9, initialization);
		const right = new ShallowWaterSolver(9, 9, initialization);

		for (let step = 0; step < 2000; step += 1) {
			left.step(0.1, DRY, { allowBoundaryOutflow: false });
			right.step(0.1, DRY, { allowBoundaryOutflow: false });
		}

		expect([...left.waterDepth]).toEqual([...right.waterDepth]);
		for (const value of [...left.waterDepth, ...left.velocityX, ...left.velocityZ]) {
			expect(Number.isFinite(value)).toBe(true);
		}
	});
});

describe('LocalWaterSaveState', () => {
	it('accepts finite non-negative cells and rejects corrupt depths', () => {
		expect(
			isLocalWaterSaveState({
				version: 1,
				cells: [{ x: 2, z: -4, waterDepth: 0.75, velocityX: 0.2, velocityZ: -0.1 }]
			})
		).toBe(true);
		expect(
			isLocalWaterSaveState({
				version: 2,
				cells: [
					{
						x: 2,
						z: -4,
						waterDepth: 0.75,
						velocityX: 0.2,
						velocityZ: -0.1,
						snowWaterEquivalent: 0.15
					}
				],
				cycle: {
					elapsedSeconds: 10,
					rainfallAdded: 1,
					snowfallAdded: 1,
					snowmeltReleased: 0.5,
					evaporated: 0.1,
					sourceInflow: 0.2,
					boundaryOutflow: 0.3,
					runoffTransferred: 2
				}
			})
		).toBe(true);
		expect(
			isLocalWaterSaveState({
				version: 3,
				cells: [],
				erosion: {
					version: 1,
					cells: [{ x: 1, z: 2, sediment: 0.5, wear: 0.25 }],
					terrainEdits: [{ position: { x: 1, y: 3, z: 2 }, type: 'air' }],
					totalErodedVoxels: 1,
					totalDepositedVoxels: 0
				}
			})
		).toBe(true);
		expect(
			isLocalWaterSaveState({
				version: 1,
				cells: [{ x: 0, z: 0, waterDepth: -1, velocityX: 0, velocityZ: 0 }]
			})
		).toBe(false);
	});
});

describe('LocalWaterSystem', () => {
	it('stores snow, melts it into runoff and keeps the Lot 8 budget finite', () => {
		const fake = new FakeLocalWaterWorld();
		const water = new LocalWaterSystem(fake as unknown as VoxelWorld, {
			activeRadius: 8,
			recenterDistance: 4
		});
		water.activate({ x: 0, z: 0 });

		const snow: LocalWaterForcing = {
			...DRY,
			snowIntensity: 1,
			precipitationType: 'snow',
			temperatureCelsius: -8,
			humidity: 0.8
		};
		for (let step = 0; step < 120; step += 1) {
			water.update({ x: 0, z: 0 }, 1 / 60, snow);
		}

		const frozen = water.createDebugApi().getDiagnostics();
		expect(frozen.snowWaterEquivalent).toBeGreaterThan(0);
		expect(frozen.snowCells).toBeGreaterThan(0);
		expect(Math.abs(frozen.waterBudgetResidual)).toBeLessThan(1e-8);

		const warm: LocalWaterForcing = {
			...DRY,
			temperatureCelsius: 15,
			daylight: 1,
			humidity: 0.5
		};
		for (let step = 0; step < 240; step += 1) {
			water.update({ x: 0, z: 0 }, 1 / 60, warm);
		}

		const thawed = water.createDebugApi().getDiagnostics();
		expect(thawed.snowMelted).toBeGreaterThan(0);
		expect(thawed.runoffTransferred).toBeGreaterThanOrEqual(0);
		expect(Number.isFinite(thawed.maximumErosionPotential)).toBe(true);
		const save = water.serialize();
		expect(save.version).toBe(3);
		expect(save.cycle?.snowfallAdded).toBeGreaterThan(0);
		water.dispose();
	});
	it('sleeps a local window, persists changes and rebuilds after voxel edits', () => {
		const fake = new FakeLocalWaterWorld();
		fake.setNaturalWater(0, 0, 1, 1);
		const water = new LocalWaterSystem(fake as unknown as VoxelWorld, {
			activeRadius: 8,
			recenterDistance: 4
		});

		expect(water.activate({ x: 0, z: 0 }).length).toBeGreaterThan(0);
		const debug = water.createDebugApi();
		expect(debug.getActiveCenter()).toEqual({ x: 0, z: 0 });
		expect(debug.addWaterAtPlayer(0.5)).toBe(true);
		expect(debug.addWater(1, 0, 1)).toBe(true);

		for (let step = 0; step < 120; step += 1) {
			water.update({ x: 0, z: 0 }, 1 / 60, DRY);
		}

		const beforeDam = debug.getDiagnostics();
		expect(beforeDam.solverSteps).toBeGreaterThan(0);
		expect(Number.isFinite(beforeDam.totalVolume)).toBe(true);
		expect(water.serialize().cells.length).toBeGreaterThan(0);

		fake.setGround(0, 0, 2);
		for (let step = 0; step < 20; step += 1) {
			water.update({ x: 0, z: 0 }, 1 / 60, DRY);
		}
		expect(debug.getDiagnostics().maximumDepth).toBeGreaterThanOrEqual(0);

		water.dispose();
		expect(fake.renderedColumns.size).toBe(0);
	});
});

class FakeLocalWaterWorld {
	modificationVersion = 1;
	readonly renderedColumns = new Map<string, string>();
	private readonly columns = new Map<string, { ground: number; depth: number }>();

	setNaturalWater(x: number, z: number, ground: number, depth: number): void {
		this.columns.set(`${x},${z}`, { ground, depth });
		this.modificationVersion += 1;
	}

	setGround(x: number, z: number, ground: number): void {
		const key = `${x},${z}`;
		const previous = this.columns.get(key) ?? { ground: 0, depth: 0 };
		this.columns.set(key, { ...previous, ground });
		this.modificationVersion += 1;
	}

	getLoadedWaterColumnProfile(x: number, z: number): LoadedWaterColumnProfile {
		const cell = this.columns.get(`${Math.floor(x)},${Math.floor(z)}`) ?? {
			ground: 0,
			depth: 0
		};
		return {
			loaded: true,
			groundSurfaceY: cell.ground,
			generatedWaterBottomY: cell.depth > 0 ? cell.ground : null,
			generatedWaterSurfaceY: cell.depth > 0 ? cell.ground + cell.depth : null,
			generatedWaterDepth: cell.depth
		};
	}

	setTransientWaterColumn(
		x: number,
		z: number,
		ground: number,
		depth: number,
		bottom: number | null,
		top: number | null
	): boolean {
		const key = `${x},${z}`;
		const signature = `${ground}:${depth.toFixed(3)}:${bottom ?? ''}:${top ?? ''}`;
		const changed = this.renderedColumns.get(key) !== signature;
		this.renderedColumns.set(key, signature);
		return changed;
	}

	clearTransientWaterColumn(x: number, z: number): boolean {
		return this.renderedColumns.delete(`${x},${z}`);
	}
}
