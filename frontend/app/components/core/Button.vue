<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 's' | 'm' | 'l'
  disabled?: boolean
}>(), {
  variant: 'primary',
  size: 'm',
  disabled: false
})

const sizeClasses = {
  s: 'px-3.5 py-2 text-xs',
  m: 'px-5 py-3 text-sm',
  l: 'px-7 py-4 text-base'
}

const variantClasses = {
  primary: 'bg-accent-primary text-on-accent hover:bg-accent-primary-hover active:bg-accent-primary-press',
  secondary: 'bg-accent-secondary text-ink-0 hover:bg-accent-secondary-hover',
  ghost: 'bg-transparent text-primary border border-default hover:border-strong',
  danger: 'bg-transparent text-red-4 border border-danger'
}
</script>

<template>
  <button
    :disabled="disabled"
    :class="[
      'inline-flex items-center justify-center gap-2 rounded-sm font-display uppercase tracking-caps font-semibold transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
      disabled ? 'opacity-45 cursor-default' : 'cursor-pointer active:translate-y-px',
      sizeClasses[size],
      variantClasses[variant]
    ]"
  >
    <slot />
  </button>
</template>
