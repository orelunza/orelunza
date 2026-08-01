<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	import { sessionState } from '$lib/state/session.svelte';
	import { worldState } from '$lib/state/world.svelte';

	interface Props {
		onNavigate?: () => void;
	}

	let { onNavigate }: Props = $props();

	interface NavigationItem {
		label: string;
		description: string;
		href: '/world' | '/profile';
		exact?: boolean;
		icon: 'city' | 'profile';
	}

	const navigation: NavigationItem[] = [
		{
			label: 'World',
			description: 'Explore and build',
			href: '/world',
			icon: 'city'
		},
		{
			label: 'Profile',
			description: 'Your Orelunza identity',
			href: '/profile',
			exact: true,
			icon: 'profile'
		}
	];

	function isActive(item: NavigationItem): boolean {
		if (item.exact) {
			return page.url.pathname === item.href;
		}

		return page.url.pathname.startsWith(item.href);
	}

	const locationName = $derived.by(() => {
		if (worldState.selectedPlace) {
			return worldState.selectedPlace.name;
		}

		if (worldState.selectedRegion) {
			return worldState.selectedRegion.name;
		}

		if (worldState.position) {
			return worldState.position.region_id;
		}

		return 'No position yet';
	});
</script>

<aside
	class="flex h-full min-h-0 flex-col bg-[var(--orelunza-background-soft)]"
	aria-label="Main navigation"
>
	<div class="flex min-h-16 items-center gap-3 border-b border-[var(--orelunza-border)] px-5">
		<a
			href={resolve('/world')}
			class="flex min-w-0 items-center gap-3"
			onclick={() => onNavigate?.()}
		>
			<div
				class="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--orelunza-border-strong)] bg-[var(--orelunza-surface-raised)] text-base font-bold text-[var(--orelunza-accent)] shadow-lg"
				aria-hidden="true"
			>
				O
			</div>

			<div class="min-w-0">
				<p
					class="m-0 truncate text-base font-semibold tracking-[-0.02em] text-[var(--orelunza-text)]"
				>
					Orelunza
				</p>

				<p class="m-0 truncate text-xs text-[var(--orelunza-text-muted)]">
					A peaceful digital world
				</p>
			</div>
		</a>
	</div>

	<nav class="min-h-0 flex-1 overflow-y-auto px-3 py-5">
		<p
			class="mb-3 px-3 text-[0.68rem] font-semibold tracking-[0.18em] text-[var(--orelunza-text-muted)] uppercase"
		>
			Explore
		</p>

		<ul class="m-0 grid list-none gap-1 p-0">
			{#each navigation as item (item.href)}
				<li>
					<a
						href={resolve(item.href)}
						aria-current={isActive(item) ? 'page' : undefined}
						class={[
							'group flex items-center gap-3 rounded-xl border px-3 py-3 transition',
							isActive(item)
								? 'border-[var(--orelunza-border-strong)] bg-[var(--orelunza-surface-raised)] text-[var(--orelunza-text)]'
								: 'border-transparent text-[var(--orelunza-text-soft)] hover:border-[var(--orelunza-border)] hover:bg-[var(--orelunza-surface)]'
						].join(' ')}
						onclick={() => onNavigate?.()}
					>
						<span
							class={[
								'flex size-10 shrink-0 items-center justify-center rounded-xl transition',
								isActive(item)
									? 'bg-[color-mix(in_srgb,var(--orelunza-accent)_16%,transparent)] text-[var(--orelunza-accent)]'
									: 'bg-[var(--orelunza-surface)] text-[var(--orelunza-text-muted)] group-hover:text-[var(--orelunza-text)]'
							].join(' ')}
							aria-hidden="true"
						>
							{#if item.icon === 'city'}
								<svg
									viewBox="0 0 24 24"
									class="size-5"
									fill="none"
									stroke="currentColor"
									stroke-width="1.7"
								>
									<path d="M4 20V9l8-5 8 5v11" stroke-linejoin="round" />

									<path d="M9 20v-6h6v6M8 10h.01M12 10h.01M16 10h.01" stroke-linecap="round" />
								</svg>
							{:else}
								<svg
									viewBox="0 0 24 24"
									class="size-5"
									fill="none"
									stroke="currentColor"
									stroke-width="1.7"
								>
									<circle cx="12" cy="8" r="4" />

									<path d="M4.5 20c.8-4.1 3.3-6 7.5-6s6.7 1.9 7.5 6" stroke-linecap="round" />
								</svg>
							{/if}
						</span>

						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-semibold">
								{item.label}
							</span>

							<span class="mt-0.5 block truncate text-xs text-[var(--orelunza-text-muted)]">
								{item.description}
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>

		<div
			class="mt-7 rounded-2xl border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] p-4"
		>
			<div class="flex items-center gap-2">
				<span
					class="size-2 rounded-full bg-[var(--orelunza-success)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--orelunza-success)_12%,transparent)]"
					aria-hidden="true"
				></span>

				<p class="m-0 text-xs font-semibold text-[var(--orelunza-text-soft)]">Current place</p>
			</div>

			<p class="mt-3 mb-0 truncate text-sm font-medium text-[var(--orelunza-text)]">
				{locationName}
			</p>
		</div>
	</nav>

	<div class="border-t border-[var(--orelunza-border)] p-4">
		<a
			href={resolve('/profile')}
			class="flex items-center gap-3 rounded-xl p-2 transition hover:bg-[var(--orelunza-surface)]"
			onclick={() => onNavigate?.()}
		>
			<div
				class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-surface-raised)] text-sm font-semibold text-[var(--orelunza-accent)]"
			>
				{#if sessionState.avatar}
					<img src={sessionState.avatar} alt="" class="size-full object-cover" />
				{:else}
					{sessionState.displayName.slice(0, 1).toUpperCase() || 'C'}
				{/if}
			</div>

			<div class="min-w-0">
				<p class="m-0 truncate text-sm font-semibold text-[var(--orelunza-text)]">
					{sessionState.displayName || 'Citizen'}
				</p>

				<p class="m-0 truncate text-xs text-[var(--orelunza-text-muted)]">
					{sessionState.identity?.email ?? ''}
				</p>
			</div>
		</a>
	</div>
</aside>
