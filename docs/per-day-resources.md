# Per‑Day Resources (Spells, Powers, Abilities)

This fork adds first‑class tracking for per‑day resources on creatures, such as spells, psionic powers, and other abilities. Resources are parsed from creature/frontmatter and can be incremented/decremented during an encounter with persistence.

## Defining Resources in Frontmatter

Add keys in the creature’s frontmatter using the pattern:

- `N/day` (defaults to kind "spell")
- `N/day <kind>` or `N/day <kind>s`
- `At will` (defaults to kind "spell")
- `At will <kind>` or `At will <kind>s`
- Optional `each` is supported: `N/day each`, `N/day <kind> each`

Examples:

```yaml
---
name: Red Dragon Wyrmling
1/day ability:
  - Fire Breath
2/day spells:
  - [[burning hands]]
  - "Hold Person"
3/day powers:
  - [[mind thrust]]
At will abilities: breath weapon, roar
---
```

Notes:

- Kind names are case‑insensitive and pluralization is normalized ("spells" → "spell", "abilities" → "ability").
- Wiki links are supported both as standard `[[page]]`/`[[page|Label]]` and Fantasy Statblocks’ sentinel format `<STATBLOCK-WIKI-LINK>page|Label<STATBLOCK-WIKI-LINK>`.
- Legacy blocks are also supported:

```yaml
spells:
  - "The evoker casts one of the following spells, using Intelligence as the spellcasting ability (spell save 15):"
  - At will: light, mage hand, message, prestidigitation
  - 2/day each: ice storm, lightning bolt, mage armor
  - 1/day each: wall of ice

psionics:
  - "The manifold mind manifests one of the following powers:"
  - At will: [[mind thrust]], telepathy
  - 3/day each: "ego whip", "id insinuation"
```
The `spells:` block defaults to kind `spell`; `psionics:` defaults to kind `power`.

## Using During Encounters

- Open the row actions (⋮) for a creature.
  - Spells only → “Cast Spells” (wand icon)
  - Powers only → “Manifest Powers” (brain icon)
  - Multiple kinds → “Use Abilities” (sparkles icon)
- This opens a modal listing resources grouped by kind. For each entry:
  - Primary action button on the right uses the appropriate verb:
    - Cast (spells) / Manifest (powers) / Use (others). For per‑day items, this decrements the remaining counter.
  - The middle column shows `remaining/perDay` with small “− / +” buttons for manual adjustment when needed. At‑will entries show an “(at will)” badge and no counters.
  - Clicking a linked name opens the note; hovering shows the native Obsidian preview popover.
  - “Reset All” restores all remaining counts to max for that creature.

### Icons and Grouping

- Each kind section shows a relevant icon in the header: wand for spells, brain for powers, sparkles for other kinds.
- Items are grouped by kind with a subtle divider below each section title.
- Within spells and powers, abilities are further grouped by level:
  - Unsorted: items with no level detected or no linked note
  - Cantrips (Level 0)
  - Level 1, Level 2, … (ascending)
  The modal caches parsed levels per linked note for performance.

### Auto‑linking of Ability Names

- If a resource name is a normal wiki link (`[[...]]`) or a Fantasy Statblocks sentinel link, it’s rendered as a link.
- If it’s plain text, the plugin attempts to resolve a matching note and auto‑link it:
  - Tries a few slug variants: original, lowercased, hyphenated (spaces → dashes), and de‑hyphenated.
  - If a match is found, the name becomes a clickable internal link with hover preview.
  - This is scoped to the currently opened modal for performance.

### Casting/Manifesting Time Column

- The modal shows a centered time column for spells/powers. The value is parsed from the linked note’s body:
  - Labels supported (case‑insensitive, with bold tolerated): “Casting Time:” and “Manifesting Time:”.
  - Values like “1 action”, “1 bonus action”, or “1 reaction, which you …” are supported; any text after the first comma is shown as a tooltip on hover.
  - The time display uses small caps; tooltip text remains normal casing.
  - Results are cached per note for performance.

### Concentration Detection

- On Cast/Manifest/Use, the plugin checks the linked note for a “Duration: Concentration …” line (markdown list/bold variants supported).
- If found, the ability is added to the creature’s dedicated concentration list:
  - Spells (and other kinds): exclusive — previous concentrations are removed.
  - Powers: multiple are allowed.
- Tracker widget: concentrated abilities render as compact colored tags with the linked name only (no “Concentrating on …” prefix):
  - Spells: themed blue highlight; Powers: themed pink; Others: themed orange (colors honor theme `--color-*-rgb` variables with fallbacks).
- Player View: shows a separate “Concentrating” column; one ability per line as an internal link (read‑only).

### Player View

- Columns: Initiative, Name, HP status, Statuses, Concentrating.
- Statuses: one per line (wrapped); Concentrating: one per line (no wrap), as internal links.
- Cosmetic tweaks: names are vertically centered within multi‑line rows; subtle horizontal rules separate rows.

## Persistence & Behavior

- Resource counts persist with the encounter and are serialized under `resourcesPerDay` in saved state.
- Duplicating a creature preserves its current resource counts.
- If a saved encounter lacks `resourcesPerDay`, the plugin re‑parses from the bestiary/base creature or from the state object where possible.

## Tips & Conventions

- Use specific kinds that make sense for your system: `ability`, `spell`, `power`, `breath`, etc.
- For psionics, prefer `N/day power` (or `powers`) to get the proper “Manifest Powers” verb in the UI.
- If using Fantasy Statblocks, you can place these keys directly in the statblock’s attributes/frontmatter; this plugin will pick them up.

## Known Limitations

- Only simple per‑day tracking is supported; per‑rest or shared‑pool mechanics are out of scope for now.
- There’s no per‑round auto‑reset for resources (unlike some status effects). Use “Reset All” as needed.
- Concentration detection requires the ability to link to a note (either explicitly via a wiki/sentinel link or via auto‑linking) and a duration line containing “Concentration”.
