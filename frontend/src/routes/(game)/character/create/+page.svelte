<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	import CharacterColorPicker from '$lib/components/game/CharacterColorPicker.svelte';
	import CharacterPreview from '$lib/components/game/CharacterPreview.svelte';
	import LoadingWorld from '$lib/components/game/LoadingWorld.svelte';
	import {
		DEFAULT_CHARACTER_APPEARANCE,
		type CharacterAppearanceV1
	} from '$lib/game/character/CharacterAppearance';
	import { CharacterStore } from '$lib/game/character/CharacterStore';
	import { sessionState } from '$lib/state/session.svelte';

	const store = new CharacterStore();
	const colors = ['#b98565', '#8f6048', '#d1a17f', '#55372c', '#4f8f74', '#f97316', '#37485f'];

	let loading = $state(false);
	let saving = $state(false);
	let appearance = $state<CharacterAppearanceV1>({ ...DEFAULT_CHARACTER_APPEARANCE });

	let playerId = $derived(sessionState.humanId || 'local-player');

	async function loadCharacter(): Promise<void> {
		const saved = await Promise.race([
			store.load(playerId).catch(() => null),
			new Promise<null>((resolveTimeout) => {
				window.setTimeout(() => resolveTimeout(null), 800);
			})
		]);

		appearance = saved ?? {
			...DEFAULT_CHARACTER_APPEARANCE,
			displayName: sessionState.displayName || DEFAULT_CHARACTER_APPEARANCE.displayName
		};
	}

	async function saveCharacter(): Promise<void> {
		saving = true;

		try {
			await store.save(playerId, appearance);
			await goto(resolve('/world'));
		} finally {
			saving = false;
		}
	}

	onMount(() => {
		void loadCharacter();
	});
</script>

<svelte:head>
	<title>Create your character — Orelunza</title>
</svelte:head>

{#if loading}
	<LoadingWorld message="Opening character creator" detail="Preparing your appearance options." />
{:else}
	<main class="grid h-dvh w-screen place-items-center overflow-hidden bg-[#131619] px-4 text-white">
		<section
			class="grid w-[min(62rem,calc(100vw-2rem))] gap-5 rounded-md border border-white/10 bg-[#1a1e22]/88 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] md:grid-cols-[0.92fr_1.08fr]"
			aria-label="Character creator"
		>
			<div>
				<p class="m-0 text-sm font-semibold text-[#f97316]">Welcome to Orelunza</p>
				<h1 class="mt-2 mb-3 text-3xl font-semibold">Create your character</h1>
				<p class="m-0 text-sm leading-6 text-white/58">
					Choose a simple voxel appearance before entering the world. You can return here later to
					adjust it.
				</p>

				<div class="mt-5">
					{#key JSON.stringify(appearance)}
						<CharacterPreview {appearance} />
					{/key}
				</div>
			</div>

			<form
				class="grid content-start gap-4"
				onsubmit={(event) => {
					event.preventDefault();
					void saveCharacter();
				}}
			>
				<label class="grid gap-1 text-sm">
					<span class="text-white/68">Public name</span>
					<input
						class="rounded-sm border border-white/12 bg-black/20 px-3 py-2 text-white outline-none focus:border-[#f97316]"
						bind:value={appearance.displayName}
						required
						maxlength="48"
					/>
				</label>

				<label class="grid gap-1 text-sm">
					<span class="text-white/68">Hair style</span>
					<select
						class="rounded-sm border border-white/12 bg-black/20 px-3 py-2 text-white outline-none focus:border-[#f97316]"
						bind:value={appearance.hairStyle}
					>
						<option value="short">Short</option>
						<option value="curly">Curly</option>
						<option value="long">Long</option>
						<option value="none">None</option>
					</select>
				</label>

				<div class="grid gap-3 sm:grid-cols-2">
					<CharacterColorPicker label="Skin tone" bind:value={appearance.skinTone} {colors} />
					<CharacterColorPicker label="Hair color" bind:value={appearance.hairColor} {colors} />
					<CharacterColorPicker label="Shirt color" bind:value={appearance.shirtColor} {colors} />
					<CharacterColorPicker label="Pants color" bind:value={appearance.pantsColor} {colors} />
					<CharacterColorPicker label="Shoes color" bind:value={appearance.shoesColor} {colors} />
				</div>

				<button
					type="submit"
					class="mt-2 rounded-sm bg-[#f97316] px-4 py-3 text-sm font-semibold text-black transition hover:bg-[#fb8b3d]"
					disabled={saving}
				>
					{saving ? 'Saving character...' : 'Enter the world'}
				</button>
			</form>
		</section>
	</main>
{/if}
