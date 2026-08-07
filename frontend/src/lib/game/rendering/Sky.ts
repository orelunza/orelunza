import { Scene, Vector3, type WebGLRenderer } from 'three';
import {
	EnvironmentSystem,
	type EnvironmentDebugApi,
	type EnvironmentSaveState
} from '../environment/EnvironmentSystem';
import type { RenderQuality } from './QualitySettings';
import type { WeatherWorldQuery } from '../environment/weather/WeatherWorldQuery';
import type { WorldTimeSnapshot } from '../environment/time/WorldDate';
import type { WeatherKind } from '../environment/weather/WeatherState';
import type { LocalWaterForcing } from '../world/water/LocalWaterState';

export interface SkyOptions {
	renderer: WebGLRenderer;
	seed: string;
	quality: RenderQuality;
	dayLengthSeconds?: number;
	worldQuery?: WeatherWorldQuery;
}

/**
 * Thin façade over {@link EnvironmentSystem}.
 *
 * The rest of the game still talks to a `Sky` with the same lifecycle it always
 * had — construct, {@link update} each frame with the camera position and a
 * delta, {@link dispose} on teardown. Everything real now lives in the
 * environment package; this class only forwards, so GameEngine's integration
 * stays small and the production sky can grow across phases without touching
 * the loop.
 */
export class Sky {
	private readonly environment: EnvironmentSystem;

	constructor(scene: Scene, options: SkyOptions) {
		this.environment = new EnvironmentSystem({
			scene,
			renderer: options.renderer,
			seed: options.seed,
			quality: options.quality,
			dayLengthSeconds: options.dayLengthSeconds,
			worldQuery: options.worldQuery
		});
	}

	update(cameraPosition: Vector3, deltaSeconds: number): void {
		this.environment.update(cameraPosition, deltaSeconds);
	}

	get windDirection(): number {
		return this.environment.currentState.windDirection;
	}

	get windStrength(): number {
		return this.environment.currentState.windStrength;
	}

	get windGust(): number {
		return this.environment.currentState.windGust;
	}

	get temperatureCelsius(): number {
		return this.environment.currentState.temperatureCelsius;
	}

	get windChillCelsius(): number {
		return this.environment.currentState.windChillCelsius;
	}

	get breathVisibility(): number {
		return this.environment.currentState.breathVisibility;
	}

	get surfaceWeather(): Readonly<{ wetness: number; snowCoverage: number; frost: number }> {
		return this.environment.currentState;
	}

	get localWaterForcing(): LocalWaterForcing {
		const state = this.environment.currentState;
		return {
			rainIntensity: state.rainIntensity,
			snowIntensity: state.snowIntensity,
			// Camera shelter is a rendering/local-player concept. The landscape still
			// receives regional precipitation even when the player stands under a roof.
			rainShelter: 0,
			precipitationType: state.precipitationType,
			temperatureCelsius: state.temperatureCelsius,
			humidity: state.humidity,
			daylight: state.daylight,
			windStrength: state.windStrength
		};
	}

	get worldTime(): Readonly<WorldTimeSnapshot> {
		return this.environment.currentWorldTime;
	}

	get weather(): WeatherKind {
		return this.environment.currentState.localWeather;
	}

	get lunarPhase(): number {
		return this.environment.currentState.lunarPhase;
	}

	get lunarIllumination(): number {
		return this.environment.currentState.lunarIllumination;
	}

	setQuality(quality: RenderQuality): void {
		this.environment.setQuality(quality);
	}

	serialize(): EnvironmentSaveState {
		return this.environment.serialize();
	}

	restore(save: EnvironmentSaveState | null | undefined): void {
		this.environment.restore(save);
	}

	createDebugApi(): EnvironmentDebugApi {
		return this.environment.createDebugApi();
	}

	dispose(): void {
		this.environment.dispose();
	}
}
