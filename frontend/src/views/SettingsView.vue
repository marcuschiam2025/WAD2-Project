<script setup>
// Settings: connected apps (Gmail, Google Calendar, Outlook) and revoking access. The profile is on /profile.
import { computed, ref } from 'vue'
import { useUserStore } from '@core/stores/user'
import PageHeader from '@/components/layout/PageHeader.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import iconCan from '@/assets/v2/check-success-14.svg'
import iconCant from '@/assets/v2/x-muted-14.svg'

const user = useUserStore()

// The user store only tracks gmail / outlook consents, so Google Calendar is local state for now.
// TODO(backend): move this into user.consents once the store exposes a calendar consent.
const calendar = ref(user.consents.gmail)

// TODO(backend): replace with GET /api/users/me/connections. `key` matches user.consents.
const apps = computed(() => [
  {
    key: 'gmail',
    mark: 'M',
    name: 'Gmail',
    connectedNote: 'Connected 12 Aug 2025',
    offNote: 'For reading deadlines from your SMU inbox',
    can: 'Read emails from SMU and BOSS to find deadlines',
    cant: 'Send, delete or change any email',
    scope: 'gmail.readonly',
    status: 'Last synced 4 min ago',
    connected: user.consents.gmail,
  },
  {
    key: 'calendar',
    mark: '31',
    name: 'Google Calendar',
    connectedNote: 'Connected 12 Aug 2025',
    offNote: 'For adding deadlines to your calendar',
    can: 'Add deadlines and class times to your primary calendar',
    cant: "See or edit events it didn't create",
    scope: 'calendar.events',
    status: '23 events added',
    connected: calendar.value,
  },
  {
    key: 'outlook',
    mark: 'O',
    name: 'Outlook',
    connectedNote: 'Connected',
    offNote: 'For university Outlook inboxes',
    blurb: 'Connect to read deadlines from an Outlook inbox instead of Gmail.',
    can: 'Read emails from SMU and BOSS to find deadlines',
    cant: 'Send, delete or change any email',
    scope: 'Mail.Read',
    status: 'Syncing',
    connected: user.consents.outlook,
  },
])

// TODO(backend): call the OAuth connect / revoke endpoints before flipping local state
function setConnected(key, on) {
  if (key === 'calendar') calendar.value = on
  else user.consents[key] = on
}

function revokeAll() {
  user.revokeAccess()
  calendar.value = false
}
</script>

<template>
  <div>
    <PageHeader overline="Account · Privacy · Connected apps" title="Settings" />

    <main class="flex flex-col gap-6 px-16 pt-8 pb-12">
      <div v-enter class="flex flex-col gap-1"> <!-- motion: heading fades in on mount -->
        <h2 class="text-h3">Connected apps</h2>
        <p class="text-[14px] text-muted-foreground">BidMaxxer only reads what it needs. Disconnect any app at any time.</p>
      </div>

      <div v-stagger="0.05" class="flex items-start gap-4"> <!-- motion: app cards stagger in 50ms apart -->
        <section v-for="app in apps" :key="app.key" class="card flex min-w-0 flex-1 flex-col gap-3 p-5">
          <div class="flex items-center gap-3">
            <span class="flex w-9 shrink-0 justify-center rounded-md bg-muted py-2 text-[13px] leading-normal font-bold">
              {{ app.mark }}
            </span>
            <div class="flex min-w-0 flex-1 flex-col gap-0.5 leading-normal">
              <p class="text-[15px] font-semibold">{{ app.name }}</p>
              <p class="text-[12px] text-muted-foreground">{{ app.connected ? app.connectedNote : app.offNote }}</p>
            </div>
            <StatusPill :tone="app.connected ? 'success' : 'neutral'">{{ app.connected ? 'On' : 'Off' }}</StatusPill>
          </div>

          <template v-if="app.connected">
            <p class="text-overline text-muted-foreground">BidMaxxer can</p>
            <p class="flex items-start gap-2 text-[13px]">
              <img :src="iconCan" alt="" class="mt-px size-3.5" />{{ app.can }}
            </p>
            <p class="text-overline text-muted-foreground">BidMaxxer can't</p>
            <p class="flex items-start gap-2 text-[13px] text-muted-foreground">
              <img :src="iconCant" alt="" class="mt-px size-3.5" />{{ app.cant }}
            </p>
            <p class="font-mono text-[11px] font-medium text-muted-foreground">{{ app.scope }}</p>
          </template>
          <p v-else class="text-[13px] text-muted-foreground">
            {{ app.blurb ?? `Connect ${app.name} so BidMaxxer can use it again.` }}
          </p>

          <div class="flex items-center justify-between border-t border-border pt-3">
            <p class="text-[12px] text-muted-foreground">{{ app.connected ? app.status : 'Not connected' }}</p>
            <BaseButton v-if="app.connected" size="sm" variant="destructive-outline" @click="setConnected(app.key, false)">
              Disconnect
            </BaseButton>
            <BaseButton v-else size="sm" variant="outline" @click="setConnected(app.key, true)">Connect</BaseButton>
          </div>
        </section>
      </div>

      <section v-enter="0.15" class="card flex items-center justify-between gap-4 border-destructive! p-5"> <!-- motion: danger zone fades in, 150ms delay -->
        <div class="flex flex-col gap-0.5 leading-normal">
          <p class="text-[15px] font-semibold">Revoke all access</p>
          <p class="text-[13px] text-muted-foreground">
            Removes BidMaxxer's access to Gmail and Google Calendar immediately.
          </p>
        </div>
        <BaseButton variant="destructive-outline" @click="revokeAll">Revoke all access</BaseButton>
      </section>
    </main>
  </div>
</template>
