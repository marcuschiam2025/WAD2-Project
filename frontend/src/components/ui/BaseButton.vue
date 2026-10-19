<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  variant: { type: String, default: 'primary' }, // primary | outline | secondary | ghost | destructive
  size: { type: String, default: 'default' }, // default | sm
  to: { type: [String, Object], default: null },
  href: { type: String, default: null },
  block: Boolean,
  disabled: Boolean,
})

const variants = {
  primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  outline: 'bg-card border border-border text-foreground hover:bg-muted',
  secondary: 'bg-secondary text-foreground hover:bg-border',
  ghost: 'text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-primary-foreground hover:bg-destructive/90',
}

const sizes = {
  default: 'h-10 px-4 text-[14px]',
  sm: 'px-3 py-1.5 text-[13px]',
}

const classes = computed(() => [
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  variants[props.variant],
  sizes[props.size],
  props.block && 'w-full',
])

const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : 'button'))
</script>

<template>
  <component
    :is="tag"
    :to="to ?? undefined"
    :href="href ?? undefined"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener' : undefined"
    :type="tag === 'button' ? 'button' : undefined"
    :disabled="tag === 'button' ? disabled : undefined"
    :class="classes"
  >
    <slot />
  </component>
</template>
