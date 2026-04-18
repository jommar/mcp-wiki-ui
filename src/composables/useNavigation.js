import { ref } from 'vue';

const navigationHistory = ref([]);
const currentBreadcrumb = ref(['Home']);

export function useNavigation() {
  function pushBreadcrumb(label, route, { replace = false } = {}) {
    if (replace) {
      // Replace the entire stack — used for top-level tab switches
      navigationHistory.value = [{ label, route }];
    } else {
      // Append — used for nested navigation (clicking a node, drilling into content)
      navigationHistory.value.push({ label, route });
    }
    currentBreadcrumb.value = navigationHistory.value.map(b => b.label);
  }

  function navigateTo(index) {
    navigationHistory.value = navigationHistory.value.slice(0, index + 1);
    currentBreadcrumb.value = navigationHistory.value.map(b => b.label);
  }

  function clearHistory() {
    navigationHistory.value = [];
    currentBreadcrumb.value = ['Home'];
  }

  return { navigationHistory, currentBreadcrumb, pushBreadcrumb, navigateTo, clearHistory };
}
