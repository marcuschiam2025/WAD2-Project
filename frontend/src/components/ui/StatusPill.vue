<script setup>
// v2 Components / Pill: tinted status chip with a leading dot (neutral has no dot)
import dotSuccess from '@/assets/v2/dot-success.svg';
import dotWarning from '@/assets/v2/dot-warning.svg';
import dotDestructive from '@/assets/v2/dot-destructive.svg';
import dotInfo from '@/assets/v2/dot-info.svg';

defineProps({
  tone: { type: String, default: 'neutral' }, // success | warning | destructive | info | exempt | neutral
});

const tints = {
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-foreground',
  destructive: 'bg-destructive-tint text-destructive',
  info: 'bg-info-tint text-info',
  exempt: 'bg-exempt-tint text-exempt',
  neutral: 'bg-secondary text-secondary-foreground',
};
const dots = { success: dotSuccess, warning: dotWarning, destructive: dotDestructive, info: dotInfo };
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-[5px] rounded-full px-2.5 py-[3px] text-[12px] leading-normal font-semibold whitespace-nowrap"
    :class="tints[tone]"
  >
    <img v-if="dots[tone]" :src="dots[tone]" alt="" :class="['size-1.5', tone === 'info' && 'icon-accent']" />
    <slot />
  </span>
</template>
