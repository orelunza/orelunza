<script lang="ts">
	import { resolve } from '$app/paths';

	interface Props {
		onResume?: () => void;
		onSave?: () => void | Promise<void>;
		onLogout?: () => void | Promise<void>;
	}

	let { onResume, onSave, onLogout }: Props = $props();
</script>

<div
	class="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/42 px-4 backdrop-blur-[2px]"
	role="dialog"
	aria-label="Pause menu"
	aria-modal="true"
>
	<div
		class="w-[min(22rem,calc(100vw-2rem))] rounded-md border border-white/12 bg-[#1a1e22]/90 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
	>
		<h2 class="m-0 mb-4 text-xl font-semibold">Orelunza</h2>

		<div class="grid gap-2">
			<button class="game-menu-button" type="button" onclick={onResume}>Resume</button>
			<button class="game-menu-button" type="button" onclick={onSave}>Save</button>
			<a class="game-menu-button" href={resolve('/profile')}>Profile</a>
			<button class="game-menu-button" type="button" disabled>Settings</button>
			<button class="game-menu-button danger" type="button" onclick={onLogout}>Logout</button>
		</div>
	</div>
</div>

<style>
	.game-menu-button {
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 0.25rem;
		background: rgb(255 255 255 / 0.06);
		padding: 0.7rem 0.9rem;
		text-align: left;
		color: rgb(255 255 255 / 0.86);
		text-decoration: none;
	}

	.game-menu-button:hover {
		background: rgb(249 115 22 / 0.16);
		border-color: rgb(249 115 22 / 0.34);
	}

	.game-menu-button:disabled {
		opacity: 0.45;
	}

	.game-menu-button.danger {
		color: rgb(255 196 174);
	}
</style>
