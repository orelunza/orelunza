export class Hotbar {
	private selected = 0;

	get selectedIndex(): number {
		return this.selected;
	}

	select(index: number): number {
		this.selected = Math.max(0, Math.min(8, Math.floor(index)));

		return this.selected;
	}

	next(delta: number): number {
		const direction = delta > 0 ? 1 : -1;
		this.selected = (this.selected + direction + 9) % 9;

		return this.selected;
	}
}
