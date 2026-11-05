<script setup>
// v2 Components / Button
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const props = defineProps({
  variant: { type: String, default: 'primary' }, // primary | secondary | outline | ghost | destructive-outline | link
  size: { type: String, default: 'default' }, // sm | default | lg
  to: { type: [String, Object], default: null },
  href: { type: String, default: null },
  block: Boolean,
  disabled: Boolean,
});

const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-border',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  'destructive-outline': 'border border-destructive bg-card text-destructive hover:bg-destructive-tint',
  link: 'text-primary hover:underline',
};

const sizes = {
  sm: 'text-[13px] py-1.5',
  default: 'text-[14px] py-[9px]',
  lg: 'text-[15px] py-[11px]',
};
const padX = {
  sm: 'px-3',
  default: 'px-4',
  lg: 'px-5',
};

const classes = computed(() => [
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium leading-normal transition-[background-color,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  variants[props.variant],
  sizes[props.size],
  props.variant === 'link' ? 'px-0.5' : padX[props.size],
  props.block && 'w-full',
]);

const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : 'button'));

// Only pass the attributes each kind of element understands. Passing `href: undefined` to a RouterLink
// would strip the href it renders, leaving a link with no address.
const attrs = computed(() => {
  if (props.to) return { to: props.to };
  if (props.href) return { href: props.href, target: '_blank', rel: 'noopener' };
  return { type: 'button', disabled: props.disabled };
});
</script>

<template>
  <component :is="tag" v-bind="attrs" :class="classes">
    <slot />
  </component>
</template>
