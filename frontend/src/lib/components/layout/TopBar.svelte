<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { natureState } from '$lib/state/nature.svelte';
	import { sessionState } from '$lib/state/session.svelte';
	import { worldState } from '$lib/state/world.svelte';

	interface Props {
		onMenuToggle?: () => void;
	}

	let { onMenuToggle }: Props = $props();

	let loggingOut = $state(false);

	const pageTitle = $derived.by(() => {
		const pathname = page.url.pathname;

		if (pathname.startsWith('/city/regions/')) {
			return 'Region';
		}

		if (pathname.startsWith('/city/places/')) {
			return 'Place';
		}

		if (pathname.startsWith('/profile')) {
			return 'Profile';
		}

		if (pathname.startsWith('/city')) {
			return 'Orelunza';
		}

		return 'Orelunza';
	});

	const locationLabel = $derived.by(() => {
		if (worldState.selectedPlace) {
			return worldState.selectedPlace.name;
		}

		if (worldState.selectedRegion) {
			return worldState.selectedRegion.name;
		}

		return 'The city';
	});

	const displayName = $derived(sessionState.displayName || 'Citizen');

	const avatarLetter = $derived(displayName.slice(0, 1).toUpperCase());

	async function logout(): Promise<void> {
		if (loggingOut) {
			return;
		}

		loggingOut = true;

		try {
			await sessionState.logout();
		} catch {
			/*
			 * SessionState clears local authentication state even when the
			 * remote logout request fails. The user must still leave the
			 * protected application.
			 */
		} finally {
			worldState.reset();
			natureState.reset();

			loggingOut = false;

			await goto('/login', {
				replaceState: true
			});
		}
	}
</script>

<header
	class="sticky top-0 z-30 border-b border-[var(--orelunza-border)] bg-[color-mix(in_srgb,var(--orelunza-background)_88%,transparent)] backdrop-blur-xl"
>
	<div class="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
		<div class="flex min-w-0 items-center gap-3">
			<button
				type="button"
				class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] text-[var(--orelunza-text-soft)] transition hover:border-[var(--orelunza-border-strong)] hover:bg-[var(--orelunza-surface-hover)] hover:text-[var(--orelunza-text)] lg:hidden"
				aria-label="Open navigation"
				onclick={() => onMenuToggle?.()}
			>
				<svg
					viewBox="0 0 24 24"
					class="size-5"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					aria-hidden="true"
				>
					<path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round" />
				</svg>
			</button>

			<div class="min-w-0">
				<p class="m-0 truncate text-sm font-semibold text-[var(--orelunza-text)]">
					{pageTitle}
				</p>

				<p class="m-0 truncate text-xs text-[var(--orelunza-text-muted)]">
					{locationLabel}
				</p>
			</div>
		</div>

		<div class="flex shrink-0 items-center gap-2">
			<a
				href="/profile"
				class="flex min-w-0 items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-[var(--orelunza-surface-hover)]"
				aria-label="Open profile"
			>
				<div
					class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--orelunza-border-strong)] bg-[var(--orelunza-surface-raised)] text-sm font-semibold text-[var(--orelunza-accent)]"
				>
					{#if sessionState.avatar}
						<img src={sessionState.avatar} alt="" class="size-full object-cover" />
					{:else}
						{avatarLetter}
					{/if}
				</div>

				<div class="hidden min-w-0 text-left sm:block">
					<p class="m-0 max-w-36 truncate text-sm font-medium text-[var(--orelunza-text)]">
						{displayName}
					</p>

					<p class="m-0 text-xs text-[var(--orelunza-text-muted)]">Citizen</p>
				</div>
			</a>

			<button
				type="button"
				class="flex size-10 items-center justify-center rounded-xl border border-transparent text-[var(--orelunza-text-muted)] transition hover:border-[var(--orelunza-border)] hover:bg-[var(--orelunza-surface)] hover:text-[var(--orelunza-danger)] disabled:pointer-events-none disabled:opacity-50"
				aria-label="Sign out"
				title="Sign out"
				disabled={loggingOut}
				onclick={logout}
			>
				{#if loggingOut}
					<span
						class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
						aria-hidden="true"
					></span>
				{:else}
					<svg
						viewBox="0 0 24 24"
						class="size-5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
					>
						<path d="M14 8l4 4-4 4M18 12H8" stroke-linecap="round" stroke-linejoin="round" />

						<path d="M11 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" stroke-linecap="round" />
					</svg>
				{/if}
			</button>
		</div>
	</div>
</header>
