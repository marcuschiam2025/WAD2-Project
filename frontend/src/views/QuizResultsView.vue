<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuizStore } from '@core/stores/quiz'
import { useUserStore } from '@core/stores/user'
import { usePlannerStore } from '@core/stores/planner'
import { modules, tracks, trackName } from '@core/data/catalogue'
import { popEnter, popLeave } from '@/motion'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ProgressBar from '@/components/ui/ProgressBar.vue'
import iconSparkles from '@/assets/figma/icon-sparkles.svg'
import iconCheck from '@/assets/figma/check-success.svg'
import iconPlus from '@/assets/figma/plus-14.svg'
import chevronDown from '@/assets/v2/chevron-down.svg'
import chevronUp from '@/assets/v2/chevron-up.svg'

const route = useRoute()
const router = useRouter()
const quiz = useQuizStore()
const user = useUserStore()
const planner = usePlannerStore()

// TODO(backend): attempts come from GET /api/quiz/attempts/:id (results are [{ code, pct }] ranked by % fit)
const attempt = computed(() => quiz.attempts.find((a) => String(a.id) === route.query.attempt) ?? quiz.latest)
if (!attempt.value) router.replace('/quiz')

const expanded = ref(attempt.value?.results[0]?.code)
const toast = ref(null)
let toastTimer

// How many answers leaned most towards this track
function leaningCount(code) {
  return attempt.value.answers.filter((optIdx, qi) => {
    const opt = quiz.questions[qi].options[optIdx]
    if (!opt) return false
    return opt.weights[code] === Math.max(...Object.values(opt.weights))
  }).length
}

// TODO(backend): replace with the AI/recommender explanation from POST /api/quiz/attempts
function explain(code) {
  const t = tracks.find((x) => x.code === code)
  return `You picked ${t.short.toLowerCase()}-leaning answers in ${leaningCount(code)} of ${quiz.questions.length} questions. ${t.blurb}`
}

// TODO(backend): recommended modules come from GET /api/tracks/:code/recommendations (k-NN recommender)
const recommended = (code) => (tracks.find((t) => t.code === code)?.recommended ?? []).slice(0, 3)
const inBasket = (code) => planner.basket.includes(code)

function addToBasket(code) {
  planner.addToBasket(code)
  toast.value = code
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 3500)
}

function retake() {
  quiz.start()
  router.push('/quiz/attempt')
}
</script>

<template>
  <div v-if="attempt">
    <PageHeader
      overline="Track Quiz"
      title="Your track matches"
      :subtitle="`Hey ${user.profile.firstName}! Based on your ${quiz.questions.length} answers and completed modules, these tracks fit you best. Open a track to see why, and add recommended modules to your basket.`"
    />

    <main class="flex flex-col gap-2.5 px-16 pt-8 pb-8">
      <div v-stagger class="flex flex-col gap-2.5"> <!-- motion: result accordion rows stagger in -->
        <section
          v-for="(r, i) in attempt.results"
          :key="r.code"
          class="overflow-hidden rounded-lg border bg-card transition-colors"
          :class="expanded === r.code ? 'border-primary border-[1.5px] shadow-sm' : 'border-border'"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3.5 text-left leading-normal"
            :aria-expanded="expanded === r.code"
            @click="expanded = expanded === r.code ? null : r.code"
          >
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold">{{ i + 1 }}</span>
            <span class="flex-1 text-[15px] font-semibold">{{ trackName(r.code) }}</span>
            <ProgressBar :value="r.pct / 100" track="w-[220px] h-2 shrink-0" />
            <span class="w-11 shrink-0 text-right font-mono text-[13px] font-medium">{{ r.pct }}%</span>
            <img :src="expanded === r.code ? chevronUp : chevronDown" alt="" class="size-4" />
          </button>

          <Transition :css="false" @enter="popEnter" @leave="popLeave">
            <div v-if="expanded === r.code" class="flex flex-col gap-3 px-4 pb-4">
              <div class="flex flex-col gap-1 rounded-md bg-primary/10 px-3.5 py-2.5 text-[13px]">
                <p class="flex items-center gap-2 font-semibold text-primary">
                  <img :src="iconSparkles" alt="" class="size-3.5" /> Why {{ trackName(r.code) }}?
                </p>
                <p class="leading-5">{{ explain(r.code) }}</p>
              </div>
              <p class="text-[13px] font-semibold">Recommended modules</p>
              <div class="flex flex-col gap-2">
                <div
                  v-for="code in recommended(r.code)"
                  :key="code"
                  class="flex items-center gap-3 rounded-md border border-border px-3.5 py-2.5 text-[13px]"
                >
                  <span class="w-12 font-mono font-bold">{{ code }}</span>
                  <span class="flex-1 text-muted-foreground">{{ modules[code].name }}</span>
                  <span
                    v-if="inBasket(code)"
                    class="inline-flex items-center gap-1.5 rounded-md bg-success/14 px-2.5 py-1.5 text-[13px] font-medium text-success"
                  >
                    <img :src="iconCheck" alt="" class="size-3.5" /> In basket
                  </span>
                  <BaseButton v-else size="sm" variant="outline" @click="addToBasket(code)">
                    <img :src="iconPlus" alt="" class="size-3.5" /> Add to basket
                  </BaseButton>
                </div>
              </div>
            </div>
          </Transition>
        </section>
      </div>

      <div class="flex h-[60px] justify-end pt-4">
        <Transition :css="false" @enter="popEnter" @leave="popLeave">
          <div
            v-if="toast"
            role="status"
            class="flex w-[360px] flex-col gap-0.5 rounded-md border border-l-[3px] border-border border-l-success bg-card px-4 py-2.5 leading-normal shadow-sm"
          >
            <p class="text-[14px] font-semibold">{{ toast }} added to your basket</p>
            <p class="text-[12px] text-muted-foreground">Drag it onto a semester in the What-If Planner.</p>
          </div>
        </Transition>
      </div>

      <div class="flex items-center gap-3 border-t border-border pt-4">
        <p class="flex-1 text-[13px] text-muted-foreground">Saved modules go to your What-If Planner basket.</p>
        <BaseButton variant="ghost" @click="retake">Retake quiz</BaseButton>
        <BaseButton to="/planner">Continue to What-If Planner</BaseButton>
      </div>
    </main>
  </div>
</template>
