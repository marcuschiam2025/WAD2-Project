import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'
import { routeAccess } from './access'
import { rememberJoin, takeJoin } from '../utils/roomInvite'

// meta.layout: 'app' shows the signed-in nav bar; 'bare' shows nothing.
// meta.auth: route needs a signed-in student.
// meta.nav: which nav link is highlighted.
const routes = [
  { path: '/admin', name: 'admin', component: () => import('@/views/AdminView.vue'), meta: { layout: 'bare', auth: true, admin: true } },
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
    redirect: to => `/rooms/${to.params.id}`,
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

router.beforeEach(async (to) => {
  const user = useUserStore()
  await user.initialize()
  const access = routeAccess(to, user)
  if (access) {
    // Sent away from a join link (to sign in or onboard): keep the code for when they get back
    if (to.path === '/rooms' && to.query.join) rememberJoin(to.query.join)
    return access
  }
  if (to.meta.auth && to.name !== 'onboarding' && !to.query.join) {
    const join = takeJoin()
    if (join) return { path: '/rooms', query: { join } }
  }
})

export default router
