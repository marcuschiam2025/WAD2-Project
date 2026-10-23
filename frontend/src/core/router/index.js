import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

// meta.layout: 'app' shows the signed-in nav bar; 'bare' shows nothing.
// meta.auth: route needs a signed-in student.
// meta.nav: which nav link is highlighted.
const routes = [
  { path: '/', name: 'landing', component: () => import('@/views/LandingView.vue'), meta: { layout: 'bare' } },
  { path: '/signin', name: 'signin', component: () => import('@/views/SignInView.vue'), meta: { layout: 'bare' } },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/OnboardingView.vue'),
    meta: { layout: 'bare', auth: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { layout: 'app', auth: true, nav: 'dashboard' },
  },
  {
    path: '/planner',
    name: 'planner',
    component: () => import('@/views/PlannerView.vue'),
    meta: { layout: 'app', auth: true, nav: 'planner' },
  },
  {
    path: '/bidding',
    name: 'bidding',
    component: () => import('@/views/BiddingView.vue'),
    meta: { layout: 'app', auth: true, nav: 'bidding' },
  },
  {
    path: '/bidding/finalised',
    name: 'bidding-finalised',
    component: () => import('@/views/FinalisedPlansView.vue'),
    meta: { layout: 'app', auth: true, nav: 'bidding' },
  },
  {
    path: '/quiz',
    name: 'quiz',
    component: () => import('@/views/QuizView.vue'),
    meta: { layout: 'app', auth: true, nav: 'quiz' },
  },
  {
    path: '/quiz/attempt',
    name: 'quiz-attempt',
    component: () => import('@/views/QuizAttemptView.vue'),
    meta: { layout: 'app', auth: true, nav: 'quiz' },
  },
  {
    path: '/quiz/results',
    name: 'quiz-results',
    component: () => import('@/views/QuizResultsView.vue'),
    meta: { layout: 'bare', auth: true },
  },
  {
    path: '/rooms',
    name: 'rooms',
    component: () => import('@/views/RoomsView.vue'),
    meta: { layout: 'app', auth: true, nav: 'rooms' },
  },
  {
    path: '/rooms/new',
    name: 'room-create',
    component: () => import('@/views/RoomCreateView.vue'),
    meta: { layout: 'app', auth: true, nav: 'rooms' },
  },
  {
    path: '/rooms/:id',
    name: 'room-detail',
    component: () => import('@/views/RoomDetailView.vue'),
    meta: { layout: 'app', auth: true, nav: 'rooms' },
  },
  {
    path: '/rooms/:id/votes',
    name: 'room-votes',
    component: () => import('@/views/RoomVotesView.vue'),
    meta: { layout: 'app', auth: true, nav: 'rooms' },
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
    meta: { layout: 'app', auth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { layout: 'app', auth: true },
  },
  // Degree details are edited inline on the profile page now
  { path: '/profile/degree', redirect: '/profile' },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  const user = useUserStore()
  if (to.meta.auth && !user.isSignedIn) return { name: 'signin' }
  // Nobody gets into the app before finishing onboarding
  if (to.meta.auth && !user.onboarded && to.name !== 'onboarding') return { name: 'onboarding' }
  if (to.name === 'signin' && user.isSignedIn) return { name: user.onboarded ? 'dashboard' : 'onboarding' }
})

export default router
