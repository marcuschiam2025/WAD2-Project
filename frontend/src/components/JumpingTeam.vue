<script setup>
// Five friends jumping together, built from the five separate pictures in assets/jumping (3 to 7) so each one can
// jump on its own when the pointer is over it. Every picture is 525x810, drawn at 0.93 scale and offset to form the
// group. Numbers are percentages of a 1140x780 box that
// frames the group, so the whole thing scales with whatever size it is given.
import yellow from '@/assets/jumping/3.png';
import pink from '@/assets/jumping/4.png';
import blue from '@/assets/jumping/5.png';
import green from '@/assets/jumping/6.png';
import purple from '@/assets/jumping/7.png';

// z is the stacking order from the group picture (later = in front); the arm and leg overlaps depend on it.
const friends = [
  { src: purple, left: 62.8, top: 4.4, z: 1 },
  { src: yellow, left: -1.2, top: 0.5, z: 2 },
  { src: blue, left: 31.1, top: -5.3, z: 3 },
  { src: pink, left: 14.0, top: 5.9, z: 4 },
  { src: green, left: 46.3, top: 5.6, z: 5 },
];
</script>

<template>
  <div class="team" aria-hidden="true">
    <div
      v-for="f in friends"
      :key="f.src"
      class="friend"
      :style="{ left: f.left + '%', top: f.top + '%', zIndex: f.z }"
    >
      <!-- The pictures overlap and have see-through corners, so only the middle of each figure reacts to the pointer. -->
      <div class="hit" />
      <img :src="f.src" alt="" />
    </div>
  </div>
</template>

<style scoped>
.team {
  position: relative;
  aspect-ratio: 1140 / 780;
}
.friend {
  position: absolute;
  width: 42.8%;
  pointer-events: none;
}
.friend img {
  display: block;
  width: 100%;
  height: auto;
}
.hit {
  position: absolute;
  left: 28%;
  top: 28%;
  width: 44%;
  height: 62%;
  pointer-events: auto;
  cursor: default;
}
.hit:hover + img {
  animation: hop 0.55s cubic-bezier(0.3, 0.7, 0.4, 1);
}
@keyframes hop {
  0% {
    transform: translateY(0) scale(1, 1);
  }
  15% {
    transform: translateY(0) scale(1.03, 0.96);
  }
  50% {
    transform: translateY(-12%) scale(0.98, 1.03);
  }
  100% {
    transform: translateY(0) scale(1, 1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .hit:hover + img {
    animation: none;
  }
}
</style>
