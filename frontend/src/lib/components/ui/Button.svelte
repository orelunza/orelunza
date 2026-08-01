<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

	export type ButtonSize = 'small' | 'medium' | 'large';

	interface Props extends Omit<HTMLButtonAttributes, 'class' | 'children'> {
		children?: Snippet;
		variant?: ButtonVariant;
		size?: ButtonSize;
		loading?: boolean;
		fullWidth?: boolean;
		class?: string;
	}

	let {
		children,
		variant = 'primary',
		size = 'medium',
		loading = false,
		fullWidth = false,
		disabled = false,
		type = 'button',
		class: className = '',
		...rest
	}: Props = $props();

	const baseClasses =
		'inline-flex items-center justify-center gap-2 rounded-[var(--orelunza-radius-small)] font-semibold transition duration-150 select-none';

	const variantClasses: Record<ButtonVariant, string> = {
		primary:
			'border border-transparent bg-[var(--orelunza-accent)] text-[var(--orelunza-accent-contrast)] hover:bg-[var(--orelunza-accent-strong)] active:translate-y-px',
		secondary:
			'border border-[var(--orelunza-border-strong)] bg-[var(--orelunza-surface-raised)] text-[var(--orelunza-text)] hover:bg-[var(--orelunza-surface-hover)] active:translate-y-px',
		ghost:
			'border border-transparent bg-transparent text-[var(--orelunza-text-soft)] hover:bg-[var(--orelunza-surface-hover)] hover:text-[var(--orelunza-text)] active:translate-y-px',
		danger:
			'border border-transparent bg-[var(--orelunza-danger-surface)] text-[var(--orelunza-danger)] hover:brightness-110 active:translate-y-px'
	};

	const sizeClasses: Record<ButtonSize, string> = {
		small: 'min-h-9 px-3 py-1.5 text-sm',
		medium: 'min-h-11 px-4 py-2.5 text-sm',
		large: 'min-h-12 px-5 py-3 text-base'
	};

	const classes = $derived(
		[
			baseClasses,
			variantClasses[variant],
			sizeClasses[size],
			fullWidth ? 'w-full' : '',
			disabled || loading ? 'pointer-events-none opacity-60' : '',
			className
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<button {...rest} {type} class={classes} disabled={disabled || loading} aria-busy={loading}>
	{#if loading}
		<span class="button-spinner" aria-hidden="true"></span>
	{/if}

	<span class:opacity-80={loading}>
		{#if children}
			{@render children()}
		{/if}
	</span>
</button>

<style>
	.button-spinner {
		width: 1rem;
		height: 1rem;
		flex: 0 0 auto;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 999px;
		animation: button-spin 700ms linear infinite;
	}

	@keyframes button-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
