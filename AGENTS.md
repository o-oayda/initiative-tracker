# Agent Orientation (Fork: Per‑Day Resources)

Scope: This file applies to the entire repository and is intended to help agents quickly understand the fork’s features, file layout, build steps, and gotchas.

## Overview
This fork adds first‑class tracking for per‑day resources (spells, powers, abilities) and UX around using them during encounters, including:
- Parsing per‑day and at‑will resources from statblocks/frontmatter (including legacy `spells:`/`psionics:`/`spellcasting:` blocks)
- A casting modal with grouped sections, icons, verb button (Cast/Manifest/Use), and counters
- Auto‑linking plain names to notes (with slug variants) and hover previews
- Concentration detection on cast/manifest with linked “Concentrating on …” statuses
- Player View shows statuses inline with links (read‑only)

For side-by-side installation with the upstream plugin, this fork uses a distinct plugin ID: `initiative-tracker-resources`. Version includes a personal suffix (e.g., `13.0.18-resources.1`).

## Key Concepts
- `resourcesPerDay` replaces the former `spellsPerDay` (no legacy alias):
  - Shape: `{ [name]: { perDay: number; remaining: number; kind?: string; atWill?: boolean } }`
  - `kind` typically `spell`, `power`, or other; `atWill` marks at‑will entries
- Parsing supports:
  - Top‑level keys: `N/day [kind]`, optional `… each`, and `At will [kind]`
  - Legacy blocks (array or object forms): `spells:`, `psionics:`, `spellcasting:`
  - Regex note: `perDayRegex` avoids capturing `each` as a kind; `atWillRegex` matches `At will`/`At-will`

## Important Files
- Parsing & model
  - `src/utils/creature.ts` → `Creature.readPerDayResources(obj)` (public)
  - `src/types/creatures.ts` → `CreatureState.resourcesPerDay`; `Condition` has optional `link`, `linkText`
- UI (tracker)
  - `src/tracker/ui/creatures/CreatureControls.svelte` → menu item label/icon (Cast/Manifest/Use Abilities)
  - `src/tracker/ui/spells/SpellCasting.svelte` → casting modal (grouping, icons, columns, verb/+/-)
  - `src/tracker/ui/creatures/Status.svelte` → renders linked status (internal link + hover)
- Player View
  - `src/tracker/player/PlayerView.svelte` → inline statuses with internal links (no remove buttons)
  - `src/tracker/player-view.ts` → passes `plugin` to PlayerView
- Docs
  - `docs/per-day-resources.md` → user‑facing docs
  - `PERSONAL_CHANGES.md` → summary of fork changes and rebase tips

## Casting Modal UX
- Grouped by kind with header icon: wand (spells), brain (powers), sparkles (others)
- Columns:
  - Left: ability name (auto‑linked when possible; hover preview and click open)
  - Middle: `remaining/perDay` + small `−`/`+` controls (or “(at will)”) 
  - Right: primary verb button: Cast/Manifest/Use (disabled at 0 remaining)
- “Reset All” resets remaining to max for the creature

## Auto‑Linking Behavior
- Already‑linked names (wiki `[[...]]` or Statblocks sentinel) render as links
- Plain names attempt resolution to a note via `metadataCache.getFirstLinkpathDest` with variants:
  - Original, lowercased, hyphenated (spaces→dashes), de‑hyphenated
- Modal caches resolutions per session for performance
- Hover previews use Obsidian’s `link-hover`; z‑index is bumped to render above the modal

## Concentration Detection
- On Cast/Manifest/Use, if the linked note contains a duration line with “Concentration”, apply a status
  - Regex is tolerant of markdown lists/bold and separators (e.g., `- **Duration:** Concentration, …`)
- Status applied as:
  - Name prefix: `Concentrating on`
  - `link` + `linkText` for the ability; Status.svelte renders an internal link with hover
- Powers: multiple simultaneous concentration statuses allowed
- Spells/others: exclusive — prior concentration statuses removed
- A small toast (Notice) indicates detection result

## Player View
- Displays statuses inline (comma‑separated)
- Linked concentration statuses render a clickable internal link; no remove buttons

## Build & Install (Personal)
- Build: `npm run build`
- Install to vault: copy `manifest.json`, `main.js`, `styles.css` to your vault’s plugin folder (e.g., `.obsidian/plugins/initiative-tracker-resources/`)
- Versioning: personal suffix in `manifest.json`/`package.json` (e.g., `13.0.18-resources.1`); no need to update `versions.json`

## Resuming Work Quickly
- Inspect recent changes: `git log --oneline -n 20` and `git diff`
- Open key files listed above (parsing, modal, controls, status, player view)
- Smoke test with a note including:
  - Top‑level `N/day`, `At will`, and a legacy `spells:` block with `…/day each` and `At will:`
  - Spells and powers together to verify grouping and alignment
  - A duration line `- **Duration:** Concentration, up to 1 minute` to test concentration

## Gotchas
- When using `app` in a Svelte component, get it from `plugin` via Svelte context: `setContext/getContext('plugin')`
- Ensure `Status.svelte` is used where link rendering is needed; otherwise inline render with internal link class and hover trigger
- Concentration detection requires a linked note (explicit/wikilink or resolved by auto‑linking) and a detectable duration line
