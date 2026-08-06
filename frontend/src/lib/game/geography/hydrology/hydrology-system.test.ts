import { describe, expect, test } from 'vitest';
import { PlanetHydrologyModel, type PlanetHydrologySample } from './PlanetHydrologyModel';
import { WatershedResolver } from './WatershedResolver';

function createValley(resolution = 11): {
	elevation: Float32Array;
	land: Uint8Array;
	centreColumn: number;
} {
	const elevation = new Float32Array(resolution * resolution);
	const land = new Uint8Array(resolution * resolution).fill(1);
	const centreColumn = Math.floor(resolution / 2);
	for (let row = 0; row < resolution; row += 1) {
		for (let column = 0; column < resolution; column += 1) {
			const valleyDistance = Math.abs(column - centreColumn);
			elevation[row * resolution + column] = valleyDistance * 18 + (resolution - row) * 5 + 12;
		}
	}
	land[(resolution - 1) * resolution + centreColumn] = 0;
	return { elevation, land, centreColumn };
}

function followFlow(flowTo: Int32Array, start: number): number[] {
	const path: number[] = [];
	const seen = new Set<number>();
	let current = start;
	while (current >= 0 && !seen.has(current)) {
		seen.add(current);
		path.push(current);
		current = flowTo[current] ?? -1;
	}
	return path;
}

describe('planet Earth Lot 6 rivers and lakes', () => {
	test('builds deterministic acyclic watershed basins', () => {
		const valley = createValley();
		const input = {
			resolution: 11,
			halfExtentMeters: 220,
			elevationMeters: valley.elevation,
			landMask: valley.land,
			riverThreshold: 3
		};
		const first = new WatershedResolver().resolve(input);
		const second = new WatershedResolver().resolve(input);
		expect([...second.flowTo]).toEqual([...first.flowTo]);
		expect([...second.basinId]).toEqual([...first.basinId]);
		for (let index = 0; index < first.flowTo.length; index += 1) {
			const path = followFlow(first.flowTo, index);
			expect(path.length).toBeLessThanOrEqual(first.flowTo.length);
		}
	});

	test('accumulates tributaries into a river connected to the ocean', () => {
		const valley = createValley();
		const grid = new WatershedResolver().resolve({
			resolution: 11,
			halfExtentMeters: 220,
			elevationMeters: valley.elevation,
			landMask: valley.land,
			riverThreshold: 3
		});
		const upstream = valley.centreColumn;
		const downstream = 9 * 11 + valley.centreColumn;
		expect(grid.flowAccumulation[downstream]).toBeGreaterThan(grid.flowAccumulation[upstream]);
		expect([...grid.riverStrength].some((value) => value > 0)).toBe(true);
		expect([...grid.riverMouth].some((value) => value === 1)).toBe(true);
		expect(grid.oceanConnected[downstream]).toBe(1);
	});

	test('fills closed depressions as lakes with stable spill elevations', () => {
		const resolution = 9;
		const elevation = new Float32Array(resolution * resolution);
		const land = new Uint8Array(resolution * resolution).fill(1);
		for (let row = 0; row < resolution; row += 1) {
			for (let column = 0; column < resolution; column += 1) {
				const dx = column - 4;
				const dy = row - 4;
				elevation[row * resolution + column] = 10 + (dx * dx + dy * dy) * 2;
			}
		}
		land[8 * resolution + 4] = 0;
		elevation[8 * resolution + 4] = -1;
		const grid = new WatershedResolver().resolve({
			resolution,
			halfExtentMeters: 160,
			elevationMeters: elevation,
			landMask: land,
			riverThreshold: 3,
			minimumLakeDepthMeters: 0.5
		});
		const centre = 4 * resolution + 4;
		expect(grid.lakeDepthMeters[centre]).toBeGreaterThan(10);
		expect(grid.filledElevationMeters[centre]).toBeGreaterThan(elevation[centre]);
		expect([...grid.lakeDepthMeters].filter((value) => value > 0).length).toBeGreaterThan(5);
	});

	test('marks steep river drops as waterfalls', () => {
		const valley = createValley(9);
		for (let row = 0; row < 4; row += 1) {
			valley.elevation[row * 9 + valley.centreColumn] += 80;
		}
		const grid = new WatershedResolver().resolve({
			resolution: 9,
			halfExtentMeters: 120,
			elevationMeters: valley.elevation,
			landMask: valley.land,
			riverThreshold: 2,
			minimumWaterfallDropMeters: 20
		});
		expect([...grid.waterfallDropMeters].some((value) => value >= 20)).toBe(true);
	});

	test('samples continuous local river and lake surfaces without NaN', () => {
		const model = new PlanetHydrologyModel(
			{
				halfExtentMeters: 128,
				elevationAt: (x, z) => Math.abs(x) * 0.3 + (128 - z) * 0.08 + Math.sin(z / 15) * 3,
				landAt: (_x, z) => (z < 120 ? 1 : 0)
			},
			{ resolution: 65, moisture: 0.82, seed: 42 }
		);
		let waterSample: PlanetHydrologySample | null = null;
		let waterCoordinate: { x: number; z: number } | null = null;
		for (let z = -128; z <= 128 && !waterSample; z += 2) {
			for (let x = -128; x <= 128; x += 2) {
				const sample = model.sample(x, z);
				if (sample.kind !== 'none') {
					waterSample = sample;
					waterCoordinate = { x, z };
					break;
				}
			}
		}
		expect(waterSample).not.toBeNull();
		expect(waterCoordinate).not.toBeNull();
		if (!waterSample || !waterCoordinate) return;
		expect(model.sample(waterCoordinate.x, waterCoordinate.z)).toEqual(waterSample);
		expect(
			Object.values(waterSample)
				.filter((value) => typeof value === 'number')
				.every(Number.isFinite)
		).toBe(true);
	});
});
