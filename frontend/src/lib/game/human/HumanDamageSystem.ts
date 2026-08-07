import type { HumanDamageCause } from './HumanConditionState';

export interface HumanDamageEvent {
	cause: HumanDamageCause;
	amount: number;
}

const SAFE_FALL_IMPACT_SPEED = 10.5;
const LETHAL_FALL_DAMAGE = 100;

/**
 * Converts vertical impact speed into damage. The threshold is deliberately
 * forgiving: normal jumps and one-block drops never hurt the player.
 */
export function fallDamageForImpactSpeed(impactSpeed: number): number {
	const speed = Math.max(0, Number.isFinite(impactSpeed) ? impactSpeed : 0);
	if (speed <= SAFE_FALL_IMPACT_SPEED) return 0;
	const excess = speed - SAFE_FALL_IMPACT_SPEED;
	return Math.min(LETHAL_FALL_DAMAGE, excess * excess * 0.55);
}
