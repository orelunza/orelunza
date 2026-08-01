import type { BlockType } from '../world/voxel-types';

export interface ItemStack {
	type: BlockType;
	quantity: number;
}

export interface InventorySlot {
	stack: ItemStack | null;
}

export interface InventorySnapshot {
	slots: InventorySlot[];
	hotbar: InventorySlot[];
}

const INITIAL_HOTBAR: BlockType[] = [
	'wooden_plank',
	'brick',
	'glass',
	'dirt',
	'stone',
	'wood',
	'leaves',
	'sand',
	'flower'
];

export class Inventory {
	private readonly slots: InventorySlot[];

	constructor(slotCount = 27) {
		this.slots = Array.from({ length: slotCount }, () => ({ stack: null }));

		INITIAL_HOTBAR.forEach((type, index) => {
			this.slots[index] = {
				stack: {
					type,
					quantity: 32
				}
			};
		});
	}

	get hotbarSlots(): InventorySlot[] {
		return this.slots.slice(0, 9).map(cloneSlot);
	}

	get allSlots(): InventorySlot[] {
		return this.slots.map(cloneSlot);
	}

	getSelectedStack(index: number): ItemStack | null {
		return cloneStack(this.slots[index]?.stack ?? null);
	}

	addItem(type: BlockType, quantity = 1): boolean {
		if (type === 'air' || quantity <= 0) {
			return false;
		}

		const existing = this.slots.find((slot) => slot.stack?.type === type);

		if (existing?.stack) {
			existing.stack.quantity += quantity;
			return true;
		}

		const empty = this.slots.find((slot) => slot.stack === null);

		if (!empty) {
			return false;
		}

		empty.stack = { type, quantity };

		return true;
	}

	removeItem(type: BlockType, quantity = 1): boolean {
		const slot = this.slots.find((candidate) => candidate.stack?.type === type);

		if (!slot?.stack || slot.stack.quantity < quantity) {
			return false;
		}

		slot.stack.quantity -= quantity;

		if (slot.stack.quantity <= 0) {
			slot.stack = null;
		}

		return true;
	}

	load(snapshot: InventorySnapshot | null): void {
		if (!snapshot) {
			return;
		}

		for (let index = 0; index < this.slots.length; index += 1) {
			this.slots[index] = cloneSlot(snapshot.slots[index] ?? { stack: null });
		}
	}

	snapshot(): InventorySnapshot {
		return {
			slots: this.allSlots,
			hotbar: this.hotbarSlots
		};
	}
}

function cloneStack(stack: ItemStack | null): ItemStack | null {
	return stack ? { ...stack } : null;
}

function cloneSlot(slot: InventorySlot): InventorySlot {
	return {
		stack: cloneStack(slot.stack)
	};
}
