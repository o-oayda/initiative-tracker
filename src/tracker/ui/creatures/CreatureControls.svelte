<script lang="ts">
    import { ExtraButtonComponent, Menu } from "obsidian";
    import {
        DISABLE,
        ENABLE,
        HIDDEN,
        HP,
        REMOVE,
        TAG
    } from "src/utils";
    import type { Creature } from "src/utils/creature";
    import { Creature as CreatureModel } from "src/utils/creature";
    import type TrackerView from "src/tracker/view";
    import { createEventDispatcher, getContext } from "svelte";
    import type InitiativeTracker from "src/main";
    import { tracker } from "src/tracker/stores/tracker";
    import SpellCastingModal from "../spells/modal";

    const dispatch = createEventDispatcher();

    export let creature: Creature;

    const plugin = getContext<InitiativeTracker>("plugin");

    // Ensure only one context menu is open at a time per tracker view
    let openMenu: Menu | null = null;

    const hamburgerIcon = (node: HTMLElement) => {
        const hamburger = new ExtraButtonComponent(node)
            .setIcon("vertical-three-dots")
            .setTooltip("Actions");
        hamburger.extraSettingsEl.onclick = (evt) => {
            evt.stopPropagation();
            // Close any previously opened menu before opening a new one
            try {
                openMenu?.hide?.();
                openMenu?.close?.();
            } catch {}
            // Defensive: remove any stray menu elements still in the DOM
            try {
                document.querySelectorAll('.menu').forEach((el) => el.remove());
            } catch {}
            const menu = new Menu();
            openMenu = menu;
            menu.onHide(() => {
                // Clear reference when this menu is dismissed
                if (openMenu === menu) openMenu = null;
            });
            menu.addItem((item) => {
                item.setIcon(HP)
                    .setTitle("Set Health/Status")
                    .onClick((e: MouseEvent) => {
                        tracker.updateTarget.set("hp");
                        tracker.setUpdate(creature, e);
                    });
            });
            // resourcesPerDay should already be present on the creature
            if (creature.resourcesPerDay && Object.keys(creature.resourcesPerDay).length) {
                const kinds = new Set(
                    Object.values(creature.resourcesPerDay).map((r) => (r.kind ?? "spell").toLowerCase())
                );
                const pluralize = (k: string) => (k.endsWith("y") ? k.slice(0, -1) + "ies" : k + "s");
                const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
                let title: string;
                let icon: string;
                if (kinds.size === 1) {
                    const k = [...kinds][0];
                    if (k === "spell") {
                        title = "Cast Spells";
                        icon = "wand";
                    } else if (k === "power") {
                        title = "Manifest Powers";
                        icon = "brain"; // assumes a brain icon exists in the set
                    } else {
                        title = `Use ${cap(pluralize(k))}`;
                        icon = "sparkles"; // generic sparkle icon if available
                    }
                } else {
                    title = "Use Abilities";
                    icon = "sparkles";
                }
                menu.addItem((item) => {
                    item.setIcon(icon ?? "wand")
                        .setTitle(title)
                        .onClick(() => {
                            new SpellCastingModal(plugin, creature).open();
                        });
                });
            }
            if (creature.current_ac != creature.ac) {
                menu.addItem((item) => {
                    item.setIcon(HP)
                        .setTitle("Reset AC")
                        .onClick((e: MouseEvent) => {
                            creature.current_ac = creature.ac;
                            tracker.updateAndSave();
                        });
                });
            }
            menu.addItem((item) => {
                item.setIcon("pencil")
                    .setTitle("Edit")
                    .onClick(() => {
                        dispatch("edit", creature);
                    });
            });
            if (creature.hidden) {
                menu.addItem((item) => {
                    item.setIcon("eye")
                        .setTitle("Show")
                        .onClick(() => {
                            tracker.updateCreatures({
                                creature,
                                change: { hidden: false }
                            });
                        });
                });
            } else {
                menu.addItem((item) => {
                    item.setIcon(HIDDEN)
                        .setTitle("Hide")
                        .onClick(() => {
                            tracker.updateCreatures({
                                creature,
                                change: { hidden: true }
                            });
                        });
                });
            }
            if (creature.enabled) {
                menu.addItem((item) => {
                    item.setIcon(DISABLE)
                        .setTitle("Disable")
                        .onClick(() => {
                            tracker.updateCreatures({
                                creature,
                                change: { enabled: false }
                            });
                        });
                });
            } else {
                menu.addItem((item) => {
                    item.setIcon(ENABLE)
                        .setTitle("Enable")
                        .onClick(() => {
                            tracker.updateCreatures({
                                creature,
                                change: { enabled: true }
                            });
                        });
                });
            }
            menu.addItem((item) => {
                item.setIcon(REMOVE)
                    .setTitle("Remove")
                    .onClick(() => {
                        tracker.remove(creature);
                    });
            });
            menu.showAtPosition(evt);
        };
    };
</script>

<div class="controls">
    <div class="add-button icon" use:hamburgerIcon />
</div>

<style>
    .controls {
        display: flex;
        justify-content: flex-end;
    }
    .icon :global(.clickable-icon) {
        margin-right: 0;
    }
</style>
