import { describe, expect, test } from 'vitest';
import { Scene, Vector3 } from 'three';
import { EnvironmentState } from '../EnvironmentState';
import { resolveEnvironmentQuality } from '../EnvironmentQuality';
import { EnvironmentDiagnostics } from '../diagnostics/EnvironmentDiagnostics';
import { getSpecialWeatherPreset } from './SpecialWeatherPreset';
import { SpecialWeatherSystem, type SpecialWeatherContext } from './SpecialWeatherSystem';
import { SPECIAL_WEATHER_KINDS } from './SpecialWeatherState';
import { AshRenderer } from './rendering/AshRenderer';
import { DustStormRenderer } from './rendering/DustStormRenderer';
import { HotHazeRenderer } from './rendering/HotHazeRenderer';

const DRY_CONTEXT: SpecialWeatherContext = {
	regionId: 'free_build_meadow',
	dayNumber: 0,
	daylight: 1,
	temperatureCelsius: 31,
	humidity: 0.28,
	precipitation: 0,
	windStrength: 0.9
};

describe('special weather and production hardening Lot 6', () => {
	test('defines finite and bounded parameters for every special-weather preset', () => {
		for (const kind of SPECIAL_WEATHER_KINDS) {
			const preset = getSpecialWeatherPreset(kind);
			expect(preset.kind).toBe(kind);
			expect(preset.transitionSeconds).toBeGreaterThan(0);
			for (const [name, value] of Object.entries(preset.parameters)) {
				expect(Number.isFinite(value), name).toBe(true);
				if (!['windMultiplier', 'temperatureOffset'].includes(name)) {
					expect(value, name).toBeGreaterThanOrEqual(0);
					expect(value, name).toBeLessThanOrEqual(1);
				}
			}
		}
	});

	test('the same seed and climate produce the same natural sequence', () => {
		const run = () => {
			const system = new SpecialWeatherSystem(0x12345678);
			for (let day = 0; day < 80; day += 1) {
				for (let step = 0; step < 20; step += 1) {
					system.update(0.5, { ...DRY_CONTEXT, dayNumber: day });
				}
			}
			return system.serialize();
		};
		expect(run()).toEqual(run());
	});

	test('dust storms never arise naturally in wet or cold production regions', () => {
		for (const regionId of ['amazon_rainforest', 'pine_highlands'] as const) {
			const system = new SpecialWeatherSystem(0xabcdef01);
			for (let day = 0; day < 300; day += 1) {
				system.update(1, {
					...DRY_CONTEXT,
					regionId,
					dayNumber: day,
					humidity: regionId === 'amazon_rainforest' ? 0.92 : 0.62,
					temperatureCelsius: regionId === 'amazon_rainforest' ? 29 : -4
				});
				expect(system.currentState.target).not.toBe('dust_storm');
			}
		}
	});

	test('volcanic ash and dense smoke remain explicit until geological emitters exist', () => {
		const system = new SpecialWeatherSystem(99);
		for (let day = 0; day < 500; day += 1) {
			system.update(1, { ...DRY_CONTEXT, dayNumber: day });
			expect(system.currentState.target).not.toBe('volcanic_ash');
			expect(system.currentState.target).not.toBe('dense_smoke');
		}
	});

	test('forced ash transitions progressively and remains distinct from snow', () => {
		const system = new SpecialWeatherSystem(12);
		system.set('volcanic_ash');
		system.update(4, DRY_CONTEXT);
		expect(system.currentState.parameters.ash).toBeGreaterThan(0);
		expect(system.currentState.parameters.dust).toBeLessThan(system.currentState.parameters.ash);
		expect(system.currentState.parameters.temperatureOffset).toBeLessThan(0);
		expect(system.currentState.transition).toBeGreaterThan(0);
		expect(system.currentState.transition).toBeLessThan(1);
	});

	test('save and restore preserve an in-progress special-weather transition exactly', () => {
		const first = new SpecialWeatherSystem(16);
		first.set('dust_storm');
		first.update(3.75, DRY_CONTEXT);
		const second = new SpecialWeatherSystem(16);
		second.restore(first.serialize());
		expect(second.serialize()).toEqual(first.serialize());
		expect(second.currentState.parameters).toEqual(first.currentState.parameters);
	});

	test('clearing a forced effect fades back toward neutral instead of snapping', () => {
		const system = new SpecialWeatherSystem(20);
		system.set('dense_smoke');
		system.update(30, DRY_CONTEXT);
		expect(system.currentState.current).toBe('dense_smoke');
		system.clear();
		system.update(1, DRY_CONTEXT);
		expect(system.currentState.parameters.smoke).toBeGreaterThan(0);
		expect(system.currentState.target).toBe('none');
		system.update(30, DRY_CONTEXT);
		expect(system.currentState.current).toBe('none');
		expect(system.currentState.parameters.smoke).toBeCloseTo(0, 6);
	});

	test('all values remain finite and bounded during thousands of changes', () => {
		const system = new SpecialWeatherSystem(0xf00dcafe);
		const kinds = SPECIAL_WEATHER_KINDS;
		for (let index = 0; index < 20_000; index += 1) {
			if (index % 700 === 0) {
				system.set(kinds[(index / 700) % kinds.length] ?? 'none');
			}
			if (index % 700 === 350) {
				system.clear();
			}
			system.update(0.1, { ...DRY_CONTEXT, dayNumber: Math.floor(index / 1000) });
		}
		for (const value of Object.values(system.currentState.parameters)) {
			expect(Number.isFinite(value)).toBe(true);
		}
		expect(system.currentState.transition).toBeGreaterThanOrEqual(0);
		expect(system.currentState.transition).toBeLessThanOrEqual(1);
	}, 15_000);

	test('quality profiles keep every special particle pool strictly bounded', () => {
		const low = resolveEnvironmentQuality('low');
		const medium = resolveEnvironmentQuality('medium');
		const high = resolveEnvironmentQuality('high');
		expect(low.ashParticleCount).toBeLessThan(medium.ashParticleCount);
		expect(medium.ashParticleCount).toBeLessThan(high.ashParticleCount);
		expect(low.dustParticleCount).toBeLessThan(medium.dustParticleCount);
		expect(medium.dustParticleCount).toBeLessThan(high.dustParticleCount);
	});

	test('special renderers reuse scene objects across quality changes and dispose idempotently', () => {
		const scene = new Scene();
		const system = new SpecialWeatherSystem(25);
		system.set('dust_storm');
		system.update(30, DRY_CONTEXT);
		const low = resolveEnvironmentQuality('low');
		const high = resolveEnvironmentQuality('high');
		const ash = new AshRenderer(scene, low, 1);
		const dust = new DustStormRenderer(scene, low, 2);
		const haze = new HotHazeRenderer(scene, low);
		const objectCount = scene.children.length;
		ash.applyQuality(high);
		dust.applyQuality(high);
		haze.applyQuality(high);
		dust.update(system.currentState, new EnvironmentState(), new Vector3());
		expect(scene.children.length).toBe(objectCount);
		expect(dust.visibleCount).toBeLessThanOrEqual(high.dustParticleCount);
		ash.dispose();
		ash.dispose();
		dust.dispose();
		dust.dispose();
		haze.dispose();
		haze.dispose();
		expect(scene.children).toHaveLength(0);
	});

	test('production diagnostics report bounded budgets and survive disposal', () => {
		const diagnostics = new EnvironmentDiagnostics();
		const state = new EnvironmentState();
		state.rainVisibleIntensity = 0.5;
		state.snowBlend = 0.25;
		state.weatherCellCount = 3;
		const special = new SpecialWeatherSystem(30);
		special.set('volcanic_ash');
		special.update(30, DRY_CONTEXT);
		const quality = resolveEnvironmentQuality('medium');
		for (let index = 0; index < 120; index += 1) {
			diagnostics.record(1 / 60, 0.4, state, special.currentState, quality);
		}
		const snapshot = diagnostics.snapshot(quality);
		expect(snapshot.averageFps).toBeCloseTo(60, 0);
		expect(snapshot.visibleParticles).toBeLessThanOrEqual(snapshot.particleBudget);
		expect(snapshot.activeWeatherCells).toBe(3);
		expect(snapshot.weatherDrawCalls).toBeGreaterThan(0);
		diagnostics.dispose();
		expect(diagnostics.snapshot(quality).disposed).toBe(true);
	});
});
