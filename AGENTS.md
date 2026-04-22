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
- Composables: camelCase with `use` prefix (`useWikiApi.js`)
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
- Props: `incoming` (boolean), `outgoing` (boolean) — both default false
- When neither direction specified, copies the section itself
- Used in KnowledgeGraph tooltip/detail panel and SectionViewer (content header, connections tab, backlinks tab)

### ConnectedSectionsButton

- Button + teleported modal that loads and displays all connected section content
- Auto-opens on mount when `autoOpen` prop is true (set in SectionViewer)
- Fetches incoming and outgoing via `getLinksContent` in parallel, merges into one list
- Direction badge per card: silver = incoming, gold = outgoing (matching KnowledgeGraph edge colors)
- Per-section copy button (copies content from memory, no extra API call) and copy-all via CopyLinksButton in modal header

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
