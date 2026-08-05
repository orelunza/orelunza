import type { ThunderEvent } from './ThunderEvent';

export interface LightningSaveState {
	elapsedSeconds: number;
	nextCheckAtSeconds: number;
	strikeIndex: number;
	activeStrikeId: number;
	activeStrikeStartedAt: number;
	activeStrikeDuration: number;
	bearingRadians: number;
	distanceMeters: number;
	intensity: number;
	paused: boolean;
	pendingThunder?: ThunderEvent | null;
}

export interface LightningFrameState {
	elapsedSeconds: number;
	strikeId: number;
	flashIntensity: number;
	boltVisibility: number;
	bearingRadians: number;
	distanceMeters: number;
	intensity: number;
	paused: boolean;
	lastThunder: ThunderEvent | null;
}

export function createLightningFrameState(): LightningFrameState {
	return {
		elapsedSeconds: 0,
		strikeId: 0,
		flashIntensity: 0,
		boltVisibility: 0,
		bearingRadians: 0,
		distanceMeters: 0,
		intensity: 0,
		paused: false,
		lastThunder: null
	};
}
