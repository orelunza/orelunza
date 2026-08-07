import type { HumanInjuryKind, HumanInjurySnapshot } from './HumanConditionState';

export interface HumanInjuryRecoveryInput {
	healingMultiplier: number;
	sleeping: boolean;
}

export interface HumanInjuryStepResult {
	injuries: HumanInjurySnapshot[];
	bleedingRate: number;
	healthDamage: number;
	recoveredCount: number;
}

const HEALING_SECONDS: Record<HumanInjuryKind, number> = {
	'minor-fall': 4 * 60 * 60,
	'severe-fall': 16 * 60 * 60,
	burn: 12 * 60 * 60,
	wound: 8 * 60 * 60
};

export function injuryForFallDamage(damage: number, id: string): HumanInjurySnapshot | null {
	const safeDamage = Math.max(0, finiteOr(damage, 0));
	if (safeDamage < 10) return null;
	const severe = safeDamage >= 32;
	const severity = clamp(severe ? safeDamage / 75 : safeDamage / 45, 0.18, 1);
	return createHumanInjury(severe ? 'severe-fall' : 'minor-fall', severity, id, 'fall');
}

export function createHumanInjury(
	kind: HumanInjuryKind,
	severity: number,
	id: string,
	source: string = kind
): HumanInjurySnapshot {
	const safeSeverity = clamp(finiteOr(severity, 0), 0.05, 1);
	return {
		id,
		kind,
		severity: safeSeverity,
		bleedingRate: initialBleedingRate(kind, safeSeverity),
		healingProgress: 0,
		treated: false,
		source
	};
}

export function stepHumanInjuries(
	current: readonly HumanInjurySnapshot[],
	deltaSeconds: number,
	input: Readonly<HumanInjuryRecoveryInput>
): HumanInjuryStepResult {
	const dt = safeDelta(deltaSeconds);
	if (dt <= 0 || current.length === 0) {
		const injuries = current.map(cloneInjury);
		const bleedingRate = injuries.reduce((sum, injury) => sum + injury.bleedingRate, 0);
		return { injuries, bleedingRate, healthDamage: 0, recoveredCount: 0 };
	}

	const injuries: HumanInjurySnapshot[] = [];
	let bleedingRate = 0;
	let healthDamage = 0;
	let recoveredCount = 0;
	const baseHealingMultiplier = clamp(finiteOr(input.healingMultiplier, 1), 0, 4);
	const sleepMultiplier = input.sleeping ? 1.35 : 1;

	for (const currentInjury of current) {
		const injury = cloneInjury(currentInjury);
		const clotSeconds = injury.treated ? 70 : injury.kind === 'wound' ? 720 : 480;
		if (injury.bleedingRate > 0) {
			injury.bleedingRate *= Math.exp(-dt / clotSeconds);
			if (injury.bleedingRate < 0.00005) injury.bleedingRate = 0;
			bleedingRate += injury.bleedingRate;
			healthDamage += injury.bleedingRate * dt;
		}

		const treatmentMultiplier = injury.treated ? 1.28 : 1;
		const duration = HEALING_SECONDS[injury.kind];
		injury.healingProgress = clamp(
			injury.healingProgress +
				(dt / duration) * baseHealingMultiplier * sleepMultiplier * treatmentMultiplier,
			0,
			1
		);
		// Severity gradually falls during the final half of healing instead of
		// disappearing abruptly at the end.
		if (injury.healingProgress > 0.5) {
			const recovery = (injury.healingProgress - 0.5) * 2;
			injury.severity = clamp(currentInjury.severity * (1 - recovery * 0.75), 0.02, 1);
		}

		if (injury.healingProgress >= 1) {
			recoveredCount += 1;
			continue;
		}
		injuries.push(injury);
	}

	return { injuries, bleedingRate, healthDamage, recoveredCount };
}

/**
 * First aid controls active bleeding and improves later healing. It deliberately
 * does not restore health instantly; food/medicine items can call this API later.
 */
export function applyFirstAid(current: readonly HumanInjurySnapshot[]): {
	injuries: HumanInjurySnapshot[];
	treated: boolean;
} {
	if (current.length === 0) return { injuries: [], treated: false };
	const injuries = current.map(cloneInjury);
	let target: HumanInjurySnapshot | null = null;
	for (const injury of injuries) {
		if (injury.treated) continue;
		if (!target || injury.bleedingRate > target.bleedingRate || injury.severity > target.severity) {
			target = injury;
		}
	}
	if (!target) return { injuries, treated: false };
	target.treated = true;
	target.bleedingRate *= 0.15;
	return { injuries, treated: true };
}

function initialBleedingRate(kind: HumanInjuryKind, severity: number): number {
	switch (kind) {
		case 'wound':
			return 0.002 + severity * 0.013;
		case 'severe-fall':
			return severity >= 0.7 ? severity * 0.0025 : 0;
		default:
			return 0;
	}
}

function cloneInjury(injury: HumanInjurySnapshot): HumanInjurySnapshot {
	return { ...injury };
}

function safeDelta(value: number): number {
	return Number.isFinite(value) && value > 0 ? Math.min(1, value) : 0;
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
