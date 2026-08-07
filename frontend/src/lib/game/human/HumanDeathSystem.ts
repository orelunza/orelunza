import type { HumanDamageCause } from './HumanConditionState';

/** Brief grace period after respawn while chunks/water/colliders settle. */
export const RESPAWN_PROTECTION_SECONDS = 6;

export function humanDamageCauseLabel(cause: HumanDamageCause | null): string {
	switch (cause) {
		case 'fall':
			return 'Fatal fall';
		case 'drowning':
			return 'Drowned';
		case 'suffocation':
			return 'Suffocated';
		case 'hypothermia':
			return 'Hypothermia';
		case 'hyperthermia':
			return 'Extreme heat';
		case 'starvation':
			return 'Starvation';
		case 'dehydration':
			return 'Dehydration';
		case 'bleeding':
			return 'Blood loss';
		case 'illness':
			return 'Severe illness';
		case 'poisoning':
			return 'Poisoning';
		case 'burn':
			return 'Burns';
		case 'wound':
			return 'Severe wound';
		default:
			return 'Unknown cause';
	}
}
