import { parseWorldSave, serializeWorldSave, type WorldSave } from '../world/WorldSave';

const DB_NAME = 'orelunza-game-worlds';
const STORE_NAME = 'world-saves';
const DB_VERSION = 1;

export class IndexedDbWorldStore {
	private databasePromise: Promise<IDBDatabase> | null = null;

	async load(worldId: string): Promise<WorldSave | null> {
		if (!hasIndexedDb()) {
			return loadFromLocalStorage(worldId);
		}

		const database = await this.database();

		return new Promise((resolve, reject) => {
			const transaction = database.transaction(STORE_NAME, 'readonly');
			const request = transaction.objectStore(STORE_NAME).get(worldId);

			request.onerror = () => reject(request.error ?? new Error('Unable to load world save.'));
			request.onsuccess = () => {
				const value = request.result;

				if (typeof value === 'string') {
					resolve(parseWorldSave(value));
				} else {
					resolve(null);
				}
			};
		});
	}

	async save(save: WorldSave): Promise<void> {
		if (!hasIndexedDb()) {
			saveToLocalStorage(save);
			return;
		}

		const database = await this.database();

		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction(STORE_NAME, 'readwrite');
			const request = transaction
				.objectStore(STORE_NAME)
				.put(serializeWorldSave(save), save.worldId);

			request.onerror = () => reject(request.error ?? new Error('Unable to save world.'));
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save world.'));
		});
	}

	private database(): Promise<IDBDatabase> {
		this.databasePromise ??= new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
			request.onupgradeneeded = () => {
				const database = request.result;

				if (!database.objectStoreNames.contains(STORE_NAME)) {
					database.createObjectStore(STORE_NAME);
				}
			};
			request.onsuccess = () => resolve(request.result);
		});

		return this.databasePromise;
	}
}

function hasIndexedDb(): boolean {
	return typeof indexedDB !== 'undefined';
}

function localStorageKey(worldId: string): string {
	return `orelunza-world-save:${worldId}`;
}

function loadFromLocalStorage(worldId: string): WorldSave | null {
	const value = localStorage.getItem(localStorageKey(worldId));

	return value ? parseWorldSave(value) : null;
}

function saveToLocalStorage(save: WorldSave): void {
	localStorage.setItem(localStorageKey(save.worldId), serializeWorldSave(save));
}
