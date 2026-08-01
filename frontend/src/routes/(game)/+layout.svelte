<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	import LoadingWorld from '$lib/components/game/LoadingWorld.svelte';
	import { ApiError } from '$lib/api/ApiError';
	import { sessionState } from '$lib/state/session.svelte';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();

	let ready = $state(false);
	let error = $state<ApiError | null>(null);
	let controller: AbortController | null = null;

	function loginUrl(): string {
		return `${resolve('/login')}?redirect=${encodeURIComponent(`${page.url.pathname}${page.url.search}`)}`;
	}

	async function initialize(): Promise<void> {
		controller?.abort();
		controller = new AbortController();
		ready = false;
		error = null;

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
				// eslint-disable-next-line svelte/no-navigation-without-resolve
				await goto(loginUrl(), { replaceState: true });
				return;
			}

			ready = true;
		} catch (caught) {
			if (!controller.signal.aborted) {
				error = ApiError.fromUnknown(caught);
			}
		}
	}

	onMount(() => {
		void initialize();

		return () => {
			controller?.abort();
		};
	});

	$effect(() => {
		if (typeof document === 'undefined') {
			return;
		}

		const previousHtmlOverflow = document.documentElement.style.overflow;
		const previousBodyOverflow = document.body.style.overflow;

		document.documentElement.style.overflow = 'hidden';
		document.body.style.overflow = 'hidden';

		return () => {
			document.documentElement.style.overflow = previousHtmlOverflow;
			document.body.style.overflow = previousBodyOverflow;
		};
	});
</script>

{#if ready && sessionState.isAuthenticated}
	<div class="h-dvh w-screen overflow-hidden bg-[#131619] text-white">
		{@render children()}
	</div>
{:else}
	<LoadingWorld
		message={error ? 'Unable to enter Orelunza' : 'Entering Orelunza'}
		detail={error?.message ?? 'Checking your identity and preparing the world.'}
	/>
{/if}
