<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	import Card from '$lib/components/ui/Card.svelte';
	import RegisterForm from '$lib/components/auth/RegisterForm.svelte';

	async function enterCharacterCreator(): Promise<void> {
		await goto(resolve('/character/create'));
	}
</script>

<svelte:head>
	<title>Become a citizen — Orelunza</title>

	<meta name="description" content="Create your identity and become a citizen of Orelunza." />
</svelte:head>

<main class="relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
	<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		<div
			class="absolute top-[-15rem] right-[-8rem] size-[34rem] rounded-full bg-[color-mix(in_srgb,var(--orelunza-accent)_15%,transparent)] blur-3xl"
		></div>

		<div
			class="absolute bottom-[-12rem] left-[-12rem] size-[32rem] rounded-full bg-[rgb(31_66_51_/_0.22)] blur-3xl"
		></div>
	</div>

	<div class="relative grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
		<section class="hidden lg:block">
			<p
				class="mb-4 text-sm font-semibold tracking-[0.28em] text-[var(--orelunza-accent)] uppercase"
			>
				A different kind of city
			</p>

			<h1 class="max-w-xl text-5xl leading-[1.08] font-semibold tracking-[-0.04em]">
				A small place of your own, from your first day.
			</h1>

			<p class="mt-6 max-w-lg text-lg leading-8 text-[var(--orelunza-text-soft)]">
				Explore peaceful regions, visit quiet places and meet people without turning your life into
				a public competition.
			</p>

			<div class="mt-10 grid max-w-lg gap-4">
				<div
					class="flex items-start gap-4 rounded-2xl border border-[var(--orelunza-border)] bg-[color-mix(in_srgb,var(--orelunza-surface)_82%,transparent)] p-4"
				>
					<span
						class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--orelunza-surface-raised)] text-[var(--orelunza-accent)]"
						aria-hidden="true"
					>
						01
					</span>

					<div>
						<p class="mb-1 font-semibold">No popularity metrics</p>

						<p class="m-0 text-sm leading-6 text-[var(--orelunza-text-muted)]">
							No likes, public follower counts or engagement race.
						</p>
					</div>
				</div>

				<div
					class="flex items-start gap-4 rounded-2xl border border-[var(--orelunza-border)] bg-[color-mix(in_srgb,var(--orelunza-surface)_82%,transparent)] p-4"
				>
					<span
						class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--orelunza-surface-raised)] text-[var(--orelunza-accent)]"
						aria-hidden="true"
					>
						02
					</span>

					<div>
						<p class="mb-1 font-semibold">Move at your own pace</p>

						<p class="m-0 text-sm leading-6 text-[var(--orelunza-text-muted)]">
							Stay alone, explore nature or speak with citizens when you feel ready.
						</p>
					</div>
				</div>
			</div>
		</section>

		<Card padding="large" class="app-surface" ariaLabel="Create an Orelunza identity">
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

				<p class="mb-2 text-sm font-medium text-[var(--orelunza-accent)]">New citizen</p>

				<h2 class="mb-0 text-3xl font-semibold tracking-[-0.03em]">Create your identity</h2>

				<p class="mt-3 mb-0 leading-7 text-[var(--orelunza-text-muted)]">
					Your citizen name is how people will know you inside the city.
				</p>
			</div>

			<RegisterForm onSuccess={enterCharacterCreator} />

			<p class="mt-7 mb-0 text-center text-sm text-[var(--orelunza-text-muted)]">
				Already a citizen?

				<a
					href={resolve('/login')}
					class="font-semibold text-[var(--orelunza-accent)] transition hover:text-[var(--orelunza-accent-strong)]"
				>
					Sign in
				</a>
			</p>
		</Card>
	</div>
</main>
