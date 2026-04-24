const STORAGE_KEY = 'wiki-pinned-sections';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

// Module-level singleton so all components share the same state
const pinned = ref(load());

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned.value));
}

export function usePinnedSections() {
  function isPinned(key, wikiId) {
    return pinned.value.some((p) => p.key === key && p.wikiId === (wikiId || ''));
  }

  function pin(section) {
    const wikiId = section.wikiId || '';
    if (!isPinned(section.key, wikiId)) {
      pinned.value = [
        { key: section.key, wikiId, title: section.title, pinnedAt: Date.now() },
        ...pinned.value,
      ];
      save();
    }
  }

  function unpin(key, wikiId) {
    pinned.value = pinned.value.filter((p) => !(p.key === key && p.wikiId === (wikiId || '')));
    save();
  }

  function toggle(section) {
    if (isPinned(section.key, section.wikiId)) {
      unpin(section.key, section.wikiId);
    } else {
      pin(section);
    }
  }

  return { pinned, isPinned, pin, unpin, toggle };
}
