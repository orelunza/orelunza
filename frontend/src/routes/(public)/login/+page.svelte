<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import Card from '$lib/components/ui/Card.svelte';
	import LoginForm from '$lib/components/auth/LoginForm.svelte';
	import { CharacterStore } from '$lib/game/character/CharacterStore';
	import { sessionState } from '$lib/state/session.svelte';

	const characterStore = new CharacterStore();

	async function enterWorld(): Promise<void> {
		const character = await characterStore.load(sessionState.humanId || 'local-player');

		await goto(resolve(character ? '/world' : '/character/create'));
	}
</script>

<svelte:head>
	<title>Sign in — Orelunza</title>

	<meta name="description" content="Sign in and return to your place in Orelunza." />
</svelte:head>

<main class="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
	<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		<div
			class="absolute top-[-12rem] left-[-8rem] size-[30rem] rounded-full bg-[color-mix(in_srgb,var(--orelunza-accent)_14%,transparent)] blur-3xl"
		></div>

		<div
			class="absolute right-[-12rem] bottom-[-15rem] size-[34rem] rounded-full bg-[rgb(35_73_57_/_0.2)] blur-3xl"
		></div>
	</div>

	<div class="relative grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
		<section class="hidden lg:block">
			<p
				class="mb-4 text-sm font-semibold tracking-[0.28em] text-[var(--orelunza-accent)] uppercase"
			>
				Orelunza
			</p>

			<h1
				class="max-w-xl text-5xl leading-[1.08] font-semibold tracking-[-0.04em] text-[var(--orelunza-text)]"
			>
				Return to a quieter place on the internet.
			</h1>

			<p class="mt-6 max-w-lg text-lg leading-8 text-[var(--orelunza-text-soft)]">
				Enter your city without likes, follower counts or pressure to perform. Your home and the
				places you visited are waiting for you.
			</p>

			<div class="mt-10 grid max-w-lg grid-cols-3 gap-3" aria-hidden="true">
				<div
					class="h-24 rounded-3xl border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)]"
				></div>

				<div
					class="h-32 -translate-y-4 rounded-3xl border border-[var(--orelunza-border)] bg-[var(--orelunza-surface-raised)]"
				></div>

				<div
					class="h-20 translate-y-4 rounded-3xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)]"
				></div>
			</div>
		</section>

		<Card padding="large" class="app-surface" ariaLabel="Sign in to Orelunza">
			<div class="mb-7">
				<a
					href={resolve('/')}
					class="mb-7 inline-flex items-center gap-3 text-sm font-semibold text-[var(--orelunza-accent)] lg:hidden"
				>
					<span
						class="flex size-9 items-center justify-center rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-background-soft)]"
						aria-hidden="true"
					>
						O
					</span>

					Orelunza
				</a>

				<p class="mb-2 text-sm font-medium text-[var(--orelunza-accent)]">Welcome back</p>

				<h2 class="mb-0 text-3xl font-semibold tracking-[-0.03em]">Enter the city</h2>

				<p class="mt-3 mb-0 leading-7 text-[var(--orelunza-text-muted)]">
					Use the identity you created for Orelunza.
				</p>
			</div>

			<LoginForm onSuccess={enterWorld} />

			<p class="mt-7 mb-0 text-center text-sm text-[var(--orelunza-text-muted)]">
				You do not have a place yet?

				<a
					href={resolve('/register')}
					class="font-semibold text-[var(--orelunza-accent)] transition hover:text-[var(--orelunza-accent-strong)]"
				>
					Become a citizen
				</a>
			</p>
		</Card>
	</div>
</main>
