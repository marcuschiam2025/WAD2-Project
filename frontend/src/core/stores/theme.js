import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';

// Light or dark, remembered in this browser. The colours themselves live in style.css under [data-theme='dark'];
// this store only sets that attribute on <html>. index.html sets it once before the first paint so a dark page
// doesn't flash white while the app loads.
const KEY = 'bidmaxxer:theme';

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage blocked: fall back to the system setting
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref(initial());
  const isDark = computed(() => theme.value === 'dark');

  watch(
    theme,
    (value) => {
      if (typeof document !== 'undefined') document.documentElement.dataset.theme = value;
      try {
        localStorage.setItem(KEY, value);
      } catch {
        // storage blocked: the choice still applies for this visit
      }
    },
    { immediate: true },
  );

  const toggle = () => {
    theme.value = isDark.value ? 'light' : 'dark';
  };
  return { theme, isDark, toggle };
});
