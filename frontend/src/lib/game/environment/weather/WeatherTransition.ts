import { clampWeather01 } from './WeatherMath';
import {
	copyWeatherParameters,
	createWeatherParameters,
	type WeatherParameters
} from './WeatherState';

/** Allocation-free interpolation between two weather presets. */
export class WeatherTransition {
	private readonly from = createWeatherParameters();
	private readonly to = createWeatherParameters();

	setEndpoints(from: Readonly<WeatherParameters>, to: Readonly<WeatherParameters>): void {
		copyWeatherParameters(this.from, from);
		copyWeatherParameters(this.to, to);
	}

	sample(linearProgress: number, target: WeatherParameters): void {
		const progress = clampWeather01(linearProgress);
		const eased = progress * progress * (3 - 2 * progress);

		target.cloudCoverage = lerp(this.from.cloudCoverage, this.to.cloudCoverage, eased);
		target.cloudDensity = lerp(this.from.cloudDensity, this.to.cloudDensity, eased);
		target.cloudDarkness = lerp(this.from.cloudDarkness, this.to.cloudDarkness, eased);
		target.humidity = lerp(this.from.humidity, this.to.humidity, eased);
		target.precipitation = lerp(this.from.precipitation, this.to.precipitation, eased);
		target.fogDensity = lerp(this.from.fogDensity, this.to.fogDensity, eased);
		target.windStrength = lerp(this.from.windStrength, this.to.windStrength, eased);
		target.temperatureOffset = lerp(this.from.temperatureOffset, this.to.temperatureOffset, eased);
		target.lightningProbability = lerp(
			this.from.lightningProbability,
			this.to.lightningProbability,
			eased
		);
		target.overcast = lerp(this.from.overcast, this.to.overcast, eased);
	}
}

function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}
