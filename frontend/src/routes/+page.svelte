<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	import { sessionState } from '$lib/state/session.svelte';

	let sessionChecked = $state(false);

	onMount(() => {
		async function checkSession(): Promise<void> {
			if (sessionState.status === 'idle') {
				try {
					await sessionState.refresh();
				} catch {
					/*
					 * The landing page remains available when the backend
					 * cannot be reached.
					 */
				}
			}

			sessionChecked = true;
		}

		void checkSession();
	});
</script>

<svelte:head>
	<title>Orelunza — A peaceful digital world</title>

	<meta
		name="description"
		content="A calm digital city where people can explore, build a home and meet without popularity metrics."
	/>
</svelte:head>

<main class="relative min-h-dvh overflow-hidden">
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<div
			class="absolute top-[-18rem] left-1/2 size-[48rem] -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--orelunza-accent)_13%,transparent)] blur-3xl"
		></div>

		<div
			class="absolute right-[-14rem] bottom-[-20rem] size-[42rem] rounded-full bg-[rgb(34_76_56_/_0.2)] blur-3xl"
		></div>
	</div>

	<header
		class="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8"
	>
		<a href={resolve('/')} class="flex items-center gap-3">
			<span
				class="flex size-10 items-center justify-center rounded-2xl border border-[var(--orelunza-border-strong)] bg-[var(--orelunza-surface-raised)] font-bold text-[var(--orelunza-accent)]"
				aria-hidden="true"
			>
				O
			</span>

			<span class="font-semibold tracking-[-0.02em]"> Orelunza </span>
		</a>

		<nav class="flex items-center gap-2" aria-label="Public navigation">
			{#if sessionChecked && sessionState.isAuthenticated}
				<a
					href={resolve('/world')}
					class="rounded-xl bg-[var(--orelunza-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--orelunza-accent-contrast)] transition hover:bg-[var(--orelunza-accent-strong)]"
				>
					Return to the world
				</a>
			{:else}
				<a
					href={resolve('/login')}
					class="rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--orelunza-text-soft)] transition hover:bg-[var(--orelunza-surface)] hover:text-[var(--orelunza-text)]"
				>
					Sign in
				</a>

				<a
					href={resolve('/register')}
					class="rounded-xl bg-[var(--orelunza-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--orelunza-accent-contrast)] transition hover:bg-[var(--orelunza-accent-strong)]"
				>
					Become a citizen
				</a>
			{/if}
		</nav>
	</header>

	<section
		class="relative z-10 mx-auto grid min-h-[calc(100dvh-5rem)] w-full max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-20"
	>
		<div>
			<p
				class="mb-5 text-sm font-semibold tracking-[0.24em] text-[var(--orelunza-accent)] uppercase"
			>
				A quieter place online
			</p>

			<h1
				class="max-w-3xl text-5xl leading-[1.04] font-semibold tracking-[-0.055em] text-[var(--orelunza-text)] sm:text-6xl lg:text-7xl"
			>
				A digital city where you do not have to perform.
			</h1>

			<p class="mt-7 max-w-2xl text-lg leading-8 text-[var(--orelunza-text-soft)] sm:text-xl">
				Explore peaceful regions, stay beside a river, build a home and meet people without likes,
				follower counts or public popularity.
			</p>

			<div class="mt-9 flex flex-wrap gap-3">
				{#if sessionChecked && sessionState.isAuthenticated}
					<a
						href={resolve('/world')}
						class="rounded-xl bg-[var(--orelunza-accent)] px-6 py-3.5 font-semibold text-[var(--orelunza-accent-contrast)] transition hover:bg-[var(--orelunza-accent-strong)]"
					>
						Enter Orelunza
					</a>

					<a
						href={resolve('/profile')}
						class="rounded-xl border border-[var(--orelunza-border-strong)] bg-[var(--orelunza-surface)] px-6 py-3.5 font-semibold text-[var(--orelunza-text)] transition hover:bg-[var(--orelunza-surface-hover)]"
					>
						View your profile
					</a>
				{:else}
					<a
						href={resolve('/register')}
						class="rounded-xl bg-[var(--orelunza-accent)] px-6 py-3.5 font-semibold text-[var(--orelunza-accent-contrast)] transition hover:bg-[var(--orelunza-accent-strong)]"
					>
						Create your identity
					</a>

					<a
						href={resolve('/login')}
						class="rounded-xl border border-[var(--orelunza-border-strong)] bg-[var(--orelunza-surface)] px-6 py-3.5 font-semibold text-[var(--orelunza-text)] transition hover:bg-[var(--orelunza-surface-hover)]"
					>
						I am already a citizen
					</a>
				{/if}
			</div>

			<div class="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[var(--orelunza-text-muted)]">
				<span>No likes</span>
				<span>No follower counts</span>
				<span>No popularity race</span>
				<span>Free access</span>
			</div>
		</div>

		<div class="relative mx-auto w-full max-w-xl" aria-hidden="true">
			<div
				class="absolute inset-8 rounded-[3rem] bg-[color-mix(in_srgb,var(--orelunza-accent)_15%,transparent)] blur-3xl"
			></div>

			<div
				class="relative aspect-square overflow-hidden rounded-[2.5rem] border border-[var(--orelunza-border-strong)] bg-[var(--orelunza-surface)] p-5 shadow-[var(--orelunza-shadow)]"
			>
				<div
					class="relative h-full overflow-hidden rounded-[2rem] border border-[var(--orelunza-border)] bg-[linear-gradient(180deg,#223a2d_0%,#182920_42%,#101b16_100%)]"
				>
					<div
						class="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(160deg,#1a3124_0%,#274936_45%,#17291f_100%)]"
					></div>

					<div
						class="absolute top-[12%] left-[13%] size-20 rounded-full bg-[rgb(143_199_162_/_0.14)] blur-xl"
					></div>

					<div
						class="absolute right-[18%] bottom-[18%] h-[60%] w-20 rotate-[18deg] rounded-full bg-[linear-gradient(180deg,#578f77_0%,#315f50_100%)] opacity-85 shadow-[0_0_34px_rgb(92_156_127_/_0.3)]"
					></div>

					<div
						class="absolute bottom-[27%] left-[14%] size-28 rounded-[45%_55%_52%_48%] bg-[#203d2c] shadow-xl"
					></div>

					<div
						class="absolute bottom-[27%] left-[26%] size-24 rounded-[52%_48%_58%_42%] bg-[#2c543c]"
					></div>

					<div class="absolute bottom-[22%] left-[22%] h-28 w-4 rounded-full bg-[#5a4635]"></div>

					<div
						class="absolute bottom-[17%] left-[48%] flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-[rgb(9_20_15_/_0.72)] text-lg font-bold text-[var(--orelunza-accent)] shadow-2xl backdrop-blur"
					>
						O
					</div>

					<div
						class="absolute top-5 right-5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-white/75 backdrop-blur"
					>
						Quiet River
					</div>

					<div
						class="absolute right-5 bottom-5 left-5 rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur-md"
					>
						<p class="mb-1 text-sm font-semibold text-white">Silent Forest</p>

						<p class="m-0 text-xs leading-5 text-white/65">
							A calm forest filled with old trees and a quiet river.
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</main>
