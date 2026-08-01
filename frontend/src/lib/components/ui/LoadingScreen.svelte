<script lang="ts">
	interface Props {
		message?: string;
		detail?: string;
		fullscreen?: boolean;
		compact?: boolean;
		class?: string;
	}

	let {
		message = 'Loading Orelunza…',
		detail = '',
		fullscreen = false,
		compact = false,
		class: className = ''
	}: Props = $props();

	const containerClasses = $derived(
		[
			'flex items-center justify-center',
			fullscreen ? 'min-h-dvh px-6' : compact ? 'min-h-32 px-4 py-6' : 'min-h-72 px-6 py-10',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<div class={containerClasses} role="status" aria-live="polite">
	<div class="flex max-w-sm flex-col items-center text-center">
		<div
			class={['loading-orbit', compact ? 'loading-orbit-small' : ''].filter(Boolean).join(' ')}
			aria-hidden="true"
		>
			<span></span>
			<span></span>
			<span></span>
		</div>

		<p
			class={[
				'mb-0 font-semibold text-[var(--orelunza-text)]',
				compact ? 'mt-3 text-sm' : 'mt-5 text-base'
			].join(' ')}
		>
			{message}
		</p>

		{#if detail}
			<p class="mt-2 mb-0 text-sm leading-6 text-[var(--orelunza-text-muted)]">
				{detail}
			</p>
		{/if}
	</div>
</div>

<style>
	.loading-orbit {
		position: relative;
		width: 3rem;
		height: 3rem;
		border: 2px solid var(--orelunza-border);
		border-top-color: var(--orelunza-accent);
		border-radius: 999px;
		animation: loading-spin 900ms linear infinite;
	}

	.loading-orbit-small {
		width: 2rem;
		height: 2rem;
	}

	.loading-orbit span {
		position: absolute;
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 999px;
		background: var(--orelunza-accent);
	}

	.loading-orbit span:nth-child(1) {
		top: -0.15rem;
		left: 50%;
		transform: translateX(-50%);
	}

	.loading-orbit span:nth-child(2) {
		right: -0.1rem;
		bottom: 0.45rem;
		opacity: 0.65;
	}

	.loading-orbit span:nth-child(3) {
		left: -0.1rem;
		bottom: 0.45rem;
		opacity: 0.35;
	}

	@keyframes loading-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
