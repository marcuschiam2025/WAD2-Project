<script setup>
import { ref } from 'vue';
import yellow from '@/assets/jumping/3.png';
import pink from '@/assets/jumping/4.png';
import blue from '@/assets/jumping/5.png';
import green from '@/assets/jumping/6.png';
import purple from '@/assets/jumping/7.png';

// Spatial coordinates (x center percentage) left-to-right:
// Yellow (~20%), Pink (~35%), Blue (~52%), Green (~68%), Purple (~84%)
const friends = [
  { id: 'yellow', src: yellow, left: -1.2, top: 0.5, z: 2, centerX: 20 },
  { id: 'pink', src: pink, left: 14.0, top: 5.9, z: 4, centerX: 35 },
  { id: 'blue', src: blue, left: 31.1, top: -5.3, z: 3, centerX: 52 },
  { id: 'green', src: green, left: 46.3, top: 5.6, z: 5, centerX: 68 },
  { id: 'purple', src: purple, left: 62.8, top: 4.4, z: 1, centerX: 84 },
];

const teamRef = ref(null);
const activeX = ref(null);

function handleMouseMove(event) {
  if (!teamRef.value) return;
  const rect = teamRef.value.getBoundingClientRect();
  // Calculate cursor X relative position as a percentage (0 to 100)
  const relativeX = ((event.clientX - rect.left) / rect.width) * 100;
  activeX.value = relativeX;
}

function handleMouseLeave() {
  activeX.value = null;
}

/**
 * Calculates dynamic vertical lift offset (-15% max translateY) 
 * based on how close the cursor X is to each friend's center X.
 */
function getOffsetStyle(friendX) {
  if (activeX.value === null) {
    return { transform: 'translateY(0%) scale(1, 1)' };
  }

  const distance = Math.abs(activeX.value - friendX);
  // Influence distance threshold (within 30% width of cursor)
  const maxDistance = 30; 

  if (distance >= maxDistance) {
    return { transform: 'translateY(0%) scale(1, 1)' };
  }

  // Smooth continuous bell curve ratio (1 at exact hover, tapering to 0)
  const influence = Math.cos((distance / maxDistance) * (Math.PI / 2));
  
  // Max lift is -14% top translation
  const lift = -14 * influence;
  // Subtle squash/stretch scaling based on height
  const scaleY = 1 + 0.05 * influence;
  const scaleX = 1 - 0.03 * influence;

  return {
    transform: `translateY(${lift}%) scale(${scaleX}, ${scaleY})`,
  };
}
</script>

<template>
  <div
    ref="teamRef"
    class="team"
    aria-hidden="true"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <div
      v-for="f in friends"
      :key="f.id"
      class="friend"
      :style="{ left: f.left + '%', top: f.top + '%', zIndex: f.z }"
    >
      <img
        :src="f.src"
        alt=""
        :style="getOffsetStyle(f.centerX)"
      />
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
  will-change: transform;
  /* Smooth CSS transition as the mouse slides across */
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.4, 1);
}
</style>