# Personal Changes

This fork adds features to track per‑day resources (spells, powers, abilities) and related UI/UX improvements. Notes for future merges/rebases.

## Highlights
- Per‑day resources
  - Parse top‑level keys: `N/day [kind]`, `At will [kind]` (plural allowed)
  - Parse legacy blocks: `spells:`, `psionics:`, `spellcasting:` (array/object forms), including `…/day each` and `At will:` lines
  - Supports at‑will entries (no counters)
- Encounter UI
  - Actions menu: “Cast Spells”, “Manifest Powers”, or “Use Abilities” based on kinds present
  - Casting modal: grouped by kind, with icons (wand/brain/sparkles)
  - Verb button (Cast/Manifest/Use) + compact +/- controls and counts
  - Auto‑link plain names to notes (tries original, lowercase, hyphenated, de‑hyphenated variants)
  - Hover preview and click‑open for links
  - Reset All button; at‑will shows badge without controls
- Modal UX refinements
  - Level grouping for spells/powers: Unsorted, Cantrips (0), Level 1…n (ascending)
  - Casting/Manifesting Time column (small caps), with hover tooltip for qualifiers (e.g., reaction “which …”)
  - Auto‑link caching; level/time parsing cached per note; compact row spacing; slimmer verb buttons
- Concentration
  - On Cast/Manifest/Use, detect `Duration: Concentration …` in the linked note (markdown list/bold variants)
  - New dedicated `concentration` bucket on creatures (separate from normal `status`)
  - Spells/others: exclusive; Powers: multiple allowed
  - Tracker: colored tags by kind (spell=blue, power=pink, other=orange) using theme `--color-*-rgb` variables
  - Tags render the ability name only (no “Concentrating on …” prefix); links without underline; subtle border
  - Toasts indicate detection results
- Player View
  - New “Concentrating” column renders one ability per line (no wrap), as internal links
  - Statuses column renders one status per line
  - Names vertically centered; subtle hrules between rows

## Implementation Notes
- Renamed `spellsPerDay` → `resourcesPerDay`, with optional `kind` and `atWill`
- Public parser: `Creature.readPerDayResources(obj)`
- Status type extended with optional `link`, `linkText`, and `kind`
- Docs: `docs/per-day-resources.md`

## Fixes
- Controls menu: prevent multiple popups — opening a new actions menu closes any existing instance

## Styling/theming
- Concentration tag colors respect theme `--color-blue-rgb`, `--color-pink-rgb`, and `--color-orange-rgb` with sensible fallbacks
- Time column uses small caps; tooltip uses normal casing

## Rebase Tips
- Legacy parsing lives in `src/utils/creature.ts` → `readPerDayResources`
- Modal UI: `src/tracker/ui/spells/SpellCasting.svelte`
- Menu wiring: `src/tracker/ui/creatures/CreatureControls.svelte`
- Linked status chip: `src/tracker/ui/creatures/Status.svelte`
- Player View inline rendering: `src/tracker/player/PlayerView.svelte` and `src/tracker/player-view.ts`
