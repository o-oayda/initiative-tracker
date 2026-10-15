# Pathfinder 2e weak and elite adjustments

Select **Pathfinder 2e** as the RPG system to use creature adjustments.

Inline encounters accept `Weak Goblin`, `Elite Goblin`, `Goblin (W)`, and `Goblin (E)`. The plugin looks up `Goblin` in Fantasy Statblocks, then applies the requested adjustment to that encounter copy. An exact bestiary name takes priority over interpreting a prefix or suffix.

In the initiative tracker, click the small adjustment button beside a creature name, or use the creature's actions menu, to switch between Normal, Weak, and Elite during combat. The selection is saved with the encounter. The add-creature form also has an adjustment selector.

Changing an adjustment recalculates level, maximum HP, AC, the Perception-based modifier used for future initiative rolls, and encounter XP from the original creature values. Current HP moves by the same amount as maximum HP and is clamped between zero and the new maximum; temporary HP is unchanged. An existing initiative roll is unchanged. In a Fantasy Statblocks creature entry, the displayed level, HP, AC, Perception, listed skills, Fortitude/Reflex/Will, leading Melee/Ranged Strike attack bonuses, and explicitly labeled spell DC and attack bonuses are adjusted when they match the supported format. HP and AC rows retain any text after the number. These changes are computed from the original entry each time; the source creature note is unchanged.

The displayed statblock includes a reminder for values that remain in free-form text. Unmatched rows, ability prose, Strike damage, spell damage, and special ability damage must be adjusted manually. For a linked Markdown statblock, the note itself is shown as written and the adjustment reminder appears above it.

The rules and original-level HP bands follow [Monster Core's Adjusting Creatures](https://2e.aonprd.com/Rules.aspx?ID=3262).
