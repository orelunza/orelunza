import { describe, expect, test } from 'vitest';
import { Vector3 } from 'three';
import { WeatherCellManager } from '../cells/WeatherCellManager';
import { WeatherScheduler } from '../weather/WeatherScheduler';
import type { WeatherWorldQuery } from '../weather/WeatherWorldQuery';
import { WindSystem } from '../wind/WindSystem';
import { ClimateSystem } from '../climate/ClimateSystem';
import { ClimateRegionResolver } from './ClimateRegionResolver';
import { allClimateRegionProfiles, getClimateRegionProfile } from './ClimateRegionProfile';
import { RegionalWeatherSystem } from './RegionalWeatherSystem';

function worldFor(zoneAt: (x: number, z: number) => string): WeatherWorldQuery {
	return {
		surfaceHeightAt: () => 9,
		rainOcclusionAt: () => 0,
		climateZoneAt: zoneAt
	};
}

describe('regional climate and weather Lot 4', () => {
	test('defines bounded climate and moving-cell parameters for every region', () => {
		for (const profile of allClimateRegionProfiles()) {
			expect(profile.zone.length).toBeGreaterThan(0);
			expect(profile.baseTemperatureCelsius).toBeGreaterThan(-50);
			expect(profile.baseTemperatureCelsius).toBeLessThan(60);
			expect(profile.humidity).toBeGreaterThanOrEqual(0);
			expect(profile.humidity).toBeLessThanOrEqual(1);
			expect(profile.windMultiplier).toBeGreaterThan(0);
			expect(profile.cellSpawnSeconds[0]).toBeGreaterThan(0);
			expect(profile.cellSpawnSeconds[1]).toBeGreaterThanOrEqual(profile.cellSpawnSeconds[0]);
			expect(profile.cellRadius[0]).toBeGreaterThan(0);
			expect(profile.cellRadius[1]).toBeGreaterThanOrEqual(profile.cellRadius[0]);
			const totalWeight = Object.values(profile.cellWeatherWeights).reduce(
				(total, value) => total + (value ?? 0),
				0
			);
			expect(totalWeight).toBeGreaterThan(0);
		}
	});

	test('resolves the production terrain zone at the player position', () => {
		const resolver = new ClimateRegionResolver();
		resolver.update(
			0,
			new Vector3(-100, 10, 40),
			worldFor(() => 'Amazon Rainforest')
		);
		expect(resolver.currentState.regionId).toBe('amazon_rainforest');
		expect(resolver.currentState.zone).toBe('Amazon Rainforest');
		expect(resolver.currentState.humidity).toBeCloseTo(0.9, 5);
	});

	test('blends climate values progressively when crossing a hard biome boundary', () => {
		const resolver = new ClimateRegionResolver();
		const world = worldFor((x) => (x < 0 ? 'Amazon Rainforest' : 'Pine Highlands'));
		resolver.update(0, new Vector3(-80, 10, 0), world);
		const warm = resolver.currentState.baseTemperatureCelsius;
		resolver.update(0.1, new Vector3(80, 10, 0), world);
		const firstColdFrame = resolver.currentState.baseTemperatureCelsius;

		expect(resolver.currentState.regionId).toBe('pine_highlands');
		expect(firstColdFrame).toBeLessThan(warm);
		expect(firstColdFrame).toBeGreaterThan(7);
		for (let index = 0; index < 400; index += 1) {
			resolver.update(0.1, new Vector3(80, 10, 0), world);
		}
		expect(resolver.currentState.baseTemperatureCelsius).toBeGreaterThanOrEqual(7);
		expect(resolver.currentState.baseTemperatureCelsius).toBeLessThan(7.02);
	});

	test('nearby samples expose a mixed boundary instead of a binary climate snap', () => {
		const resolver = new ClimateRegionResolver();
		const world = worldFor((x) => (x < 0 ? 'Forest Edge' : 'Spawn Meadow'));
		resolver.update(0, new Vector3(0, 10, 0), world);
		expect(resolver.currentState.boundaryBlend).toBeGreaterThan(0.2);
		expect(resolver.currentState.boundaryBlend).toBeLessThan(0.8);
	});

	test('regional humidity and temperature feed the existing climate system', () => {
		const scheduler = new WeatherScheduler({ seed: 41, initialWeather: 'clear' });
		const wind = new WindSystem({ seed: 42 });
		const climate = new ClimateSystem();
		const resolver = new ClimateRegionResolver();
		const world = worldFor(() => 'Amazon Rainforest');
		resolver.update(0, new Vector3(-100, 10, 40), world);
		wind.update(1, scheduler.currentState.parameters.windStrength);
		climate.update(
			1,
			new Vector3(-100, 10, 40),
			0.58,
			scheduler.currentState,
			wind.currentState,
			world,
			resolver.currentState
		);
		expect(climate.currentState.zone).toBe('Amazon Rainforest');
		expect(climate.currentState.temperatureCelsius).toBeGreaterThan(20);
		expect(climate.currentState.humidity).toBeGreaterThan(0.6);
	});

	test('the same synoptic rain is stronger in Amazonia than in the build meadow', () => {
		const scheduler = new WeatherScheduler({ seed: 51, initialWeather: 'heavy_rain' });
		scheduler.forceWeather('heavy_rain');
		const cells = new WeatherCellManager({ seed: 52 });
		const wind = new WindSystem({ seed: 53 });
		const amazonResolver = new ClimateRegionResolver();
		const meadowResolver = new ClimateRegionResolver();
		amazonResolver.update(
			0,
			new Vector3(),
			worldFor(() => 'Amazon Rainforest')
		);
		meadowResolver.update(
			0,
			new Vector3(),
			worldFor(() => 'Free Build Meadow')
		);
		cells.update(0, new Vector3(), wind.currentState, getClimateRegionProfile('spawn_meadow'));

		const amazon = new RegionalWeatherSystem();
		amazon.update(scheduler.currentState, amazonResolver.currentState, cells.currentState);
		const meadow = new RegionalWeatherSystem();
		meadow.update(scheduler.currentState, meadowResolver.currentState, cells.currentState);

		expect(amazon.currentState.parameters.precipitation).toBeGreaterThan(
			meadow.currentState.parameters.precipitation
		);
		expect(amazon.currentState.parameters.humidity).toBeGreaterThan(
			meadow.currentState.parameters.humidity
		);
	});

	test('a storm cell darkens the sky before its precipitation core arrives', () => {
		const scheduler = new WeatherScheduler({ seed: 61, initialWeather: 'clear' });
		const wind = new WindSystem({ seed: 62 });
		const cells = new WeatherCellManager({ seed: 63 });
		cells.spawnAt('storm', 120, 0, 100, 1, wind.currentState);
		cells.update(
			0,
			new Vector3(0, 10, 0),
			wind.currentState,
			getClimateRegionProfile('spawn_meadow')
		);
		const resolver = new ClimateRegionResolver();
		resolver.update(
			0,
			new Vector3(),
			worldFor(() => 'Spawn Meadow')
		);
		const regional = new RegionalWeatherSystem();
		regional.update(scheduler.currentState, resolver.currentState, cells.currentState);

		expect(cells.currentState.cloudInfluence).toBeGreaterThan(0);
		expect(cells.currentState.coreInfluence).toBe(0);
		expect(regional.currentState.parameters.cloudCoverage).toBeGreaterThan(
			scheduler.currentState.parameters.cloudCoverage
		);
		expect(regional.currentState.parameters.precipitation).toBe(0);
	});

	test('region smoothing state serializes and restores exactly', () => {
		const first = new ClimateRegionResolver();
		first.update(
			0,
			new Vector3(),
			worldFor(() => 'Riverbank')
		);
		first.update(
			3,
			new Vector3(),
			worldFor(() => 'Central City')
		);
		const second = new ClimateRegionResolver();
		second.restore(first.serialize());

		expect(second.currentState.regionId).toBe(first.currentState.regionId);
		expect(second.currentState.baseTemperatureCelsius).toBeCloseTo(
			first.currentState.baseTemperatureCelsius,
			8
		);
		expect(second.currentState.humidity).toBeCloseTo(first.currentState.humidity, 8);
		expect(second.currentState.boundaryBlend).toBeCloseTo(first.currentState.boundaryBlend, 8);
	});
});
