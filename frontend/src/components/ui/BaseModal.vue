<script setup>
// Centered overlay shell. Fades the scrim and springs the panel in on open (Motion).
import { onBeforeUnmount, onMounted } from 'vue'
import { overlayEnter } from '@/motion'

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
    <Transition appear :css="false" @enter="overlayEnter">
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4" @click.self="emit('close')">
        <div
          data-panel
          role="dialog"
          aria-modal="true"
          class="flex max-h-full max-w-full flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg"
          :class="width"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
