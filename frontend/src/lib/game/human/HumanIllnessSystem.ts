import {
	createHumanIllnessExposureLoads,
	type HumanDamageCause,
	type HumanIllnessExposureLoads,
	type HumanIllnessKind,
	type HumanIllnessSnapshot
} from './HumanConditionState';

export interface HumanIllnessStepResult {
	illnesses: HumanIllnessSnapshot[];
	healthDamage: number;
	damageCause: HumanDamageCause | null;
	hydrationDrain: number;
	nutritionDrain: number;
	fatigueGain: number;
	staminaPenalty: number;
	feverCelsius: number;
	maximumSeverity: number;
	recoveredCount: number;
}

interface IllnessProfile {
	incubationSeconds: number;
	symptomaticSeconds: number;
	recoverySeconds: number;
	hydrationPerSecond: number;
	nutritionPerSecond: number;
	fatiguePerSecond: number;
	feverCelsius: number;
	healthDamagePerSecond: number;
	damageCause: HumanDamageCause;
}

const PROFILES: Record<HumanIllnessKind, IllnessProfile> = {
	'food-poisoning': {
		incubationSeconds: 10 * 60,
		symptomaticSeconds: 45 * 60,
		recoverySeconds: 35 * 60,
		hydrationPerSecond: 0.0022,
		nutritionPerSecond: 0.0012,
		fatiguePerSecond: 0.0016,
		feverCelsius: 0.65,
		healthDamagePerSecond: 0.005,
		damageCause: 'poisoning'
	},
	'waterborne-illness': {
		incubationSeconds: 20 * 60,
		symptomaticSeconds: 90 * 60,
		recoverySeconds: 60 * 60,
		hydrationPerSecond: 0.0028,
		nutritionPerSecond: 0.0008,
		fatiguePerSecond: 0.0018,
		feverCelsius: 1.05,
		healthDamagePerSecond: 0.004,
		damageCause: 'illness'
	},
	infection: {
		incubationSeconds: 30 * 60,
		symptomaticSeconds: 3 * 60 * 60,
		recoverySeconds: 2 * 60 * 60,
		hydrationPerSecond: 0.001,
		nutritionPerSecond: 0.0008,
		fatiguePerSecond: 0.0022,
		feverCelsius: 1.55,
		healthDamagePerSecond: 0.007,
		damageCause: 'illness'
	}
};

const EXPOSURE_THRESHOLD = 1;

/**
 * Converts repeated exposure into a deterministic accumulated risk. A single
 * contact is not automatically a disease: systems can feed small doses over
 * time, and an illness starts only when the accumulated load crosses 1.
 */
export function addIllnessExposure(
	current: Readonly<HumanIllnessExposureLoads>,
	kind: HumanIllnessKind,
	dose: number
): { loads: HumanIllnessExposureLoads; triggeredSeverity: number | null } {
	const loads = sanitizeLoads(current);
	const safeDose = Math.max(0, finiteOr(dose, 0));
	if (safeDose <= 0) return { loads, triggeredSeverity: null };
	const total = clamp(loads[kind] + safeDose, 0, 4);
	if (total < EXPOSURE_THRESHOLD) {
		loads[kind] = total;
		return { loads, triggeredSeverity: null };
	}
	loads[kind] = Math.max(0, total - EXPOSURE_THRESHOLD);
	return {
		loads,
		triggeredSeverity: clamp(0.35 + Math.max(0, total - 1) * 0.3, 0.25, 1)
	};
}

export function createHumanIllness(
	kind: HumanIllnessKind,
	severity: number,
	id: string,
	source: string = kind
): HumanIllnessSnapshot {
	return {
		id,
		kind,
		stage: 'incubating',
		severity: clamp(finiteOr(severity, 0.35), 0.15, 1),
		stageProgress: 0,
		treated: false,
		source
	};
}

export function stepHumanIllnesses(
	current: readonly HumanIllnessSnapshot[],
	deltaSeconds: number,
	recoveryMultiplier: number
): HumanIllnessStepResult {
	const dt = safeDelta(deltaSeconds);
	const illnesses: HumanIllnessSnapshot[] = [];
	let healthDamage = 0;
	let damageCause: HumanDamageCause | null = null;
	let hydrationDrain = 0;
	let nutritionDrain = 0;
	let fatigueGain = 0;
	let staminaPenalty = 0;
	let feverCelsius = 0;
	let maximumSeverity = 0;
	let recoveredCount = 0;
	const safeRecovery = clamp(finiteOr(recoveryMultiplier, 1), 0.15, 3);

	for (const currentIllness of current) {
		const illness = { ...currentIllness };
		const profile = PROFILES[illness.kind];
		const visibleSeverity =
			illness.stage === 'recovering'
				? illness.severity * (1 - clamp(illness.stageProgress, 0, 1) * 0.82)
				: illness.severity;

		if (illness.stage === 'symptomatic') {
			maximumSeverity = Math.max(maximumSeverity, visibleSeverity);
			hydrationDrain += profile.hydrationPerSecond * visibleSeverity * dt;
			nutritionDrain += profile.nutritionPerSecond * visibleSeverity * dt;
			fatigueGain += profile.fatiguePerSecond * visibleSeverity * dt;
			staminaPenalty = Math.max(staminaPenalty, visibleSeverity * 24);
			feverCelsius = Math.max(feverCelsius, profile.feverCelsius * visibleSeverity);
			const dangerousSeverity = Math.max(0, visibleSeverity - 0.55) / 0.45;
			if (dangerousSeverity > 0) {
				const damage = profile.healthDamagePerSecond * dangerousSeverity * dt;
				healthDamage += damage;
				if (damage > 0) damageCause = profile.damageCause;
			}
		} else if (illness.stage === 'recovering') {
			maximumSeverity = Math.max(maximumSeverity, visibleSeverity * 0.6);
			staminaPenalty = Math.max(staminaPenalty, visibleSeverity * 8);
			feverCelsius = Math.max(feverCelsius, profile.feverCelsius * visibleSeverity * 0.25);
		}

		advanceIllness(illness, dt, profile, safeRecovery);
		if (illness.stage === 'recovering' && illness.stageProgress >= 1) {
			recoveredCount += 1;
			continue;
		}
		illnesses.push(illness);
	}

	return {
		illnesses,
		healthDamage,
		damageCause,
		hydrationDrain,
		nutritionDrain,
		fatigueGain,
		staminaPenalty,
		feverCelsius,
		maximumSeverity,
		recoveredCount
	};
}

export function treatIllnesses(
	current: readonly HumanIllnessSnapshot[],
	kind?: HumanIllnessKind
): { illnesses: HumanIllnessSnapshot[]; treated: boolean } {
	let treated = false;
	const illnesses = current.map((illness) => {
		if (treated || illness.treated || (kind !== undefined && illness.kind !== kind)) {
			return { ...illness };
		}
		treated = true;
		return { ...illness, treated: true };
	});
	return { illnesses, treated };
}

function advanceIllness(
	illness: HumanIllnessSnapshot,
	deltaSeconds: number,
	profile: IllnessProfile,
	recoveryMultiplier: number
): void {
	let dt = deltaSeconds;
	let guard = 0;
	while (dt > 0 && guard < 3) {
		guard += 1;
		const duration =
			illness.stage === 'incubating'
				? profile.incubationSeconds
				: illness.stage === 'symptomatic'
					? profile.symptomaticSeconds
					: profile.recoverySeconds;
		const stageSpeed =
			illness.stage === 'recovering'
				? recoveryMultiplier * (illness.treated ? 1.35 : 1)
				: illness.stage === 'symptomatic' && illness.treated
					? 1.2
					: 1;
		const remainingFraction = 1 - clamp(illness.stageProgress, 0, 1);
		const secondsToBoundary = (remainingFraction * duration) / Math.max(0.01, stageSpeed);
		if (dt < secondsToBoundary) {
			illness.stageProgress = clamp(illness.stageProgress + (dt / duration) * stageSpeed, 0, 1);
			return;
		}
		dt -= secondsToBoundary;
		if (illness.stage === 'incubating') {
			illness.stage = 'symptomatic';
			illness.stageProgress = 0;
		} else if (illness.stage === 'symptomatic') {
			illness.stage = 'recovering';
			illness.stageProgress = 0;
		} else {
			illness.stageProgress = 1;
			return;
		}
	}
}

function sanitizeLoads(current: Readonly<HumanIllnessExposureLoads>): HumanIllnessExposureLoads {
	const empty = createHumanIllnessExposureLoads();
	return {
		'food-poisoning': clamp(finiteOr(current['food-poisoning'], empty['food-poisoning']), 0, 4),
		'waterborne-illness': clamp(
			finiteOr(current['waterborne-illness'], empty['waterborne-illness']),
			0,
			4
		),
		infection: clamp(finiteOr(current.infection, empty.infection), 0, 4)
	};
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
