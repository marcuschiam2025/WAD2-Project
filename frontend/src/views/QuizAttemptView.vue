<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@backend/stores/quiz'
import BaseButton from '@/components/ui/BaseButton.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'

const router = useRouter()
const quiz = useQuizStore()

const total = quiz.questions.length
const question = computed(() => quiz.questions[quiz.current])
const selected = computed(() => quiz.answers[quiz.current])
const isLast = computed(() => quiz.current === total - 1)

function next() {
  if (!isLast.value) {
    quiz.current++
    return
  }
  const attempt = quiz.submit()
  router.push(`/quiz/results?attempt=${attempt.id}`)
}
</script>

<template>
  <main class="flex flex-col gap-6 p-16">
    <header class="flex flex-col gap-3">
      <p class="text-overline text-muted-foreground">TRACK QUIZ</p>
      <h1 class="text-h2">Answer these {{ total }} questions to see your track matches</h1>
      <p class="text-body text-muted-foreground">
        We’ll rank the IS tracks based on your answers and the modules you’ve already completed.
      </p>
    </header>

    <section class="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-lg">
      <div class="flex flex-col gap-2">
        <div class="flex items-start justify-between font-medium text-muted-foreground">
          <p class="text-overline">QUESTION {{ quiz.current + 1 }} OF {{ total }} · TRACK FINDER QUIZ</p>
          <p class="font-mono text-[12px]">Q{{ quiz.current + 1 }} / {{ total }}</p>
        </div>
        <ProgressBar :value="quiz.answeredCount / total" track="h-1 w-full" />
      </div>
      <h2 class="text-h3">{{ question.prompt }}</h2>
      <p class="text-small text-muted-foreground">
        No right answers — pick what genuinely sounds fun. We match your answers to IS tracks.
      </p>

      <div class="flex flex-col gap-3" role="radiogroup">
        <button
          v-for="(opt, i) in question.options"
          :key="opt.label"
          type="button"
          role="radio"
          :aria-checked="selected === i"
          class="flex items-center gap-3 rounded-md border px-4 py-3.5 text-left text-[14px] transition-colors"
          :class="selected === i ? 'border-primary bg-primary-soft' : 'border-border bg-card hover:bg-muted'"
          @click="quiz.answer(i)"
        >
          <span
            class="flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]"
            :class="selected === i ? 'border-primary' : 'border-border'"
          >
            <span v-if="selected === i" class="size-2.5 rounded-full bg-primary" />
          </span>
          {{ opt.label }}
        </button>
      </div>

      <div class="flex items-center justify-between">
        <BaseButton variant="ghost" :disabled="quiz.current === 0" @click="quiz.current--">Back</BaseButton>
        <div class="flex gap-2.5">
          <BaseButton v-if="!isLast" variant="ghost" @click="quiz.current++">Skip</BaseButton>
          <BaseButton :disabled="isLast ? quiz.answeredCount === 0 : selected === null" @click="next">
            {{ isLast ? 'See my matches' : 'Next' }}
          </BaseButton>
        </div>
      </div>
    </section>
  </main>
</template>
