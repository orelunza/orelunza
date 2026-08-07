import { NORMAL_BODY_TEMPERATURE_CELSIUS } from './HumanConditionState';

export interface HumanThermoregulationInput {
	ambientTemperatureCelsius: number;
	windChillCelsius: number;
	rainIntensity: number;
	snowIntensity: number;
	skyExposure: number;
	windExposure: number;
	precipitationExposure: number;
	nearbyHeatCelsius: number;
	daylight: number;
	humidity: number;
	activityIntensity: number;
	immersed: boolean;
}

export interface HumanThermoregulationResult {
	bodyTemperatureCelsius: number;
	wetness: number;
	coldDamage: number;
	heatDamage: number;
}

export function stepThermoregulation(
	current: Readonly<{ bodyTemperatureCelsius: number; wetness: number }>,
	deltaSeconds: number,
	input: Readonly<HumanThermoregulationInput>
): HumanThermoregulationResult {
	const dt = safeDelta(deltaSeconds);
	const skyExposure = clamp01(input.skyExposure);
	const windExposure = clamp01(input.windExposure);
	const precipitationExposure = clamp01(input.precipitationExposure);
	const rain = clamp01(input.rainIntensity) * precipitationExposure;
	const snow = clamp01(input.snowIntensity) * precipitationExposure;
	let wetness = clamp01(current.wetness);

	if (input.immersed) {
		wetness = Math.min(1, wetness + 1.5 * dt);
	} else {
		wetness = Math.min(1, wetness + rain * 0.035 * dt + snow * 0.01 * dt);
		const ambient = finiteOr(input.ambientTemperatureCelsius, 20);
		const warmAir = clamp01((ambient - 8) / 24);
		const sunDrying = clamp01(input.daylight) * skyExposure * 0.0045;
		const airDrying = (0.0025 + warmAir * 0.0045) * (0.45 + windExposure * 0.55);
		const heatDrying = clamp01(finiteOr(input.nearbyHeatCelsius, 0) / 12) * 0.018;
		const humidityPenalty = 1 - clamp01(input.humidity) * 0.58;
		wetness = Math.max(0, wetness - (airDrying + sunDrying + heatDrying) * humidityPenalty * dt);
	}

	const ambient = finiteOr(input.ambientTemperatureCelsius, 20);
	const rawWindChill = finiteOr(input.windChillCelsius, ambient);
	const effectiveWindChill = ambient + (rawWindChill - ambient) * windExposure;
	const effectiveAmbient = Math.min(ambient, effectiveWindChill);
	const coldExposure = Math.max(0, 12 - effectiveAmbient) / 32;
	const heatExposure = Math.max(0, ambient - 30) / 25;
	const wetColdAmplifier = 1 + wetness * 1.7;
	const activityWarmth = clamp01(input.activityIntensity) * 0.5;
	const nearbyHeat = Math.min(6, Math.max(0, finiteOr(input.nearbyHeatCelsius, 0)));
	const target =
		NORMAL_BODY_TEMPERATURE_CELSIUS -
		Math.min(4.2, coldExposure * 3.2 * wetColdAmplifier) +
		Math.min(3.5, heatExposure * 2.7) +
		activityWarmth +
		nearbyHeat * 0.18;
	const response = 1 - Math.exp(-0.012 * dt);
	const bodyTemperatureCelsius = clamp(
		finiteOr(current.bodyTemperatureCelsius, NORMAL_BODY_TEMPERATURE_CELSIUS) +
			(target - finiteOr(current.bodyTemperatureCelsius, NORMAL_BODY_TEMPERATURE_CELSIUS)) *
				response,
		30,
		43
	);

	return {
		bodyTemperatureCelsius,
		wetness,
		coldDamage: bodyTemperatureCelsius < 34 ? (34 - bodyTemperatureCelsius) * 0.6 * dt : 0,
		heatDamage: bodyTemperatureCelsius > 40.5 ? (bodyTemperatureCelsius - 40.5) * 0.8 * dt : 0
	};
}

function safeDelta(value: number): number {
	return Number.isFinite(value) && value > 0 ? Math.min(0.25, value) : 0;
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
