import { MAXIMUM_OXYGEN } from './HumanConditionState';

export interface HumanRespirationInput {
	underwater: boolean;
	headObstructed: boolean;
}

export interface HumanRespirationResult {
	oxygen: number;
	healthDamage: number;
	cause: 'drowning' | 'suffocation' | null;
}

const UNDERWATER_DRAIN_PER_SECOND = 5;
const SUFFOCATION_DRAIN_PER_SECOND = 8;
const RECOVERY_PER_SECOND = 22;
const ASPHYXIATION_DAMAGE_PER_SECOND = 7;

export function stepRespiration(
	oxygen: number,
	deltaSeconds: number,
	input: Readonly<HumanRespirationInput>
): HumanRespirationResult {
	const dt = safeDelta(deltaSeconds);
	const current = clamp(oxygen, 0, MAXIMUM_OXYGEN);
	const restricted = input.underwater || input.headObstructed;
	if (!restricted) {
		return {
			oxygen: Math.min(MAXIMUM_OXYGEN, current + RECOVERY_PER_SECOND * dt),
			healthDamage: 0,
			cause: null
		};
	}

	const drain = input.headObstructed ? SUFFOCATION_DRAIN_PER_SECOND : UNDERWATER_DRAIN_PER_SECOND;
	const next = Math.max(0, current - drain * dt);
	return {
		oxygen: next,
		healthDamage: next <= 0 ? ASPHYXIATION_DAMAGE_PER_SECOND * dt : 0,
		cause: next <= 0 ? (input.headObstructed ? 'suffocation' : 'drowning') : null
	};
}

function safeDelta(value: number): number {
	return Number.isFinite(value) && value > 0 ? value : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}
