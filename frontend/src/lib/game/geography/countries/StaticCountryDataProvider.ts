import { validateCountryBoundaryPayload, type CountryBoundaryPayload } from './CountryBoundary';
import type { CountryDataProvider } from './CountryDataProvider';

export class StaticCountryDataProvider implements CountryDataProvider {
	private disposed = false;

	constructor(private readonly url = '/planet-data/preview/countries-110m.json') {}

	async load(signal?: AbortSignal): Promise<CountryBoundaryPayload> {
		this.assertUsable();
		const response = await fetch(this.url, { signal });
		if (!response.ok) {
			throw new Error(`Unable to load country boundaries (${response.status}).`);
		}
		return validateCountryBoundaryPayload(await response.json());
	}

	dispose(): void {
		this.disposed = true;
	}

	private assertUsable(): void {
		if (this.disposed) {
			throw new Error('Country data provider has been disposed.');
		}
	}
}
