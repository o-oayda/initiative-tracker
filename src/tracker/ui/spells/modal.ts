import { Modal } from "obsidian";
import type InitiativeTracker from "src/main";
import type { Creature } from "src/utils/creature";
import SpellCasting from "./SpellCasting.svelte";

export class SpellCastingModal extends Modal {
    private instance: SpellCasting;
    constructor(public plugin: InitiativeTracker, public creature: Creature) {
        super(plugin.app);
    }
    onOpen() {
        this.containerEl.addClass("initiative-tracker-modal", "spell-casting-modal");
        const kinds = new Set(
            Object.values(this.creature.resourcesPerDay ?? {}).map((r) => (r.kind ?? "spell").toLowerCase())
        );
        const pluralize = (k: string) => (k.endsWith("y") ? k.slice(0, -1) + "ies" : k + "s");
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        let title: string;
        if (kinds.size === 1) {
            const k = [...kinds][0];
            if (k === "spell") title = `Cast Spells — ${this.creature.getName?.() ?? this.creature.name}`;
            else if (k === "power") title = `Manifest Powers — ${this.creature.getName?.() ?? this.creature.name}`;
            else title = `Use ${cap(pluralize(k))} — ${this.creature.getName?.() ?? this.creature.name}`;
        } else {
            title = `Use Abilities — ${this.creature.getName?.() ?? this.creature.name}`;
        }
        this.titleEl.setText(title);
        this.instance = new SpellCasting({
            target: this.contentEl,
            props: {
                creature: this.creature
            }
        });
    }
    onClose() {
        this.instance?.$destroy?.();
        this.contentEl.empty();
    }
}

export default SpellCastingModal;
