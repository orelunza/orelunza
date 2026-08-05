import type { EnvironmentState } from '../EnvironmentState';
import type { ThunderEvent } from '../weather/ThunderEvent';
import { ProceduralAfterRainSource } from './ProceduralAfterRainSource';
import { ProceduralRainSource } from './ProceduralRainSource';
import { ProceduralThunderSource } from './ProceduralThunderSource';
import { ProceduralWindSource } from './ProceduralWindSource';
import { WeatherAudioMixer, type WeatherAudioLevels } from './WeatherAudioMixer';

interface WeatherAudioGraph {
	readonly context: AudioContext;
	readonly master: GainNode;
	readonly wind: ProceduralWindSource;
	readonly rain: ProceduralRainSource;
	readonly afterRain: ProceduralAfterRainSource;
	readonly thunder: ProceduralThunderSource;
}

/** Browser-safe Web Audio owner. It unlocks lazily after the first user gesture. */
export class WeatherAudioController {
	private readonly mixer = new WeatherAudioMixer();
	private readonly seed: number;
	private graph: WeatherAudioGraph | null = null;
	private lastThunderStrikeId = 0;
	private muted = false;
	private paused = false;
	private disposed = false;
	private unlocked = false;

	private readonly handleUserGesture = (): void => {
		void this.enable();
	};

	private readonly handleVisibility = (): void => {
		const context = this.graph?.context;
		if (!context) {
			return;
		}
		if (typeof document !== 'undefined' && document.hidden) {
			void context.suspend();
		} else if (this.unlocked && !this.paused) {
			void context.resume();
		}
	};

	constructor(seed: number) {
		this.seed = seed >>> 0;
		if (typeof document !== 'undefined') {
			document.addEventListener('pointerdown', this.handleUserGesture, { passive: true });
			document.addEventListener('touchstart', this.handleUserGesture, { passive: true });
			document.addEventListener('keydown', this.handleUserGesture);
			document.addEventListener('visibilitychange', this.handleVisibility);
		}
	}

	get isEnabled(): boolean {
		return this.unlocked && this.graph !== null;
	}

	get isMuted(): boolean {
		return this.muted;
	}

	get levels(): Readonly<WeatherAudioLevels> {
		return this.mixer.currentLevels;
	}

	async enable(): Promise<boolean> {
		if (this.disposed) {
			return false;
		}
		const graph = this.graph ?? this.createGraph();
		if (!graph) {
			return false;
		}
		try {
			await graph.context.resume();
			this.unlocked = graph.context.state === 'running';
			if (this.unlocked) {
				this.removeUnlockListeners();
			}
			return this.unlocked;
		} catch {
			return false;
		}
	}

	update(
		deltaSeconds: number,
		environment: Readonly<EnvironmentState>,
		thunder: Readonly<ThunderEvent> | null
	): void {
		if (this.disposed) {
			return;
		}
		this.mixer.update(deltaSeconds, environment, this.paused || this.muted);
		const graph = this.graph;
		if (!graph) {
			return;
		}
		const now = graph.context.currentTime;
		const levels = this.mixer.currentLevels;
		graph.wind.setLevel(levels.wind, now);
		graph.rain.setLevel(levels.rain, now);
		graph.afterRain.setLevel(levels.afterRain, now);
		graph.master.gain.setTargetAtTime(this.muted || this.paused ? 0 : levels.master, now, 0.15);

		if (thunder && thunder.strikeId !== this.lastThunderStrikeId) {
			this.lastThunderStrikeId = thunder.strikeId;
			if (!this.muted && !this.paused && this.unlocked) {
				graph.thunder.play(thunder);
			}
		}
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
	}

	setPaused(paused: boolean): void {
		this.paused = paused;
		const context = this.graph?.context;
		if (!context) {
			return;
		}
		if (paused) {
			void context.suspend();
		} else if (this.unlocked && typeof document !== 'undefined' && !document.hidden) {
			void context.resume();
		}
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.removeUnlockListeners();
		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', this.handleVisibility);
		}
		const graph = this.graph;
		this.graph = null;
		if (!graph) {
			return;
		}
		graph.wind.dispose();
		graph.rain.dispose();
		graph.afterRain.dispose();
		graph.thunder.dispose();
		graph.master.disconnect();
		void graph.context.close();
	}

	private createGraph(): WeatherAudioGraph | null {
		if (typeof window === 'undefined') {
			return null;
		}
		const AudioContextConstructor = window.AudioContext;
		if (!AudioContextConstructor) {
			return null;
		}
		const context = new AudioContextConstructor({ latencyHint: 'interactive' });
		const master = context.createGain();
		master.gain.value = 0;
		master.connect(context.destination);
		const graph: WeatherAudioGraph = {
			context,
			master,
			wind: new ProceduralWindSource(context, master, this.seed ^ 0x57494e44),
			rain: new ProceduralRainSource(context, master, this.seed ^ 0x5241494e),
			afterRain: new ProceduralAfterRainSource(context, master),
			thunder: new ProceduralThunderSource(context, master, this.seed ^ 0x54484e44)
		};
		this.graph = graph;
		return graph;
	}

	private removeUnlockListeners(): void {
		if (typeof document === 'undefined') {
			return;
		}
		document.removeEventListener('pointerdown', this.handleUserGesture);
		document.removeEventListener('touchstart', this.handleUserGesture);
		document.removeEventListener('keydown', this.handleUserGesture);
	}
}
