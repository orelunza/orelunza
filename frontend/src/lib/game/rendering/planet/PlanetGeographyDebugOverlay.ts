import type { PlanetGeographyDiagnostics } from '../../planet/PlanetGeographySystem';

export class PlanetGeographyDebugOverlay {
	private snapshot: PlanetGeographyDiagnostics | null = null;

	update(diagnostics: Readonly<PlanetGeographyDiagnostics>): void {
		this.snapshot = { ...diagnostics };
	}

	get diagnostics(): PlanetGeographyDiagnostics | null {
		return this.snapshot ? { ...this.snapshot } : null;
	}

	dispose(): void {
		this.snapshot = null;
	}
}
