export type CoastalLandform =
	'open-ocean' | 'shallow-water' | 'beach' | 'rocky-coast' | 'cliff' | 'inland';

export interface CoastalLandformInput {
	land: number;
	elevationMeters: number;
	coastProximity: number;
	slope: number;
}

export interface CoastalLandformSample {
	landform: CoastalLandform;
	beachStrength: number;
	cliffStrength: number;
	foamStrength: number;
}

/** Classifies coast shape from streamed elevation and land-mask gradients. */
export class CoastalLandformResolver {
	resolve(input: Readonly<CoastalLandformInput>): CoastalLandformSample {
		const land = clamp01(input.land);
		const coast = clamp01(input.coastProximity);
		const slope = clamp01(input.slope);
		const shallow = input.elevationMeters > -180;
		const beachStrength = clamp01(coast * (1 - slope * 1.7) * (shallow ? 1 : 0.35));
		const cliffStrength = clamp01(coast * inverseLerp(0.18, 0.72, slope));
		const foamStrength = clamp01(coast * (0.45 + slope * 0.55));

		let landform: CoastalLandform;
		if (land < 0.5) landform = shallow && coast > 0.22 ? 'shallow-water' : 'open-ocean';
		else if (coast < 0.2) landform = 'inland';
		else if (cliffStrength > 0.58) landform = 'cliff';
		else if (beachStrength > 0.48) landform = 'beach';
		else landform = 'rocky-coast';

		return { landform, beachStrength, cliffStrength, foamStrength };
	}
}

function inverseLerp(minimum: number, maximum: number, value: number): number {
	return clamp01((value - minimum) / Math.max(1e-6, maximum - minimum));
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
