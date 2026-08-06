export type PlanetDataQuality = 'preview' | 'production';

export interface PlanetDataSourceAttribution {
	name: string;
	role: string;
	license: string;
	url: string;
}

export interface PlanetDataManifest {
	format: 'orelunza-geography-pack';
	version: 1;
	planetId: string;
	dataQuality: PlanetDataQuality;
	tileResolution: number;
	minimumLevel: number;
	maximumLevel: number;
	tileExtension: string;
	elevationEncoding: 'int16-meters';
	maskEncoding: 'uint8-land-255-ocean-0';
	minimumElevationMeters: number;
	maximumElevationMeters: number;
	sources: PlanetDataSourceAttribution[];
	coastlinePath: string;
	countriesIndexPath: string;
	tilePathTemplate: string;
	generatedSampleCount?: number;
	landSampleFraction?: number;
	note?: string;
}

export function validatePlanetDataManifest(value: unknown): PlanetDataManifest {
	if (!isRecord(value) || value.format !== 'orelunza-geography-pack' || value.version !== 1) {
		throw new TypeError('Unsupported Orelunza geography manifest.');
	}

	const manifest = value as unknown as PlanetDataManifest;
	if (
		!Number.isInteger(manifest.tileResolution) ||
		manifest.tileResolution < 2 ||
		manifest.tileResolution > 257 ||
		!Number.isInteger(manifest.minimumLevel) ||
		!Number.isInteger(manifest.maximumLevel) ||
		manifest.minimumLevel < 0 ||
		manifest.maximumLevel < manifest.minimumLevel ||
		manifest.maximumLevel > 24 ||
		!Number.isFinite(manifest.minimumElevationMeters) ||
		!Number.isFinite(manifest.maximumElevationMeters) ||
		manifest.minimumElevationMeters > manifest.maximumElevationMeters ||
		typeof manifest.tilePathTemplate !== 'string' ||
		!manifest.tilePathTemplate.includes('{face}') ||
		!manifest.tilePathTemplate.includes('{level}') ||
		!manifest.tilePathTemplate.includes('{x}') ||
		!manifest.tilePathTemplate.includes('{y}') ||
		!Array.isArray(manifest.sources)
	) {
		throw new TypeError('Invalid Orelunza geography manifest values.');
	}

	return manifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
