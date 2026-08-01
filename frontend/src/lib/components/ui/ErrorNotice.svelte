<script lang="ts">
	import { ApiError } from '$lib/api/ApiError';

	interface Props {
		error: ApiError | string | null;
		title?: string;
		dismissible?: boolean;
		onDismiss?: () => void;
		class?: string;
	}

	let {
		error,
		title = 'Something went wrong',
		dismissible = false,
		onDismiss,
		class: className = ''
	}: Props = $props();

	const message = $derived(error instanceof ApiError ? error.message : (error ?? ''));

	const code = $derived(error instanceof ApiError ? error.code : null);

	const showCode = $derived(Boolean(code && code !== 'unknown_error'));
</script>

{#if message}
	<div
		class={[
			'flex items-start gap-3 rounded-[var(--orelunza-radius-small)]',
			'border border-[color-mix(in_srgb,var(--orelunza-danger)_35%,transparent)]',
			'bg-[var(--orelunza-danger-surface)] px-4 py-3',
			className
		]
			.filter(Boolean)
			.join(' ')}
		role="alert"
	>
		<div
			class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--orelunza-danger)] text-sm font-bold text-[var(--orelunza-danger)]"
			aria-hidden="true"
		>
			!
		</div>

		<div class="min-w-0 flex-1">
			<p class="m-0 font-semibold text-[var(--orelunza-danger)]">
				{title}
			</p>

			<p class="mt-1 mb-0 text-sm leading-6 text-[var(--orelunza-text-soft)]">
				{message}
			</p>

			{#if showCode}
				<p class="mt-2 mb-0 font-mono text-xs text-[var(--orelunza-text-muted)]">
					{code}
				</p>
			{/if}
		</div>

		{#if dismissible}
			<button
				type="button"
				class="shrink-0 rounded-md px-2 py-1 text-[var(--orelunza-text-muted)] transition hover:bg-white/5 hover:text-[var(--orelunza-text)]"
				aria-label="Dismiss error"
				onclick={() => onDismiss?.()}
			>
				<span aria-hidden="true">×</span>
			</button>
		{/if}
	</div>
{/if}
