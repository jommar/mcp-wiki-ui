# AGENTS.md

## Project Context

This is **wiki-ui** — a Vue 3 + Vite application with an Express backend for wiki content visualization and management. The primary feature is an interactive D3.js knowledge graph with clustering, focus mode, and animated backgrounds.

## Tech Stack

- **Frontend**: Vue 3 (Composition API, `<script setup>`), Vue Router 4
- **Build**: Vite 8
- **Visualization**: D3.js 7
- **Markdown**: Marked 18, Mermaid 11, Highlight.js 11
- **Backend**: Express 5
- **Database**: PostgreSQL (via `pg`)

## Architecture

```
src/
├── api/             # Frontend API client (wikiApi)
├── components/      # Reusable Vue components (GlobalSearch, CopyLinksButton, ConnectedSectionsButton, etc.)
├── composables/     # Vue composition functions (useGlobalSearch, etc.)
├── router/          # Vue Router config
├── views/           # Page components (KnowledgeGraph, SectionViewer, SearchDashboard, etc.)
├── App.vue          # Root component
├── main.js          # Entry point
└── style.css        # Global styles + CSS variables
```

## Coding Conventions

### Vue Components

- Use `<script setup>` syntax exclusively
- Use `ref()` and `computed()` for reactivity
- Prefer composition functions in `src/composables/`
- Component files use PascalCase (e.g., `KnowledgeGraph.vue`)

### JavaScript

- ES modules only (`type: "module"` in package.json)
- Use `const` by default, `let` when reassignment needed
- Arrow functions preferred
- No semicolons unless required

### CSS

- Global CSS variables defined in `src/style.css`
- Scoped styles within components using `<style scoped>`
- Use CSS variables for theming (`var(--bg)`, `var(--accent)`, etc.)
- Dark mode is the primary theme

### Naming

- Components: PascalCase (`KnowledgeGraph.vue`)
- Composables: camelCase with `use` prefix (`useWikiApi.js`, `usePinnedSections.js`)
- Variables/Functions: camelCase
- CSS Classes: kebab-case

## D3.js Graph Conventions (KnowledgeGraph.vue)

### Node Styling

- Nodes use radial gradients based on parent color
- Node radius scales with centrality (link count)
- Color palette: 20 high-contrast colors for dark backgrounds

### Background Layers

- Dark radial gradient background (`#18181b` → `#09090b`)
- Animated concentric circles via `createAnimatedCircles()` helper
- Multiple layers with different colors, opacities, and timing

### Interactions

- Hover: highlights connected nodes/edges, shows tooltip with link count badges
- Click: selects node, opens detail panel, keeps neighbors highlighted
- Background click: clears selection, resets highlights
- Drag: repositions nodes in force simulation
- Zoom: mouse wheel / trackpad pinch

### Edge Coloring

- Outgoing edges: gold color on hover
- Incoming edges: silver color on hover
- Tooltip shows pill badges with arrow icons for incoming/outgoing counts

### CopyLinksButton

- Reusable component for copying linked section content
- Props: `wikiId`, `sectionKey`, `keys` (array), `incoming` (boolean), `outgoing` (boolean), `label` (string) — `incoming`/`outgoing` default false
- **`keys` mode**: when `keys` array is provided, fetches those sections directly via `getSectionsBatch` and copies their content
- **`sectionKey` mode**: when only `sectionKey` is provided, fetches linked sections via `getLinksContent` (respects `incoming`/`outgoing` direction flags)
- When neither direction specified and no `keys`, copies the section itself
- Used in KnowledgeGraph tooltip/detail panel, SectionViewer (content header, connections tab, backlinks tab), and ConnectedSectionsButton modal header

### PinButton / usePinnedSections

- `PinButton` — star toggle in SectionViewer header; filled/labeled "Pinned" when active
- `usePinnedSections` composable — module-level singleton `ref` so all components share reactive pin state without Pinia; persists to `localStorage` under `wiki-pinned-sections`
- Each pin stores `{ key, wikiId, title, pinnedAt }`
- **Call pattern**: `toggle({ key, wikiId, title })` — pass an object, not separate args
- Pinned panel is inlined in `AppHeader.vue` (not a separate component); clicking a pin navigates via `router.push`

### ConnectedSectionsModal

- Self-contained modal (`defineExpose({ open })`) triggered from SectionViewer's "Read Connected" header button
- Props: `sectionKey` (required), `wikiId`
- Fetches via two parallel `api.linksContent` calls (one `incoming: true`, one `outgoing: true`); merges by key into a Map, skipping the anchor section itself
- Direction per card: silver badge = incoming, gold badge = outgoing; muted "both" badge when section links in both directions
- Per-section copy icon button (copies `# title\n\ncontent`); Copy All button in modal header (joins with `---` separators)
- Results cached in component — re-opening the modal for the same section does not re-fetch
- Teleported to body, z-index 300; closes on Escape and click-outside

### Filter Awareness

- All highlight/reset functions must respect `selectedParents` and `filterText`
- Never reset node opacity to `1` — always check active filters first

## Key Patterns

### D3 Selection Pattern

```js
d3.selectAll('.graph-node')
  .transition()
  .duration(300)
  .attr('opacity', (d) => {
    /* respect filters */
  });
```

### Filter-Aware Opacity

```js
function getNodeOpacity(d) {
  const parent = d.parent || 'Root';
  const hasParentFilter = selectedParents.value.size > 0;
  const text = filterText.value.toLowerCase();
  const matchesText = !text || (d.title || '').toLowerCase().includes(text);

  if (hasParentFilter && !selectedParents.value.has(parent)) return 0.08;
  if (!matchesText) return 0.15;
  return 1;
}
```

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `style:`, `refactor:`, `docs:`
- Keep commit messages concise and descriptive
- One logical change per commit

## Development Commands

```bash
npm run dev          # Frontend dev server
npm run server       # Backend API server
npm run dev:all      # Both concurrently
npm run build        # Production build
npm run preview      # Preview production build
```

## Important Notes

1. **Never guess conventions** — check existing code patterns first
2. **Surgical changes** — only modify what's necessary for the task
3. **Filter awareness** — any opacity/styling change must respect active filters
4. **D3 cleanup** — when modifying D3 code, ensure transitions complete properly
5. **No dead code** — remove unused imports/variables after changes
