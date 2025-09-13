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
- Concentration
  - On Cast/Manifest/Use, detect `Duration: Concentration …` in the linked note (markdown list/bold variants)
  - Apply status “Concentrating on <Ability>” with internal link
  - Spells: exclusive; Powers: multiple allowed
  - Toasts indicate detection results
- Player View
  - Inline, read‑only statuses string with rendered internal links; no remove buttons

## Implementation Notes
- Renamed `spellsPerDay` → `resourcesPerDay`, with optional `kind` and `atWill`
- Public parser: `Creature.readPerDayResources(obj)`
- Status type extended with optional `link` and `linkText`
- Docs: `docs/per-day-resources.md`

## Rebase Tips
- Legacy parsing lives in `src/utils/creature.ts` → `readPerDayResources`
- Modal UI: `src/tracker/ui/spells/SpellCasting.svelte`
- Menu wiring: `src/tracker/ui/creatures/CreatureControls.svelte`
- Linked status chip: `src/tracker/ui/creatures/Status.svelte`
- Player View inline rendering: `src/tracker/player/PlayerView.svelte` and `src/tracker/player-view.ts`
