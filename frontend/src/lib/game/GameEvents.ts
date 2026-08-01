import type { GameSnapshot } from './game-types';

export type GameEvent =
	| { type: 'snapshot'; snapshot: GameSnapshot }
	| { type: 'message'; message: string }
	| { type: 'error'; error: Error };

export type GameEventListener = (event: GameEvent) => void;
