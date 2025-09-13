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
  - Click “−” to decrement remaining uses; “+” to increment (clamped between 0 and per‑day cap).
  - The label shows `remaining/perDay`.
  - Clicking a wiki‑linked name opens the linked note; hovering shows the Obsidian preview popover.
  - “Reset All” restores all remaining counts to max for that creature.
  - At‑will items are shown with an “(at will)” badge and no +/- controls.

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
