/** Persistent set of generated vegetation instances removed by the player. */
export class VegetationRemovalState {
	private readonly ids = new Set<string>();

	get size(): number {
		return this.ids.size;
	}

	has(instanceId: string): boolean {
		return this.ids.has(instanceId);
	}

	markRemoved(instanceId: string): boolean {
		const normalized = normalizeId(instanceId);

		if (!normalized || this.ids.has(normalized)) {
			return false;
		}

		this.ids.add(normalized);
		return true;
	}

	restore(instanceIds: readonly string[] | null | undefined): void {
		this.ids.clear();

		for (const instanceId of instanceIds ?? []) {
			const normalized = normalizeId(instanceId);

			if (normalized) {
				this.ids.add(normalized);
			}
		}
	}

	serialize(): string[] {
		return Array.from(this.ids).sort();
	}
}

function normalizeId(value: string): string {
	return typeof value === 'string' ? value.trim() : '';
}
