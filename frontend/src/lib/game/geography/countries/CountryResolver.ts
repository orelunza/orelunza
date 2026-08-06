import type { GeodeticCoordinate } from '../../planet/GeodeticCoordinate';
import { CountryBoundaryIndex } from './CountryBoundaryIndex';
import { countrySummary, type CountryBoundary, type CountrySummary } from './CountryBoundary';
import type { CountryDataProvider } from './CountryDataProvider';
import { StaticCountryDataProvider } from './StaticCountryDataProvider';

export interface CountryResolverDiagnostics {
	ready: boolean;
	countryCount: number;
	queries: number;
}

export class CountryResolver {
	private index: CountryBoundaryIndex | null = null;
	private initializePromise: Promise<CountryBoundaryIndex> | null = null;
	private queries = 0;
	private disposed = false;

	constructor(private readonly provider: CountryDataProvider = new StaticCountryDataProvider()) {}

	get diagnostics(): CountryResolverDiagnostics {
		return {
			ready: this.index !== null,
			countryCount: this.index?.countries.length ?? 0,
			queries: this.queries
		};
	}

	async initialize(signal?: AbortSignal): Promise<CountryBoundaryIndex> {
		this.assertUsable();
		if (!this.initializePromise) {
			this.initializePromise = this.provider.load(signal).then((payload) => {
				this.index = new CountryBoundaryIndex(payload.countries);
				return this.index;
			});
		}
		return this.initializePromise;
	}

	async resolve(
		coordinate: Readonly<GeodeticCoordinate>,
		signal?: AbortSignal
	): Promise<CountrySummary | null> {
		const index = await this.initialize(signal);
		this.queries += 1;
		const country = index.resolve(
			(coordinate.latitudeRadians * 180) / Math.PI,
			(coordinate.longitudeRadians * 180) / Math.PI
		);
		return country ? countrySummary(country) : null;
	}

	async boundary(id: string, signal?: AbortSignal): Promise<CountryBoundary | null> {
		return (await this.initialize(signal)).get(id);
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.index = null;
		this.provider.dispose();
	}

	private assertUsable(): void {
		if (this.disposed) throw new Error('Country resolver has been disposed.');
	}
}
