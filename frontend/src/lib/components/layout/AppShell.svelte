<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	import SidePanel from '$lib/components/layout/SidePanel.svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	let mobileNavigationOpen = $state(false);

	function openNavigation(): void {
		mobileNavigationOpen = true;
	}

	function closeNavigation(): void {
		mobileNavigationOpen = false;
	}

	onMount(() => {
		const handleKeydown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape' && mobileNavigationOpen) {
				closeNavigation();
			}
		};

		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});

	$effect(() => {
		if (typeof document === 'undefined') {
			return;
		}

		document.body.style.overflow = mobileNavigationOpen ? 'hidden' : '';

		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<div class="min-h-dvh">
	<div
		class="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-[var(--orelunza-border)] lg:block"
	>
		<SidePanel />
	</div>

	<div class="min-h-dvh lg:pl-72">
		<TopBar onMenuToggle={openNavigation} />

		<main class="mx-auto w-full max-w-[110rem] px-4 py-5 sm:px-6 sm:py-7">
			{@render children()}
		</main>
	</div>

	{#if mobileNavigationOpen}
		<div
			class="fixed inset-0 z-50 lg:hidden"
			role="dialog"
			aria-modal="true"
			aria-label="Navigation"
		>
			<button
				type="button"
				class="absolute inset-0 bg-black/65 backdrop-blur-sm"
				aria-label="Close navigation"
				onclick={closeNavigation}
			></button>

			<div
				class="absolute inset-y-0 left-0 w-[min(20rem,88vw)] border-r border-[var(--orelunza-border)] shadow-2xl"
			>
				<SidePanel onNavigate={closeNavigation} />

				<button
					type="button"
					class="absolute top-3 right-3 flex size-10 items-center justify-center rounded-xl border border-[var(--orelunza-border)] bg-[var(--orelunza-surface)] text-[var(--orelunza-text-muted)] transition hover:text-[var(--orelunza-text)]"
					aria-label="Close navigation"
					onclick={closeNavigation}
				>
					<svg
						viewBox="0 0 24 24"
						class="size-5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
					>
						<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
					</svg>
				</button>
			</div>
		</div>
	{/if}
</div>
