<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@core/stores/user';
import { useCatalogueStore } from '@core/stores/catalogue';
import { useThemeStore } from '@core/stores/theme';
import { api } from '@/core/services/api';
import { parseBalance } from '@core/utils/balance';

import { popEnter, popLeave } from '@/motion';
import BrandLogo from './BrandLogo.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import iconBell from '@/assets/v2/bell.svg';
import iconProfile from '@/assets/v2/user.svg';
import iconSettings from '@/assets/v2/settings.svg';
import iconLogout from '@/assets/v2/logout.svg';

const route = useRoute();
const router = useRouter();
const user = useUserStore();
const catalogue = useCatalogueStore();
const theme = useThemeStore();

const links = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard' },
  { key: 'quiz', label: 'Track Quiz', to: '/quiz' },
  { key: 'planner', label: 'What-If Planner', to: '/planner' },
  { key: 'bidding', label: 'Bidding Planner', to: '/bidding' },
  { key: 'rooms', label: 'Collab Rooms', to: '/rooms' },
];

// quiz-results has no meta.nav in the shared router, so fall back to the path
const activeKey = computed(() => route.meta.nav ?? (route.path.startsWith('/quiz') ? 'quiz' : null));

const menuOpen = ref(false);
const navOpen = ref(false); // hamburger drawer below md
// The track quiz is for majors with tracks
const showQuiz = computed(() =>
  catalogue.tracksApply(catalogue.majorIdFor(user.profile.major, user.profile.intakeYear)),
);
watch(
  () => user.onboarded,
  (onboarded) => onboarded && catalogue.load(),
  { immediate: true },
);
const allLinks = computed(() => [
  ...links.filter((link) => link.key !== 'quiz' || showQuiz.value),
  ...(user.profile.role === 'admin' ? [{ key: 'admin', label: 'Admin', to: '/admin' }] : []),
]);
watch(
  () => route.fullPath,
  () => (navOpen.value = false),
);
const menuRef = ref(null);
const notifOpen = ref(false);
const notifRef = ref(null);
const notifications = ref([]);
const showRead = ref(false);
const nextNotifications = ref(null);
const notificationsLoading = ref(false);
const notificationsError = ref('');
const readingNotifications = ref(new Set());
let notificationRequest = 0;

const filteredNotifications = computed(() => {
  // 1. Filter out read items if 'showRead' is false
  const list = showRead.value ? [...notifications.value] : notifications.value.filter((n) => !n.read);

  // 2. Sort: Unread (false) comes before Read (true)
  return list.sort((a, b) => Number(a.read) - Number(b.read));
});

const isEditing = ref(false);
const creditInput = ref(null);
const balanceDraft = ref('');
const balanceError = ref('');

const startEdit = async () => {
  if (isEditing.value) return; // the input sits inside the clickable pill
  balanceDraft.value = String(user.balance);
  balanceError.value = '';
  isEditing.value = true;
  await nextTick();
  creditInput.value.focus();
};

const saveEdit = async () => {
  if (!isEditing.value) return;
  isEditing.value = false;

  // Blank or invalid input keeps the balance as it was
  const newBalance = parseBalance(balanceDraft.value);
  if (newBalance === null) {
    balanceError.value = ''//'Enter a number, 0 or more';
    return;
  }

  try {
    // Saving updates user.balance from the backend's reply, so a failed save changes nothing
    await user.save({ balance: newBalance });
  } catch (error) {
    console.error('Failed to save balance:', error);
    balanceError.value = 'Balance not saved';
  }
};

const unreadCount = ref(0);
const hasReadNotifications = computed(() => notifications.value.some((n) => n.read));

async function loadNotifications(more = false) {
  if (more && !nextNotifications.value) return;
  const request = ++notificationRequest;
  notificationsLoading.value = true;
  notificationsError.value = '';
  try {
    const res = await api.notifications(more ? nextNotifications.value : undefined);
    if (request !== notificationRequest) return;
    const list = Array.isArray(res) ? res : res?.notifications || res?.data || [];

    notifications.value = more
      ? [...new Map([...notifications.value, ...list].map((n) => [n._id || n.id, n])).values()]
      : list;
    nextNotifications.value = res?.next ?? null;
    unreadCount.value = Number.isInteger(res?.unreadCount)
      ? res.unreadCount
      : notifications.value.filter((n) => !n.read).length;
  } catch (error) {
    if (request !== notificationRequest) return;
    notificationsError.value = 'Could not load notifications. Please try again.';
    console.error('Failed to load notifications:', error);
  } finally {
    if (request === notificationRequest) notificationsLoading.value = false;
  }
}

watch(notifOpen, (open) => {
  if (open) loadNotifications();
});

async function handleNotifClick(n) {
  const id = n._id || n.id;
  if (readingNotifications.value.has(id)) return;
  notificationsError.value = '';
  if (!n.read) {
    readingNotifications.value.add(id);
    try {
      await api.markNotificationRead(id);
      const current = notifications.value.find((item) => (item._id || item.id) === id);
      if (current && !current.read) {
        current.read = true;
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
      n.read = true;
      // A refresh racing this update must not restore the old unread state or count.
      if (notificationsLoading.value || !current) await loadNotifications();
    } catch (error) {
      notificationsError.value = 'Could not mark this notification as read. Please try again.';
      console.error('Failed to mark notification as read:', error);
      return;
    } finally {
      readingNotifications.value.delete(id);
    }
  }

  notifOpen.value = false;
  if (n.link) {
    router.push(n.link);
  }
}

function onDocClick(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) menuOpen.value = false;
  if (notifRef.value && !notifRef.value.contains(e.target)) notifOpen.value = false;
}
onMounted(() => {
  document.addEventListener('click', onDocClick);
  loadNotifications();
});

onBeforeUnmount(() => document.removeEventListener('click', onDocClick));

function go(path) {
  menuOpen.value = false;
  router.push(path);
}

async function logOut() {
  menuOpen.value = false;
  await user.signOut();
  router.push('/');
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-border bg-card">
    <div class="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
      <div class="flex shrink-0 items-center gap-3 md:gap-4 xl:gap-8">
        <button
          type="button"
          class="flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-muted md:hidden"
          :aria-expanded="navOpen"
          @click.stop="navOpen = !navOpen"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path v-if="navOpen" d="M6 6l12 12M18 6L6 18" />
            <path v-else d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <BrandLogo to="/dashboard" class="max-lg:[&>span]:hidden" />
        <nav class="hidden items-start gap-3 md:flex lg:gap-6">
          <RouterLink
            v-for="link in allLinks"
            :key="link.key"
            :to="link.to"
            class="relative border-b-2 pt-[22px] pb-5 text-[13px] leading-normal whitespace-nowrap transition-colors lg:text-[14px]"
            :class="
              activeKey === link.key
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            "
          >
            {{ link.label }}
          </RouterLink>
        </nav>
      </div>

      <div class="flex shrink-0 items-center gap-2 lg:gap-4">
        <div class="flex shrink-0 items-center gap-2 lg:gap-4">
          <!-- The student's whole balance -->
          <div
            title="Your e$ balance"
            class="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 leading-normal whitespace-nowrap cursor-pointer hover:bg-secondary/80 transition-colors"
            @click="startEdit"
          >
            <!-- Display Mode -->
            <span v-if="!isEditing" class="font-mono text-[12.5px] font-bold">
              e$
              {{
                user.balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }}
            </span>

            <!-- Edit Mode -->
            <input
              v-else
              ref="creditInput"
              v-model="balanceDraft"
              @blur="saveEdit"
              @keyup.enter="saveEdit"
              type="text"
              class="font-mono text-[12.5px] font-bold bg-transparent outline-none border-b border-foreground/30 w-16 text-foreground"
            />
            <span class="hidden text-[12px] text-muted-foreground xl:inline"> balance </span>
            <span v-if="balanceError" role="alert" class="text-[12px] text-destructive">
              {{ balanceError }}
            </span>
          </div>
        </div>
        <div ref="notifRef" class="relative">
          <button
            type="button"
            :aria-expanded="notifOpen"
            class="relative block size-8 rounded-full hover:bg-muted"
            @click="
              notifOpen = !notifOpen;
              menuOpen = false;
            "
          >
            <img :src="iconBell" alt="" class="size-8" />
            <span
              v-if="unreadCount > 0"
              class="absolute top-[5px] right-[5px] size-2 rounded-full border border-card bg-destructive"
            />
          </button>

          <!-- ================================================================
================================================================
================================================================
================================================================
================================================================ -->

          <Transition :css="false" @enter="popEnter" @leave="popLeave">
            <div
              v-if="notifOpen"
              class="absolute top-11 right-0 z-50 flex w-80 max-w-[calc(100vw-2rem)] origin-top-right flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-md"
            >
              <!-- Top Bar Header -->
              <div class="flex items-center justify-between border-b border-border pb-2">
                <p class="text-overline text-muted-foreground">
                  Notifications
                  <span v-if="unreadCount">({{ unreadCount }} unread)</span>
                </p>

                <!-- Only one 'See read' button here -->
                <button
                  v-if="hasReadNotifications"
                  type="button"
                  class="text-[12px] font-medium text-primary hover:underline focus:outline-none"
                  @click="showRead = !showRead"
                >
                  {{ showRead ? 'Hide read' : 'See read notifications' }}
                </button>
              </div>

              <!-- Active List -->
              <ul v-if="filteredNotifications.length" class="flex max-h-80 flex-col gap-1 overflow-y-auto">
                <li
                  v-for="n in filteredNotifications"
                  :key="n._id || n.id"
                  :aria-busy="readingNotifications.has(n._id || n.id)"
                  class="flex flex-col rounded-md p-2 text-[13px] transition-colors hover:bg-muted cursor-pointer"
                  :class="!n.read ? 'font-semibold bg-muted/40' : 'font-normal text-muted-foreground'"
                  @click="handleNotifClick(n)"
                >
                  <span class="leading-snug">{{ n.message || n.text }}</span>
                  <span
                    v-if="readingNotifications.has(n._id || n.id)"
                    class="mt-1 text-[11px] text-muted-foreground"
                    >Marking as read…</span
                  >
                  <span v-if="n.createdAt" class="mt-1 text-[11px] text-muted-foreground font-normal">
                    {{
                      new Date(n.createdAt).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    }}
                  </span>
                </li>
              </ul>

              <!-- Empty States -->
              <p v-else-if="notificationsLoading" role="status" class="text-[13px] text-muted-foreground">
                Loading notifications…
              </p>
              <p
                v-else-if="unreadCount === 0 && !showRead && !notificationsError"
                class="text-[13px] text-muted-foreground"
              >
                You're all caught up.
              </p>

              <p
                v-else-if="nextNotifications && unreadCount > 0 && !showRead"
                class="text-[13px] text-muted-foreground"
              >
                Older unread notifications are available. Load more to view them.
              </p>
              <p v-else class="text-[13px] text-muted-foreground">No notifications available.</p>
              <p v-if="notificationsError" role="alert" class="text-[13px] text-destructive">
                {{ notificationsError }}
                <button
                  type="button"
                  class="underline"
                  :disabled="notificationsLoading"
                  @click="loadNotifications()"
                >
                  Reload
                </button>
              </p>
              <button
                v-if="nextNotifications"
                type="button"
                class="self-center text-[12px] font-medium text-primary hover:underline disabled:opacity-50"
                :disabled="notificationsLoading"
                @click="loadNotifications(true)"
              >
                {{ notificationsLoading ? 'Loading…' : 'Load more' }}
              </button>
            </div>
          </Transition>

          <!-- ================================================================
================================================================
================================================================
================================================================
================================================================ -->
        </div>
        <button
          type="button"
          class="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          :aria-pressed="theme.isDark"
          :title="theme.isDark ? 'Light mode' : 'Dark mode'"
          @click="theme.toggle()"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-[18px]"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <g v-if="theme.isDark">
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
              />
            </g>
            <path v-else d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
        <div ref="menuRef" class="relative">
          <button
            type="button"
            :aria-expanded="menuOpen"
            class="block rounded-full"
            @click="
              menuOpen = !menuOpen;
              notifOpen = false;
            "
          >
            <UserAvatar :initials="user.profile.initials" :size="32" you />
          </button>
          <!-- Overlay / Avatar menu -->
          <Transition :css="false" @enter="popEnter" @leave="popLeave">
            <div
              v-if="menuOpen"
              class="absolute top-11 right-0 flex w-48 origin-top-right flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-md"
            >
              <button
                type="button"
                class="flex items-center gap-2.5 rounded-sm p-2.5 text-left text-[14px] hover:bg-muted"
                @click="go('/profile')"
              >
                <img :src="iconProfile" alt="" class="icon-accent size-4" />
                Profile
              </button>
              <button
                type="button"
                class="flex items-center gap-2.5 rounded-sm p-2.5 text-left text-[14px] hover:bg-muted"
                @click="go('/settings')"
              >
                <img :src="iconSettings" alt="" class="icon-accent size-4" />
                Settings
              </button>
              <div class="h-px bg-border" />
              <button
                type="button"
                class="flex items-center gap-2.5 rounded-sm p-2.5 text-left text-[14px] hover:bg-muted"
                @click="logOut"
              >
                <img :src="iconLogout" alt="" class="size-4" /> Log out
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
    <!-- Mobile / tablet nav drawer -->
    <nav v-if="navOpen" class="flex flex-col border-t border-border px-4 py-2 md:hidden">
      <RouterLink
        v-for="link in allLinks"
        :key="link.key"
        :to="link.to"
        class="rounded-md px-3 py-3 text-[14px]"
        :class="
          activeKey === link.key
            ? 'bg-primary-tint font-medium text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        "
        >{{ link.label }}</RouterLink
      >
    </nav>
  </header>
</template>
