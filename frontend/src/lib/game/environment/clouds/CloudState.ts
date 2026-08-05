/** Serializable visual drift for procedural cloud layers. */
export interface CloudSaveState {
	windOffsetX: number;
	windOffsetZ: number;
}

/** Continuous cloud values derived from weather and unified wind. */
export interface CloudFrameState {
	coverage: number;
	density: number;
	darkness: number;
	opacity: number;
	sunOcclusion: number;
	moonOcclusion: number;
	shadowStrength: number;
	windOffsetX: number;
	windOffsetZ: number;
}

export function createCloudFrameState(): CloudFrameState {
	return {
		coverage: 0,
		density: 0,
		darkness: 0,
		opacity: 0,
		sunOcclusion: 0,
		moonOcclusion: 0,
		shadowStrength: 0,
		windOffsetX: 0,
		windOffsetZ: 0
	};
}
