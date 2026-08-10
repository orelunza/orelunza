import {
	parseCharacterAppearance,
	serializeCharacterAppearance,
	type CharacterAppearanceV1
} from './CharacterAppearance';
import type { WorldLocation } from '../world/geography/WorldLocation';

const DB_NAME = 'orelunza-characters';
const STORE_NAME = 'appearances';
const DB_VERSION = 1;

export class CharacterStore {
	private databasePromise: Promise<IDBDatabase> | null = null;

	async load(playerId: string): Promise<CharacterAppearanceV1 | null> {
		const localValue = localStorage.getItem(storageKey(playerId));

		if (localValue) {
			return parseCharacterAppearance(localValue);
		}

		if (!hasIndexedDb()) {
			return null;
		}

		const database = await this.database();

		return new Promise((resolve, reject) => {
			const transaction = database.transaction(STORE_NAME, 'readonly');
			const request = transaction.objectStore(STORE_NAME).get(playerId);

			request.onerror = () => reject(request.error ?? new Error('Unable to load character.'));
			request.onsuccess = () => {
				const value = request.result;

				resolve(typeof value === 'string' ? parseCharacterAppearance(value) : null);
			};
		});
	}

	async save(playerId: string, appearance: CharacterAppearanceV1): Promise<void> {
		if (!hasIndexedDb()) {
			localStorage.setItem(storageKey(playerId), serializeCharacterAppearance(appearance));
			return;
		}

		const database = await this.database();

		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction(STORE_NAME, 'readwrite');
			const request = transaction
				.objectStore(STORE_NAME)
				.put(serializeCharacterAppearance(appearance), playerId);

			request.onerror = () => reject(request.error ?? new Error('Unable to save character.'));
			transaction.onerror = () =>
				reject(transaction.error ?? new Error('Unable to save character.'));
			transaction.oncomplete = () => resolve();
		});
	}

	loadHome(playerId: string): WorldLocation | null {
		try {
			const raw = localStorage.getItem(`${storageKey(playerId)}:home`);
			return raw ? (JSON.parse(raw) as WorldLocation) : null;
		} catch {
			return null;
		}
	}

	saveHome(playerId: string, location: WorldLocation): void {
		localStorage.setItem(`${storageKey(playerId)}:home`, JSON.stringify(location));
	}

	private database(): Promise<IDBDatabase> {
		this.databasePromise ??= new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => reject(request.error ?? new Error('Unable to open character store.'));
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

function storageKey(playerId: string): string {
	return `orelunza-character:${playerId}`;
}
