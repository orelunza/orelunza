<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	import CharacterColorPicker from '$lib/components/game/CharacterColorPicker.svelte';
	import CharacterPreview from '$lib/components/game/CharacterPreview.svelte';
	import PlanetPreviewCanvas from '$lib/components/game/PlanetPreviewCanvas.svelte';
	import LoadingWorld from '$lib/components/game/LoadingWorld.svelte';
	import {
		DEFAULT_CHARACTER_APPEARANCE,
		type CharacterAppearanceV1
	} from '$lib/game/character/CharacterAppearance';
	import { CharacterStore } from '$lib/game/character/CharacterStore';
	import { sessionState } from '$lib/state/session.svelte';
	import type { PlanetTravelRequest } from '$lib/game/planet/surface/PlanetTravelRequest';
	import type { WorldLocation } from '$lib/game/world/geography/WorldLocation';

	const store = new CharacterStore();
	const colors = ['#b98565', '#8f6048', '#d1a17f', '#55372c', '#4f8f74', '#f97316', '#37485f'];

	let loading = $state(false);
	let saving = $state(false);
	let appearance = $state<CharacterAppearanceV1>({ ...DEFAULT_CHARACTER_APPEARANCE });
	let step = $state<1 | 2 | 3>(1);
	let home = $state<WorldLocation | null>(null);

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
		home = store.loadHome(playerId);
	}

	async function saveCharacter(): Promise<void> {
		saving = true;

		try {
			if (!home) return;
			await store.save(playerId, appearance);
			store.saveHome(playerId, home);
			await goto(resolve('/world'));
		} finally {
			saving = false;
		}
	}

	function chooseHome(destination: PlanetTravelRequest): void {
		home = {
			countryId: destination.countryId ?? 'unknown',
			countryName: destination.countryName ?? 'Unknown',
			settlementId: destination.settlementId ?? 'entry',
			settlementName: destination.settlementName ?? 'Entry Settlement',
			latitude: (destination.coordinate.latitudeRadians * 180) / Math.PI,
			longitude: (destination.coordinate.longitudeRadians * 180) / Math.PI,
			elevationMeters: destination.elevationMeters,
			worldAnchorId: destination.settlementId ?? 'entry',
			biomeName: destination.biomeName
		};
		step = 3;
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
{:else if step === 2}
	<main class="relative h-dvh w-screen overflow-hidden">
		<PlanetPreviewCanvas onClose={() => (step = 1)} onTravel={chooseHome} />
		<div
			class="pointer-events-none absolute top-4 right-4 z-10 max-w-xs rounded-md bg-black/65 p-4 text-white"
		>
			<p class="m-0 text-xs font-semibold tracking-[.2em] text-sky-200 uppercase">Step 2 of 3</p>
			<h1 class="mt-2 text-xl font-semibold">Choose where to begin life</h1>
			<p class="mb-0 text-sm text-white/65">
				Choose land on Earth. Your country and starting settlement will be confirmed next.
			</p>
		</div>
	</main>
{:else if step === 3 && home}
	<main class="grid h-dvh place-items-center bg-[#131619] p-4 text-white">
		<section class="w-full max-w-md rounded-md border border-white/10 bg-[#1a1e22] p-6">
			<p class="m-0 text-xs font-semibold tracking-[.2em] text-sky-200 uppercase">Step 3 of 3</p>
			<h1 class="mt-3 text-3xl font-semibold">Start your life in</h1>
			<p class="mt-5 mb-0 text-2xl font-semibold">{home.settlementName}</p>
			<p class="m-0 text-white/60">{home.countryName}</p>
			<div class="mt-6 flex justify-between gap-3">
				<button
					type="button"
					class="rounded-sm border border-white/15 px-4 py-2"
					onclick={() => (step = 2)}>Back</button
				><button
					type="button"
					class="rounded-sm bg-[#f97316] px-4 py-2 font-semibold text-black"
					onclick={() => void saveCharacter()}>Start life in {home.countryName}</button
				>
			</div>
		</section>
	</main>
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
					step = 2;
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
					<span class="text-white/68">Body type</span>
					<select
						class="rounded-sm border border-white/12 bg-black/20 px-3 py-2 text-white outline-none focus:border-[#f97316]"
						bind:value={appearance.bodyType}
					>
						<option value="neutral_m">Neutral M</option>
						<option value="neutral_f">Neutral F</option>
					</select>
				</label>

				<label class="grid gap-1 text-sm">
					<span class="text-white/68">Hair style</span>
					<select
						class="rounded-sm border border-white/12 bg-black/20 px-3 py-2 text-white outline-none focus:border-[#f97316]"
						bind:value={appearance.hairStyle}
					>
						<option value="short">Short</option>
						<option value="shaved">Shaved</option>
						<option value="curly">Curly</option>
						<option value="afro">Afro</option>
						<option value="long">Long</option>
						<option value="braids_simple">Simple braids</option>
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
					{saving ? 'Saving character...' : 'Choose where to begin'}
				</button>
			</form>
		</section>
	</main>
{/if}
