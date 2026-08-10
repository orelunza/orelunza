export type WorldTransitionPhase =
	'idle' | 'focusing' | 'descending' | 'loading' | 'revealing' | 'complete' | 'failed';
export function firstSpawnPhase(
	elapsedMs: number,
	ready: boolean,
	reducedMotion = false
): WorldTransitionPhase {
	if (ready && (reducedMotion || elapsedMs >= 900)) return 'revealing';
	if (elapsedMs < 350 && !reducedMotion) return 'focusing';
	if (elapsedMs < 900 && !reducedMotion) return 'descending';
	return 'loading';
}
