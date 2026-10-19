<script setup>
import { onBeforeUnmount, onMounted } from 'vue'

defineProps({
  width: { type: String, default: 'w-[520px]' },
})
const emit = defineEmits(['close'])

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" @click.self="emit('close')">
      <div
        role="dialog"
        aria-modal="true"
        class="flex max-w-full flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-lg"
        :class="width"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>
