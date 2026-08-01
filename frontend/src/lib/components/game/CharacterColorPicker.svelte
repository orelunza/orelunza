<script lang="ts">
	interface Props {
		label: string;
		value: string;
		colors: string[];
	}

	let { label, value = $bindable(), colors }: Props = $props();
</script>

<label class="grid gap-1 text-sm">
	<span class="text-white/68">{label}</span>
	<div class="flex flex-wrap gap-1.5">
		{#each colors as color (color)}
			<button
				type="button"
				class={`size-7 rounded-sm border ${value === color ? 'border-[#f97316]' : 'border-white/14'}`}
				style={`background:${color}`}
				aria-label={`${label} ${color}`}
				onclick={() => {
					value = color;
				}}
			></button>
		{/each}
	</div>
</label>
