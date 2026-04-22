# Wiki-UI

Enterprise-grade knowledge graph visualization and wiki management interface. A modern, interactive platform for exploring, searching, and managing wiki content with real-time D3.js force-directed graph visualization.

## Overview

Wiki-UI provides a comprehensive suite of tools for navigating and understanding wiki content through multiple visualization paradigms:

- **Knowledge Graph** — Interactive force-directed graph with clustering, focus mode, direction-colored edges, and animated mind-map background
- **Section Viewer** — Markdown rendering with syntax highlighting, Mermaid diagram support, and bidirectional connections tab
- **Search Dashboard** — Full-text search with result ranking, filtering, and wiki ID indicator
- **Global Search** — App-wide search accessible via Cmd/Ctrl+K from any page
- **Pinned Sections** — Bookmark any section for quick access from the header; persisted in localStorage
- **Topic Tree** — Hierarchical topic exploration
- **Health Report** — Wiki integrity analysis (empty sections, orphaned pages, broken links)
- **Stats Dashboard** — Analytics and metrics for wiki content

## Tech Stack

| Layer                   | Technology                                |
| ----------------------- | ----------------------------------------- |
| **Frontend**            | Vue 3 (Composition API, `<script setup>`) |
| **Build**               | Vite 8                                    |
| **Routing**             | Vue Router 4                              |
| **Visualization**       | D3.js 7                                   |
| **Markdown**            | Marked 18                                 |
| **Diagrams**            | Mermaid 11                                |
| **Syntax Highlighting** | Highlight.js 11                           |
| **Backend**             | Express 5                                 |
| **Database**            | PostgreSQL (via `pg`)                     |
| **Diff Engine**         | diff 9                                    |

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or pnpm

### Installation

```bash
npm install
```

### Environment Configuration

Copy the example environment file and configure your database connection:

```bash
cp .env.example .env
```

### Development

```bash
# Frontend only
npm run dev

# Backend server only
npm run server

# Both concurrently
npm run dev:all
```

### Production Build

```bash
npm run build
npm run preview
```

## Architecture

```
wiki-ui/
├── server/              # Express API server
│   └── index.js         # Routes for wiki CRUD, search, backlinks
├── src/
│   ├── api/             # Frontend API client layer
│   ├── assets/          # Static assets
│   ├── components/      # Reusable Vue components
│   ├── composables/     # Vue composition functions
│   ├── router/          # Vue Router configuration
│   ├── views/           # Page-level components
│   ├── App.vue          # Root application component
│   ├── main.js          # Application entry point
│   └── style.css        # Global styles and CSS variables
├── public/              # Static public assets
├── index.html           # HTML entry point
└── vite.config.js       # Vite configuration
```

## Features

### Knowledge Graph

- Force-directed layout with parent-based clustering
- Interactive node selection with persistent neighbor highlighting
- Focus mode for isolating connected subgraphs
- Animated concentric circle background layers
- Minimap for viewport navigation
- Direction-colored edges (gold = outgoing, silver = incoming)
- Link count badges in hover tooltip (incoming/outgoing)
- CopyLinksButton in tooltip and detail panel for copying linked content
- Parent-based color coding with high-contrast palette
- Text and topic filtering with filter-aware highlights
- Drag-and-drop node repositioning
- Zoom and pan with mouse/trackpad

### Section Viewer

- Markdown rendering with syntax highlighting
- Mermaid diagram rendering
- Section navigation with backlinks
- Connections tab showing inbound/outbound links
- Content diff visualization
- CopyLinksButton for copying linked section content (configurable direction)
- ConnectedSectionsButton — auto-opens on load, shows all incoming/outgoing sections in a single scrollable modal with direction badges (silver/gold), per-section copy, and copy-all
- Tab state synced to URL (`?tab=`) for shareable links
- PinButton in section header to pin/unpin the current section

### Pinned Sections

- Star button in the Section Viewer header toggles a pin on the current section
- Pinned sections panel in the app header lists all bookmarked sections
- Clicking a pinned item navigates directly to that section and syncs the wiki selector
- Remove individual pins via the × button (visible on hover)
- State persisted in `localStorage` under `wiki-pinned-sections`

### Search

- Full-text search across all wiki sections
- Result ranking and snippet extraction
- Filter by topic/parent
- Global search component accessible via Cmd/Ctrl+K from anywhere in the app
- Wiki ID indicator in search dashboard

### Health Report

- Empty section detection
- Orphaned section identification
- Unlinked section analysis

## API Endpoints

The Express server provides the following endpoints:

| Method | Endpoint                    | Description                                    |
| ------ | --------------------------- | ---------------------------------------------- |
| `GET`  | `/api/sections`             | List all wiki sections                         |
| `GET`  | `/api/sections/:key`        | Get section content                            |
| `GET`  | `/api/backlinks/:key`       | Get backlinks for a section                    |
| `GET`  | `/api/search?q=`            | Full-text search                               |
| `GET`  | `/api/stats`                | Wiki statistics                                |
| `GET`  | `/api/health`               | Wiki health report                             |
| `GET`  | `/api/wiki/connections`     | Get inbound and outbound links for a section   |
| `GET`  | `/api/wiki/links-content`   | Get content for linked sections (by direction) |

## License

Private — All rights reserved.
