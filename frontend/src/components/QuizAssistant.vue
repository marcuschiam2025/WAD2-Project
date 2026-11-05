<script setup>
// Chat panel for the AI explanation of a quiz result, as a slide-out drawer or docked beside the results. It is
// read-only: the backend writes one explanation per attempt (GET /quiz/v2/attempts/:id/explanation), so there is
// nothing to type into.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import AssistantFace from '@/components/AssistantFace.vue';
import BaseButton from '@/components/ui/BaseButton.vue';

const props = defineProps({
  open: Boolean,
  docked: Boolean, // sits in the page beside the results (always visible) instead of sliding over it
  title: { type: String, default: 'Why these tracks?' },
  loading: Boolean,
  explanation: { type: Object, default: null }, // { summary, tracks: [{ track, reasoning }] }
  error: { type: String, default: null }, // an ApiError code, or 'UNREACHABLE'
  retryable: { type: Boolean, default: true },
  trackNames: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['close', 'retry']);

const closeButton = ref(null);
const scroller = ref(null);
const onKey = (event) => {
  if (event.key === 'Escape') emit('close');
};

watch(
  () => props.open,
  async (open) => {
    if (open && !props.docked) {
      window.addEventListener('keydown', onKey);
      await nextTick();
      closeButton.value?.focus();
    } else window.removeEventListener('keydown', onKey);
  },
);
// A reply that arrives while the panel is open is scrolled into view
watch(
  () => [props.loading, props.explanation, props.error],
  async () => {
    await nextTick();
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
  },
);
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Teleport to="body" :disabled="docked">
    <Transition name="assistant">
      <div v-if="open || docked" :class="docked ? 'h-full' : 'fixed inset-0 z-50 flex justify-end'">
        <!-- Dims the page on small screens only; on wide ones the results stay readable beside the panel -->
        <div
          v-if="!docked"
          class="absolute inset-0 bg-scrim lg:hidden"
          aria-hidden="true"
          @click="emit('close')"
        />
        <aside
          :role="docked ? 'complementary' : 'dialog'"
          :aria-modal="docked ? undefined : 'false'"
          :aria-label="title"
          class="flex h-full flex-col bg-card"
          :class="
            docked
              ? 'overflow-hidden rounded-2xl border border-border shadow-md'
              : 'assistant-panel relative w-full border-l border-border shadow-lg sm:w-[420px]'
          "
        >
          <header class="flex items-center gap-4 px-6 pt-6 pb-5">
            <AssistantFace :size="52" />
            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <h2 class="text-[22px] leading-tight font-bold tracking-tight">{{ title }}</h2>
              <p class="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <span class="size-1.5 rounded-full bg-success" aria-hidden="true" />AI-generated · may be
                imperfect
              </p>
            </div>
            <button
              v-if="!docked"
              ref="closeButton"
              type="button"
              class="flex size-11 shrink-0 items-center justify-center self-start rounded-full text-[16px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:size-9"
              aria-label="Close explanation"
              @click="emit('close')"
            >
              ✕
            </button>
          </header>

          <div
            ref="scroller"
            class="flex flex-1 flex-col gap-5 overflow-y-auto border-t border-border px-6 py-6"
            aria-live="polite"
          >
            <div v-if="loading" role="status" class="flex flex-col gap-3 motion-safe:animate-pulse">
              <span class="sr-only">Writing an explanation…</span>
              <div
                v-for="width in ['w-full', 'w-11/12', 'w-3/4']"
                :key="width"
                class="h-3.5 rounded-full bg-muted"
                :class="width"
                aria-hidden="true"
              />
              <div class="mt-3 h-24 rounded-xl bg-muted" aria-hidden="true" />
            </div>

            <div
              v-else-if="error"
              role="status"
              class="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm leading-6"
            >
              <p>
                <span class="font-semibold">AI explanation unavailable right now.</span> Your results are
                still based on all of your answers, so you can rely on them as a starting point for choosing
                which tracks to explore.
              </p>
              <p v-if="error === 'AI_BUSY'" class="text-xs text-muted-foreground">
                The AI service is busy. Try again in a minute.
              </p>
              <BaseButton
                v-if="retryable"
                class="self-start"
                variant="link"
                :disabled="loading"
                @click="emit('retry')"
                >Try again</BaseButton
              >
            </div>

            <template v-else-if="explanation">
              <p class="text-[15px] leading-7">{{ explanation.summary }}</p>
              <section
                v-for="item in explanation.tracks"
                :key="item.track"
                class="flex flex-col gap-1.5 rounded-xl bg-muted p-4"
              >
                <h3 class="text-overline text-muted-foreground">
                  {{ trackNames[item.track] ?? item.track }}
                </h3>
                <p class="text-sm leading-6">{{ item.reasoning }}</p>
              </section>
            </template>
          </div>

          <footer class="px-6 pt-1 pb-5 text-[11px] leading-normal text-muted-foreground">
            This assistant only explains your result. Scores and modules never depend on it.
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.assistant-enter-active,
.assistant-leave-active {
  transition: opacity 0.2s;
}
.assistant-enter-from,
.assistant-leave-to {
  opacity: 0;
}
.assistant-enter-active .assistant-panel,
.assistant-leave-active .assistant-panel {
  transition: transform 0.25s ease;
}
.assistant-enter-from .assistant-panel,
.assistant-leave-to .assistant-panel {
  transform: translateX(100%);
}
@media (prefers-reduced-motion: reduce) {
  .assistant-enter-active,
  .assistant-leave-active,
  .assistant-enter-active .assistant-panel,
  .assistant-leave-active .assistant-panel {
    transition: none;
  }
}
</style>
