<script setup>
import { api } from '@/api/wiki.js';
import SectionContent from '@/components/section/SectionContent.vue';
import SectionConnections from '@/components/section/SectionConnections.vue';
import SectionHistoryList from '@/components/section/SectionHistoryList.vue';
import CopyLinksButton from '@/components/ui/CopyLinksButton.vue';
import PinButton from '@/components/ui/PinButton.vue';
import ConnectedSectionsModal from '@/components/section/ConnectedSectionsModal.vue';
import TagBadge from '@/components/ui/TagBadge.vue';
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue';
import { Network, FileText, Link, Clock, Share2, ArrowRight } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const section = ref(null);
const loading = ref(true);
const error = ref(null);
const activeTab = ref('content');
const hasMore = ref(false);
const loadingMore = ref(false);

const connectionsModal = ref(null);

const sectionKey = computed(() => route.params.key);
const wikiId = computed(() => route.query.wikiId || '');

watch(sectionKey, load, { immediate: true });

async function load() {
  loading.value = true;
  error.value = null;
  section.value = null;
  try {
    const data = await api.section(sectionKey.value, wikiId.value || undefined);
    section.value = data;
    hasMore.value = data.hasMore || false;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!section.value?.nextOffset) return;
  loadingMore.value = true;
  try {
    const data = await api.section(
      sectionKey.value,
      wikiId.value || undefined,
      section.value.nextOffset,
    );
    section.value.content += data.content;
    section.value.hasMore = data.hasMore;
    section.value.nextOffset = data.nextOffset;
    hasMore.value = data.hasMore || false;
  } finally {
    loadingMore.value = false;
  }
}

function navigate(key) {
  router.push({
    name: 'section',
    params: { key },
    query: wikiId.value ? { wikiId: wikiId.value } : {},
  });
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-6 py-8">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center">
      <p class="text-danger font-medium">{{ error }}</p>
      <button class="mt-3 text-[13px] text-muted hover:text-text" @click="router.back()">
        ← Go back
      </button>
    </div>

    <template v-else-if="section">
      <!-- Breadcrumbs -->
      <nav
        v-if="section.breadcrumbs?.length"
        class="flex items-center gap-1.5 text-[12px] text-muted mb-4 flex-wrap"
      >
        <span v-for="(crumb, i) in section.breadcrumbs" :key="i" class="flex items-center gap-1.5">
          <span v-if="i > 0" class="text-border">/</span>
          <span>{{ crumb }}</span>
        </span>
      </nav>

      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-start justify-between gap-4 mb-3">
          <div class="flex-1 min-w-0">
            <h1 class="text-[24px] font-bold text-heading leading-tight mb-1">
              {{ section.title }}
            </h1>
            <div class="flex items-center gap-2 flex-wrap">
              <code class="text-[12px] text-accent font-mono bg-accent/10 px-2 py-0.5 rounded">{{
                section.key
              }}</code>
              <span class="text-[12px] text-muted">{{ section.parent }}</span>
              <span
                v-if="section.accessCount"
                class="text-[11px] text-muted bg-elevated border border-border px-2 py-0.5 rounded-full font-mono"
              >
                {{ section.accessCount }}× accessed
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <PinButton
              :section-key="section.key"
              :wiki-id="section.wikiId"
              :title="section.title"
            />
            <CopyLinksButton
              :section-key="section.key"
              :wiki-id="section.wikiId"
              :incoming="true"
              :outgoing="true"
            />
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-elevated text-[12px] text-muted hover:border-accent/30 hover:text-accent hover:bg-accent/5 transition-all duration-150"
              title="View connected sections"
              @click="connectionsModal?.open()"
            >
              <Network class="w-3.5 h-3.5" />
              Read Connected
            </button>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="section.tags?.length" class="flex flex-wrap gap-1.5">
          <TagBadge v-for="tag in section.tags" :key="tag" :tag="tag" />
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 p-1 bg-surface rounded-xl border border-border mb-6 w-fit">
        <button
          v-for="tab in [
            { id: 'content', icon: FileText },
            { id: 'connections', icon: Link },
            { id: 'history', icon: Clock },
          ]"
          :key="tab.id"
          :class="[
            'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 capitalize',
            activeTab === tab.id
              ? 'bg-elevated text-accent shadow-sm'
              : 'text-muted hover:text-heading hover:bg-accent/5',
          ]"
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" class="w-3.5 h-3.5" />
          {{ tab.id }}
        </button>
      </div>

      <!-- Content tab -->
      <div v-if="activeTab === 'content'">
        <SectionContent :content="section.content" />
        <div v-if="hasMore" class="mt-6 text-center">
          <button
            class="px-6 py-2.5 rounded-lg border border-border bg-surface text-[13px] text-muted hover:text-heading hover:border-accent/30 transition-colors"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{
              loadingMore
                ? 'Loading…'
                : `Load more (${section.totalLength - section.content.length} chars remaining)`
            }}
          </button>
        </div>

        <!-- Related -->
        <div v-if="section.relatedSections?.length" class="mt-8 pt-6 border-t border-border">
          <h3
            class="flex items-center gap-1.5 text-[12px] font-semibold text-heading uppercase tracking-wider mb-3"
          >
            <Share2 class="w-3.5 h-3.5" />
            Related Sections
          </h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="rel in section.relatedSections"
              :key="rel.key"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-[13px] text-text hover:border-accent/30 hover:text-accent hover:bg-accent/5 transition-all duration-150"
              @click="navigate(rel.key)"
            >
              {{ rel.title }}
              <ArrowRight class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <!-- Connections tab -->
      <div v-else-if="activeTab === 'connections'">
        <SectionConnections
          :section-key="section.key"
          :wiki-id="section.wikiId"
          @navigate="navigate"
        />
      </div>

      <!-- History tab -->
      <div v-else-if="activeTab === 'history'">
        <SectionHistoryList :section-key="section.key" :wiki-id="section.wikiId || wikiId" />
      </div>
    </template>

    <ConnectedSectionsModal
      v-if="section"
      ref="connectionsModal"
      :section-key="section.key"
      :wiki-id="section.wikiId || wikiId"
    />
  </div>
</template>
