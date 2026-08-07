import { clamp01, smoothstep } from '../EnvironmentMath';
import type { EnvironmentState } from '../EnvironmentState';

export interface WeatherAudioLevels {
	wind: number;
	rain: number;
	storm: number;
	afterRain: number;
	master: number;
	/** 0 outside, 1 deeply enclosed; controller maps this to a low-pass filter. */
	occlusion: number;
}

export function createWeatherAudioLevels(): WeatherAudioLevels {
	return {
		wind: 0,
		rain: 0,
		storm: 0,
		afterRain: 0,
		master: 1,
		occlusion: 0
	};
}

/** Pure mapping from the current environment snapshot to audio mix targets. */
export class WeatherAudioMixer {
	private rainMemory = 0;
	private readonly levels = createWeatherAudioLevels();

	get currentLevels(): Readonly<WeatherAudioLevels> {
		return this.levels;
	}

	update(deltaSeconds: number, environment: Readonly<EnvironmentState>, paused: boolean): void {
		const delta = finitePositive(deltaSeconds);
		const openness = clamp01(environment.environmentOpenness);
		const interior = 1 - openness;
		// Rain remains audible indoors, but as a distant/muffled roof sound rather
		// than the same close exterior source.
		const rain = clamp01(environment.rainIntensity * (0.18 + openness * 0.82));
		const windTarget = clamp01(
			smoothstep(0.05, 0.9, environment.windStrength) *
				(0.7 + environment.windGust * 0.3) *
				(0.1 + openness * 0.9)
		);
		const stormTarget = clamp01(
			(environment.lightningProbability * 0.7 + environment.lightningFlash * 0.45) *
				(0.38 + openness * 0.62)
		);

		if (delta > 0) {
			this.rainMemory = damp(this.rainMemory, rain, rain > this.rainMemory ? 3 : 70, delta);
		}
		const afterRainTarget = clamp01(
			this.rainMemory *
				(1 - smoothstep(0.01, 0.22, rain)) *
				environment.daylight *
				0.7 *
				(0.25 + openness * 0.75)
		);
		const masterTarget = paused ? 0 : 1;

		if (delta <= 0) {
			this.levels.wind = windTarget;
			this.levels.rain = rain;
			this.levels.storm = stormTarget;
			this.levels.afterRain = afterRainTarget;
			this.levels.master = masterTarget;
			this.levels.occlusion = interior;
			return;
		}

		this.levels.wind = damp(this.levels.wind, windTarget, 1.8, delta);
		this.levels.rain = damp(this.levels.rain, rain, rain > this.levels.rain ? 1.2 : 4.5, delta);
		this.levels.storm = damp(this.levels.storm, stormTarget, 2.5, delta);
		this.levels.afterRain = damp(this.levels.afterRain, afterRainTarget, 8, delta);
		this.levels.master = damp(this.levels.master, masterTarget, paused ? 0.2 : 0.8, delta);
		this.levels.occlusion = damp(this.levels.occlusion, interior, 0.35, delta);
	}
}

function damp(current: number, target: number, seconds: number, deltaSeconds: number): number {
	return current + (target - current) * (1 - Math.exp(-deltaSeconds / Math.max(0.001, seconds)));
}

function finitePositive(value: number): number {
	return Number.isFinite(value) && value > 0 ? value : 0;
}
