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
        this.titleEl.setText(`Cast Spells — ${this.creature.getName?.() ?? this.creature.name}`);
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
