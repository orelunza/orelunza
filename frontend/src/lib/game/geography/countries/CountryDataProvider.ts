import type { CountryBoundaryPayload } from './CountryBoundary';

export interface CountryDataProvider {
	load(signal?: AbortSignal): Promise<CountryBoundaryPayload>;
	dispose(): void;
}
