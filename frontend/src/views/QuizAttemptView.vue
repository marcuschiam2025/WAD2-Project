<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { animate } from 'motion'
import { useQuizStore } from '@backend/stores/quiz'
import { ease } from '@/motion'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const router = useRouter()
const quiz = useQuizStore()

// TODO(backend): questions come from the quiz store (@backend/data/quiz) — swap for GET /api/quiz/questions
const total = quiz.questions.length
const question = computed(() => quiz.questions[quiz.current])
const selected = computed(() => quiz.answers[quiz.current])
const isLast = computed(() => quiz.current === total - 1)

const direction = ref(1)
function back() {
  if (quiz.current === 0) return router.push('/quiz')
  direction.value = -1
  quiz.current--
}
function next() {
  if (selected.value === null) return
  if (!isLast.value) {
    direction.value = 1
    quiz.current++
    return
  }
  const attempt = quiz.submit()
  router.push(`/quiz/results?attempt=${attempt.id}`)
}

// Keyboard: 1–4 picks an answer, Enter continues
function onKey(e) {
  const n = Number(e.key)
  if (n >= 1 && n <= question.value.options.length) quiz.answer(n - 1)
  else if (e.key === 'Enter') next()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function onEnter(el, done) {
  animate(el, { opacity: [0, 1], x: [20 * direction.value, 0] }, { duration: 0.25, ease }).then(done)
}
</script>

<template>
  <div>
    <PageHeader
      overline="Track Quiz"
      title="Find your best-fit IS track"
      :subtitle="`Answer ${total} questions. We rank the IS tracks using your answers and the modules you have completed.`"
    />

    <main class="flex flex-col items-center gap-8 px-16 pt-8 pb-12">
      <section v-enter class="card flex w-[560px] max-w-full flex-col gap-4 p-6"> <!-- motion: question card fades in on mount -->
        <div class="flex gap-1">
          <span v-for="i in total" :key="i" class="relative h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              class="absolute inset-0 origin-left bg-primary transition-transform duration-300"
              :class="i - 1 <= quiz.current ? 'scale-x-100' : 'scale-x-0'"
            />
          </span>
        </div>

        <Transition mode="out-in" :css="false" @enter="onEnter">
          <div :key="quiz.current" class="flex flex-col gap-4">
            <p class="text-overline text-muted-foreground">Question {{ quiz.current + 1 }} of {{ total }}</p>
            <h2 class="text-[20px] leading-7 font-semibold">{{ question.prompt }}</h2>
            <p class="text-[13px] text-muted-foreground">No right answers. Pick what genuinely sounds fun.</p>

            <div class="flex flex-col gap-3.5" role="radiogroup">
              <button
                v-for="(opt, i) in question.options"
                :key="opt.label"
                type="button"
                role="radio"
                :aria-checked="selected === i"
                class="flex items-center gap-3 rounded-md border px-3.5 py-3 text-left text-[14px] leading-normal transition-colors"
                :class="selected === i ? 'border-primary bg-primary/8' : 'border-border bg-card hover:bg-muted'"
                @click="quiz.answer(i)"
              >
                <span
                  class="flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors"
                  :class="selected === i ? 'border-primary bg-primary' : 'border-border'"
                >
                  <span v-if="selected === i" class="size-1.5 rounded-full bg-card" />
                </span>
                <span class="flex-1">{{ opt.label }}</span>
                <span class="rounded-[4px] border border-border px-1.5 font-mono text-[11px] text-muted-foreground">{{ i + 1 }}</span>
              </button>
            </div>
          </div>
        </Transition>

        <div class="flex items-center justify-between border-t border-border pt-3">
          <BaseButton variant="ghost" size="sm" @click="back">Back</BaseButton>
          <BaseButton size="sm" :disabled="selected === null" @click="next">
            {{ isLast ? 'See my matches' : 'Next question' }}
          </BaseButton>
        </div>
      </section>
      <p class="text-[12px] text-muted-foreground">Press 1–{{ question.options.length }} to choose an answer and Enter to continue.</p>
    </main>
  </div>
</template>
