import { describe, expect, test } from 'vitest';
import { Vector3 } from 'three';
import { getClimateRegionProfile } from '../regions/ClimateRegionProfile';
import { WindSystem } from '../wind/WindSystem';
import { WeatherCell } from './WeatherCell';
import { sampleWeatherCellInfluence } from './WeatherCellInfluence';
import { WeatherCellManager } from './WeatherCellManager';

function makeCell(x = 0, z = 0): WeatherCell {
	return new WeatherCell({
		id: 1,
		kind: 'heavy_rain',
		x,
		z,
		radius: 100,
		intensity: 1,
		velocityX: 0,
		velocityZ: 0,
		ageSeconds: 20,
		lifetimeSeconds: 300,
		growthSeconds: 10,
		decaySeconds: 30
	});
}

describe('moving weather cells Lot 4', () => {
	test('the cloud envelope reaches the player before the precipitation core', () => {
		const cell = makeCell();
		const leadingEdge = sampleWeatherCellInfluence(cell, 120, 0);
		expect(leadingEdge.cloud).toBeGreaterThan(0);
		expect(leadingEdge.core).toBe(0);

		const center = sampleWeatherCellInfluence(cell, 0, 0);
		expect(center.cloud).toBeCloseTo(1, 6);
		expect(center.core).toBeCloseTo(1, 6);
	});

	test('cells move in the unified wind direction', () => {
		const wind = new WindSystem({ seed: 10 });
		wind.update(1, 0.8);
		const cell = makeCell();
		cell.update(10, wind.currentState);
		const displacementX = cell.state.x;
		const displacementZ = cell.state.z;
		const dot =
			displacementX * wind.currentState.directionX + displacementZ * wind.currentState.directionZ;
		expect(dot).toBeGreaterThan(0);
	});

	test('same seed and inputs generate the same active cell timeline', () => {
		const run = () => {
			const manager = new WeatherCellManager({ seed: 100, durationScale: 0.001, maxCells: 12 });
			const wind = new WindSystem({ seed: 101 });
			const position = new Vector3(20, 10, -30);
			for (let index = 0; index < 20; index += 1) {
				wind.update(0.05, 0.5);
				manager.update(
					0.05,
					position,
					wind.currentState,
					getClimateRegionProfile('amazon_rainforest')
				);
			}
			return manager.serialize();
		};
		expect(run()).toEqual(run());
	});

	test('different seeds produce different cells', () => {
		const make = (seed: number) => {
			const manager = new WeatherCellManager({ seed, durationScale: 0.001 });
			const wind = new WindSystem({ seed: 202 });
			manager.update(
				0.5,
				new Vector3(),
				wind.currentState,
				getClimateRegionProfile('spawn_meadow')
			);
			return manager.serialize().cells;
		};
		expect(make(201)).not.toEqual(make(203));
	});

	test('manager selects the closest active cell influence at the player', () => {
		const manager = new WeatherCellManager({ seed: 301 });
		const wind = new WindSystem({ seed: 302 });
		manager.spawnAt('storm', 0, 0, 140, 1, wind.currentState);
		manager.spawnAt('mist', 500, 0, 80, 1, wind.currentState);
		manager.update(0, new Vector3(), wind.currentState, getClimateRegionProfile('spawn_meadow'));
		expect(manager.currentState.activeCellCount).toBe(2);
		expect(manager.currentState.dominantKind).toBe('storm');
		expect(manager.currentState.coreInfluence).toBeGreaterThan(0.9);
		expect(manager.currentState.coreParameters.lightningProbability).toBeGreaterThan(0.5);
	});

	test('save and restore preserve moving cell positions and scheduling', () => {
		const wind = new WindSystem({ seed: 402 });
		const first = new WeatherCellManager({ seed: 401 });
		first.spawnAt('snow', 10, 20, 120, 0.8, wind.currentState);
		first.update(12, new Vector3(), wind.currentState, getClimateRegionProfile('pine_highlands'));
		const second = new WeatherCellManager({ seed: 401 });
		second.restore(first.serialize());
		expect(second.serialize()).toEqual(first.serialize());
	});

	test('cell count stays bounded under accelerated spawning', () => {
		const manager = new WeatherCellManager({ seed: 501, durationScale: 0.0001, maxCells: 5 });
		const wind = new WindSystem({ seed: 502 });
		manager.update(
			5,
			new Vector3(),
			wind.currentState,
			getClimateRegionProfile('amazon_rainforest')
		);
		expect(manager.activeCells.length).toBeLessThanOrEqual(5);
	});

	test('all cell and influence values remain finite during a long simulation', () => {
		const manager = new WeatherCellManager({ seed: 601, durationScale: 0.005, maxCells: 12 });
		const wind = new WindSystem({ seed: 602 });
		const position = new Vector3();
		for (let index = 0; index < 6000; index += 1) {
			wind.update(0.1, 0.65);
			position.x = Math.sin(index * 0.004) * 80;
			position.z = Math.cos(index * 0.003) * 80;
			manager.update(
				0.1,
				position,
				wind.currentState,
				getClimateRegionProfile(index % 2 === 0 ? 'amazon_rainforest' : 'pine_highlands')
			);
			if (index % 200 === 0) {
				for (const value of [
					manager.currentState.cloudInfluence,
					manager.currentState.coreInfluence,
					manager.currentState.cloudParameters.cloudCoverage,
					manager.currentState.coreParameters.precipitation
				]) {
					expect(Number.isFinite(value)).toBe(true);
				}
			}
		}
	}, 15_000);
});
