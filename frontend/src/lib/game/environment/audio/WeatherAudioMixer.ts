import { clamp01, smoothstep } from '../EnvironmentMath';
import type { EnvironmentState } from '../EnvironmentState';

export interface WeatherAudioLevels {
	wind: number;
	rain: number;
	storm: number;
	afterRain: number;
	master: number;
}

export function createWeatherAudioLevels(): WeatherAudioLevels {
	return {
		wind: 0,
		rain: 0,
		storm: 0,
		afterRain: 0,
		master: 1
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
		const shelter = clamp01(environment.rainShelter);
		const rain = clamp01(environment.rainVisibleIntensity * (1 - shelter * 0.88));
		const windTarget = clamp01(
			smoothstep(0.05, 0.9, environment.windStrength) *
				(0.7 + environment.windGust * 0.3) *
				(0.65 + (1 - shelter) * 0.35)
		);
		const stormTarget = clamp01(
			environment.lightningProbability * 0.7 + environment.lightningFlash * 0.45
		);

		if (delta > 0) {
			this.rainMemory = damp(this.rainMemory, rain, rain > this.rainMemory ? 3 : 70, delta);
		}
		const afterRainTarget = clamp01(
			this.rainMemory * (1 - smoothstep(0.01, 0.22, rain)) * environment.daylight * 0.7
		);
		const masterTarget = paused ? 0 : 1;

		if (delta <= 0) {
			this.levels.wind = windTarget;
			this.levels.rain = rain;
			this.levels.storm = stormTarget;
			this.levels.afterRain = afterRainTarget;
			this.levels.master = masterTarget;
			return;
		}

		this.levels.wind = damp(this.levels.wind, windTarget, 1.8, delta);
		this.levels.rain = damp(this.levels.rain, rain, rain > this.levels.rain ? 1.2 : 4.5, delta);
		this.levels.storm = damp(this.levels.storm, stormTarget, 2.5, delta);
		this.levels.afterRain = damp(this.levels.afterRain, afterRainTarget, 8, delta);
		this.levels.master = damp(this.levels.master, masterTarget, paused ? 0.2 : 0.8, delta);
	}
}

function damp(current: number, target: number, seconds: number, deltaSeconds: number): number {
	return current + (target - current) * (1 - Math.exp(-deltaSeconds / Math.max(0.001, seconds)));
}

function finitePositive(value: number): number {
	return Number.isFinite(value) && value > 0 ? value : 0;
}
