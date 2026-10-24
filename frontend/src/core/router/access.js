// UI navigation only. Backend permissions remain authoritative.
export function routeAccess(to, user) {
  if (to.meta.auth && !user.isSignedIn) return { name: 'signin' }
  const admin = user.profile?.role === 'admin'
  const home = admin ? 'admin' : user.onboarded ? 'dashboard' : 'onboarding'
  if (to.meta.admin && !admin) return { name: home }
  if (admin && (to.name === 'onboarding' || to.name === 'signin')) return { name: 'admin' }
  if (to.meta.auth && !admin && !user.onboarded && to.name !== 'onboarding') return { name: 'onboarding' }
  if (to.name === 'signin' && user.isSignedIn) return { name: home }
}
