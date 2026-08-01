<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	import { ApiError } from '$lib/api/ApiError';

	import AppShell from '$lib/components/layout/AppShell.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ErrorNotice from '$lib/components/ui/ErrorNotice.svelte';
	import LoadingScreen from '$lib/components/ui/LoadingScreen.svelte';

	import { sessionState } from '$lib/state/session.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	let ready = $state(false);
	let startupError = $state<ApiError | null>(null);
	let activeController: AbortController | null = null;

	function loginUrl(): string {
		const destination = `${page.url.pathname}${page.url.search}`;

		return `/login?redirect=${encodeURIComponent(destination)}`;
	}

	async function initialize(): Promise<void> {
		activeController?.abort();

		const controller = new AbortController();
		activeController = controller;

		ready = false;
		startupError = null;

		if (sessionState.isAuthenticated) {
			ready = true;
			return;
		}

		try {
			const identity = await sessionState.refresh(controller.signal);

			if (controller.signal.aborted) {
				return;
			}

			if (!identity) {
				await goto(loginUrl(), {
					replaceState: true
				});

				return;
			}

			ready = true;
		} catch (error) {
			if (controller.signal.aborted) {
				return;
			}

			startupError = ApiError.fromUnknown(error);
		}
	}

	onMount(() => {
		void initialize();

		return () => {
			activeController?.abort();
		};
	});
</script>

{#if ready && sessionState.isAuthenticated}
	<AppShell>
		{@render children()}
	</AppShell>
{:else if startupError}
	<main class="flex min-h-dvh items-center justify-center px-5 py-10">
		<section class="app-surface w-full max-w-lg p-6 sm:p-8">
			<p class="mb-2 text-sm font-semibold text-[var(--orelunza-accent)]">Orelunza</p>

			<h1 class="mb-3 text-2xl font-semibold tracking-[-0.03em]">The city could not be opened</h1>

			<p class="mb-6 leading-7 text-[var(--orelunza-text-muted)]">
				The server may be temporarily unavailable. Your session has not been changed.
			</p>

			<ErrorNotice error={startupError} title="Connection failed" />

			<div class="mt-6 flex flex-wrap gap-3">
				<Button onclick={initialize}>Try again</Button>

				<Button variant="secondary" onclick={() => goto('/login')}>Return to sign in</Button>
			</div>
		</section>
	</main>
{:else}
	<LoadingScreen
		fullscreen
		message="Opening Orelunza…"
		detail="Checking your identity and preparing the city."
	/>
{/if}
