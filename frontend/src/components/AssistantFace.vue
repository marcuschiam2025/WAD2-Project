<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

defineProps({ size: { type: Number, default: 44 } });

let counter = 0;
const uid = `face${++counter}-${Math.random().toString(36).slice(2, 7)}`; 
const root = ref(null);
const look = ref({ x: 0, y: 0 }); 
let frame = 0;
let last = null;

function aim() {
  frame = 0;
  if (!root.value || !last) return;
  const box = root.value.getBoundingClientRect();
  const dx = last.x - (box.left + box.width / 2);
  const dy = last.y - (box.top + box.height / 2);
  const distance = Math.hypot(dx, dy);
 
  const reach = Math.min(1, distance / 180);
  look.value = distance ? { x: (dx / distance) * reach, y: (dy / distance) * reach } : { x: 0, y: 0 };
}
function onMove(event) {
  last = { x: event.clientX, y: event.clientY };
  if (!frame) frame = requestAnimationFrame(aim); 
}

onMounted(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return; 
  window.addEventListener('pointermove', onMove, { passive: true });
});
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove);
  cancelAnimationFrame(frame);
});

const shift = (k) => `translate(${(look.value.x * k).toFixed(2)} ${(look.value.y * k).toFixed(2)})`;
</script>

<template>
  <span
    ref="root"
    class="inline-flex shrink-0"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    <svg viewBox="0 0 64 64" class="size-full overflow-visible">
      <defs>
        <radialGradient :id="`${uid}-skin`" cx="36%" cy="30%" r="78%">
          <stop offset="0" stop-color="#ffe98a" />
          <stop offset="0.55" stop-color="#ffcb2e" />
          <stop offset="1" stop-color="#f2a100" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="30" :fill="`url(#${uid}-skin)`" />
      <circle cx="32" cy="32" r="29.5" fill="none" stroke="#c97c00" stroke-opacity="0.35" />
      <!-- soft shine on the top left -->
      <ellipse
        cx="21"
        cy="13.5"
        rx="9"
        ry="4.5"
        fill="#fff"
        fill-opacity="0.38"
        :style="{ transform: `${shift(0.6)} rotate(-28deg)`, transformOrigin: '21px 13.5px' }"
      />

      <!-- cheeks -->
      <g :transform="shift(1)">
        <ellipse cx="14" cy="38" rx="5.2" ry="3.4" fill="#ff7a6b" fill-opacity="0.5" />
        <ellipse cx="50" cy="38" rx="5.2" ry="3.4" fill="#ff7a6b" fill-opacity="0.5" />
      </g>

      <!-- eyes: glossy, with a highlight that slides the opposite way for depth -->
      <g :transform="shift(2.6)">
        <g v-for="cx in [22.5, 41.5]" :key="cx" class="face-eye">
          <ellipse :cx="cx" cy="26" rx="4.3" ry="5.6" fill="#3a2205" />
          <circle :cx="cx - 1.3 - look.x * 0.8" :cy="23.6 - look.y * 0.8" r="1.7" fill="#fff" />
          <circle :cx="cx + 1.4" cy="28.2" r="0.8" fill="#fff" fill-opacity="0.7" />
        </g>
      </g>

      <!-- smile -->
      <g :transform="shift(1.4)">
        <path
          d="M22.5 40.5 Q32 51 41.5 40.5"
          fill="none"
          stroke="#7a3e00"
          stroke-width="3.2"
          stroke-linecap="round"
        />
      </g>
    </svg>
  </span>
</template>

<style scoped>
.face-eye {
  transform-box: fill-box;
  transform-origin: center;
  animation: face-blink 5.5s infinite;
}
@keyframes face-blink {
  0%,
  93%,
  100% {
    transform: scaleY(1);
  }
  96% {
    transform: scaleY(0.1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .face-eye {
    animation: none;
  }
}
</style>
