export type RenderQuality = 'low' | 'medium' | 'high';

export interface QualitySettings {
	quality: RenderQuality;
	pixelRatio: number;
	shadows: boolean;
	chunkRadius: number;
	vegetationDensity: number;
}

export function resolveQualitySettings(quality: RenderQuality = 'medium'): QualitySettings {
	const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;

	if (quality === 'low') {
		return {
			quality,
			pixelRatio: 1,
			shadows: false,
			chunkRadius: 2,
			vegetationDensity: 0.55
		};
	}

	if (quality === 'high') {
		return {
			quality,
			pixelRatio: Math.min(devicePixelRatio, 2),
			shadows: true,
			chunkRadius: 4,
			vegetationDensity: 1
		};
	}

	return {
		quality,
		pixelRatio: Math.min(devicePixelRatio, 1.5),
		shadows: true,
		chunkRadius: 3,
		vegetationDensity: 0.78
	};
}
