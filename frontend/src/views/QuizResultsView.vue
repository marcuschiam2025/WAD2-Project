<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuizStore, quizTrackNames } from '@core/stores/quiz'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TrackScoreChart from '@/components/TrackScoreChart.vue'
import { api } from '@core/services/api'
import { usePlannerStore } from '@core/stores/planner'
import { useUserStore } from '@core/stores/user'
const route = useRoute()
const router = useRouter()
const quiz = useQuizStore()
const planner = usePlannerStore()
const user = useUserStore()
const addingModule = ref(null)
const basketNotice = ref('')
const basketActionError = ref('')
async function addModule(code) {
  const account = user.uid
  addingModule.value = code
  basketNotice.value = ''
  basketActionError.value = ''
  try {
    await planner.load()
    if (account !== user.uid) return
    if (!planner.online) throw new Error(planner.syncError || 'Could not load your saved basket. Please try again.')
    planner.addToBasket(code)
    await planner.saveBasket()
    if (account !== user.uid) return
    basketNotice.value = `${code} saved to your planner basket.`
  } catch (error) { if (account === user.uid) basketActionError.value = error.message }
  finally { addingModule.value = null }
}
async function retryBasket() {
  const account = user.uid
  basketActionError.value = ''
  try { await planner.saveBasket(); if (account === user.uid) basketNotice.value = 'Your planner basket is saved.' }
  catch (error) { if (account === user.uid) basketActionError.value = error.message }
}
watch(() => user.uid, () => { addingModule.value = null; basketNotice.value = ''; basketActionError.value = '' })
const loading = ref(true)
const moduleSuggestions = ref(null)
const moduleLoading = ref(false)
const moduleError = ref('')
const attempt = computed(() => quiz.attempts.find((a) => String(a.id) === String(route.query.attempt)) ?? (!route.query.attempt ? quiz.latest : null))
const provisional = computed(() => attempt.value?.rankingBasis === 'scenario-provisional')
const legacy = computed(() => attempt.value?.rubricVersion === 'legacy-v1')
const themes = { DATA: 'Evidence and data', BUILD: 'Building and iteration', FINANCE: 'Financial systems', CIVIC: 'Civic and environmental impact', RELIABLE: 'Reliability and risk', PEOPLE: 'People and stakeholders' }
const tied = computed(() => attempt.value?.results.filter((r) => r.rank === 1).length > 1)
const close = computed(() => { const r = attempt.value?.results; return !provisional.value && !legacy.value && !tied.value && r?.length > 1 && r[0].alignmentIndex - r[1].alignmentIndex <= 5 })
const contrasting = computed(() => {
  if (provisional.value || legacy.value || !attempt.value) return false
  const bestScenario = [...attempt.value.results].sort((a, b) => b.scenarioPreferenceIndex - a.scenarioPreferenceIndex)[0]
  return bestScenario.rank > 1
})
const topResults = computed(() => attempt.value?.results.slice(0, 2) ?? [])
const otherResults = computed(() => attempt.value?.results.slice(2) ?? [])
const summaryNote = computed(() => legacy.value ? 'Saved using the earlier quiz format.' : provisional.value ? 'Based on scenario choices; more rating evidence is needed.' : tied.value ? 'The leading tracks are tied. Display order does not break the tie.' : close.value ? 'Your leading tracks are close—explore both.' : 'Two starting points based on your answers.')
const display = (value) => typeof value === 'number' ? Math.round(value) : '—'
function retake() { if (quiz.hasDraft && !window.confirm('Replace your unfinished quiz with a new attempt?')) return; quiz.start(); router.push('/quiz/attempt') }
async function loadModules() {
  const id = attempt.value?.id
  moduleSuggestions.value = null
  moduleError.value = ''
  if (!id || legacy.value) return
  moduleLoading.value = true
  try {
    const suggestions = await api.quizModulesV2(id)
    if (attempt.value?.id === id) moduleSuggestions.value = suggestions
  } catch {
    if (attempt.value?.id === id) moduleError.value = 'Module suggestions could not load.'
  } finally { if (attempt.value?.id === id) moduleLoading.value = false }
}
watch(() => attempt.value?.id, loadModules, { immediate: true })
const modulesFor = (track) => moduleSuggestions.value?.groups.find((group) => group.track === track)?.modules ?? []
onMounted(async () => { await quiz.initialize(); loading.value = false })
</script>
<template>
  <div>
    <PageHeader class="quiz-header" overline="Track Finder" title="Your tracks to explore" subtitle="Start with these two. Open the details when you need them." />
    <main class="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 sm:px-12">
      <p v-if="loading" role="status">Loading your saved result…</p>
      <div v-else-if="!attempt" class="card p-6">
        <p>{{ quiz.error || 'This result is no longer in your latest two attempts.' }}</p>
        <BaseButton class="mt-3" to="/quiz">Back to Track Finder</BaseButton>
      </div>
      <template v-else>
        <div>
          <h2 class="text-h4">{{ provisional ? 'Two tracks to explore provisionally' : 'Your leading tracks' }}</h2>
          <p class="mt-1 text-sm text-muted-foreground">{{ summaryNote }}</p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <section v-for="(result, index) in topResults" :key="result.track" class="card flex flex-col gap-3 border-primary p-6">
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs font-medium text-muted-foreground">{{ legacy ? `Position ${index + 1}` : `Rank ${result.rank}` }}</span>
              <span class="font-mono text-xl font-semibold">{{ legacy ? `${display(result.pct)}%` : provisional ? 'Provisional' : `${display(result.alignmentIndex)} /100` }}</span>
            </div>
            <h3 class="text-xl font-semibold leading-7">{{ quizTrackNames[result.track] ?? result.track }}</h3>
            <span class="text-xs text-muted-foreground">{{ legacy ? 'Earlier match score' : provisional ? 'Scenario preference ordering' : 'Quiz alignment index' }}</span>
            <div v-if="modulesFor(result.track).length" class="mt-2 border-t border-border pt-4">
              <h4 class="mb-3 text-sm font-semibold">Modules to explore</h4>
              <ul class="flex flex-col gap-4">
                <li v-for="module in modulesFor(result.track)" :key="module.code">
                  <a :href="module.sourceUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">{{ module.code }} · {{ module.name }} ↗</a>
                  <p class="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{{ module.summary }}</p>
                  <BaseButton class="mt-2" size="sm" variant="outline"
                    :disabled="addingModule !== null || planner.basketSaving || (planner.basket.includes(module.code) && !planner.basketError)"
                    @click="addModule(module.code)">
                    {{ addingModule === module.code ? 'Saving…' : planner.basket.includes(module.code) ? (planner.basketSaving ? 'Saving…' : planner.basketError ? 'Retry save' : 'In planner basket') : 'Add to planner basket' }}
                  </BaseButton>
                </li>
              </ul>
              <details class="mt-3 text-xs">
                <summary class="cursor-pointer text-muted-foreground">Why these modules?</summary>
                <ul class="mt-2 flex flex-col gap-2"><li v-for="module in modulesFor(result.track)" :key="module.code"><span class="font-medium">{{ module.code }}:</span> {{ module.reason }} <span v-if="module.prerequisiteStatus === 'manual-review'">Additional course rules need checking.</span></li></ul>
              </details>
            </div>
            <p v-else-if="moduleSuggestions && moduleSuggestions.intakeStatus !== 'unsupported'" class="text-xs text-muted-foreground">{{ moduleSuggestions.catalogueStatus === 'unavailable' ? 'The shared course catalogue is incomplete or has not been loaded.' : 'No courses match your recorded completion and prerequisite information for this track.' }}</p>
          </section>
        </div>

        <p v-if="basketNotice" role="status" class="text-sm text-primary">{{ basketNotice }}</p>
        <div v-if="basketActionError || planner.basketError" role="alert" class="flex flex-wrap items-center gap-3 text-sm">
          <p>{{ basketActionError || planner.basketError }}</p>
          <BaseButton variant="link" :disabled="planner.basketSaving" @click="retryBasket">Retry saving basket</BaseButton>
        </div>
        <p v-if="moduleLoading" role="status" class="text-xs text-muted-foreground">Finding modules to explore…</p>
        <div v-if="moduleError" class="flex flex-wrap items-center gap-3 text-sm" role="status"><p>{{ moduleError }}</p><BaseButton variant="link" @click="loadModules">Retry modules</BaseButton></div>
        <p v-if="moduleSuggestions" class="text-xs text-muted-foreground">
          {{ moduleSuggestions.intakeStatus === 'unsupported' ? 'This module guide covers AY2025 onwards. Check the curriculum for your intake.' : 'Shared IS AY2025 catalogue · Recorded prerequisites checked; other course rules and current offerings need checking in OASIS/BOSS.' }}
          <a :href="moduleSuggestions.sourceUrl" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">Official SMU curriculum ↗</a>
        </p>

        <details v-if="otherResults.length" class="card p-5">
          <summary class="cursor-pointer text-sm font-medium">Compare all four tracks</summary>
          <div class="mt-4 flex flex-col divide-y divide-border">
            <div v-for="(result, index) in attempt.results" :key="result.track" class="flex items-center justify-between gap-4 py-3 text-sm">
              <span>{{ legacy ? index + 1 : result.rank }}. {{ quizTrackNames[result.track] ?? result.track }}</span>
              <span class="shrink-0 font-mono">{{ legacy ? `${display(result.pct)}%` : provisional ? `${display(result.scenarioPreferenceIndex)} /100 scenario` : `${display(result.alignmentIndex)} /100` }}</span>
            </div>
          </div>
        </details>

        <details v-if="!legacy" class="card p-5">
          <summary class="cursor-pointer text-sm font-medium">Understand your results</summary>
          <div class="mt-4 flex flex-col gap-5">
            <p class="text-sm text-muted-foreground">Alignment summarises your self-reported preferences and confidence, not ability or a probability of success. Scores are rounded; ranking uses full precision.</p>
            <p v-if="provisional" class="text-sm">No informative ratings for: {{ attempt.missingThemes.map((theme) => themes[theme]).join(', ') }}. Your ordering uses scenarios only.</p>
            <p v-if="contrasting" class="text-sm">Your scenario choices point toward a different track from your ratings. Consider both views.</p>
            <section>
              <h3 class="text-sm font-semibold">Rating themes</h3>
              <dl class="mt-2 grid gap-2 sm:grid-cols-2">
                <div v-for="(rating, theme) in attempt.themeRatings" :key="theme" class="rounded-md bg-muted p-3">
                  <dt class="text-sm">{{ themes[theme] }}</dt>
                  <dd class="text-sm font-medium">{{ rating.index === null ? 'No evidence yet' : `${display(rating.index)} /100` }} <span class="text-xs font-normal text-muted-foreground">· {{ rating.informativeCount }}/2 ratings</span></dd>
                </div>
              </dl>
            </section>
            <section>
              <h3 class="text-sm font-semibold">Scenario preferences by track</h3>
              <div class="mt-3"><TrackScoreChart :results="attempt.results" /></div>
            </section>
            <p class="text-xs text-muted-foreground">Scenario indices compare your choices with the options offered; they are separate from rating alignment.</p>
          </div>
        </details>

        <details v-if="!legacy" class="card p-5">
          <summary class="cursor-pointer text-sm font-medium">Review your answers</summary>
          <ol class="mt-4 flex flex-col gap-4">
            <li v-for="answer in attempt.answerLabels" :key="answer.questionId"><p class="text-sm font-medium">{{ answer.prompt }}</p><p class="text-sm text-muted-foreground">{{ answer.label ?? 'Skipped' }}</p></li>
          </ol>
        </details>
        <div class="flex flex-wrap gap-3 border-t border-border pt-4">
          <BaseButton to="/planner">Open What-If Planner</BaseButton>
          <BaseButton variant="outline" to="/quiz">Quiz history</BaseButton>
          <BaseButton variant="ghost" :disabled="quiz.loading" @click="retake">Retake quiz</BaseButton>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.quiz-header { padding-inline: clamp(1.25rem, 5vw, 3rem); }
</style>
