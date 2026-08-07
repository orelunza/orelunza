import { NORMAL_BODY_TEMPERATURE_CELSIUS } from './HumanConditionState';

export interface HumanThermoregulationInput {
	ambientTemperatureCelsius: number;
	windChillCelsius: number;
	rainIntensity: number;
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
	let wetness = clamp01(current.wetness);
	if (input.immersed) {
		wetness = Math.min(1, wetness + 1.5 * dt);
	} else {
		wetness = Math.min(1, wetness + clamp01(input.rainIntensity) * 0.035 * dt);
		wetness = Math.max(0, wetness - 0.006 * dt);
	}

	const ambient = finiteOr(input.ambientTemperatureCelsius, 20);
	const windChill = finiteOr(input.windChillCelsius, ambient);
	const effectiveAmbient = Math.min(ambient, windChill);
	const coldExposure = Math.max(0, 12 - effectiveAmbient) / 32;
	const heatExposure = Math.max(0, ambient - 30) / 25;
	const wetColdAmplifier = 1 + wetness * 1.7;
	const target =
		NORMAL_BODY_TEMPERATURE_CELSIUS -
		Math.min(4.2, coldExposure * 3.2 * wetColdAmplifier) +
		Math.min(3.5, heatExposure * 2.7);
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
