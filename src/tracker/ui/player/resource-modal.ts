import { Modal } from "obsidian";
import type InitiativeTracker from "src/main";
import type { Creature } from "src/utils/creature";
import PlayerResourceSearch from "./PlayerResourceSearch.svelte";

export type PlayerResourceMode = "spell" | "power";

export default class PlayerResourceModal extends Modal {
    private instance: PlayerResourceSearch;
    constructor(
        public plugin: InitiativeTracker,
        public creature: Creature,
        public mode: PlayerResourceMode
    ) {
        super(plugin.app);
    }
    onOpen(): void {
        const name = this.creature.getName?.() ?? this.creature.name;
        const title = this.mode === "spell" ? `Cast Spells — ${name}` : `Manifest Powers — ${name}`;
        this.titleEl.setText(title);
        this.containerEl.addClass("initiative-tracker-modal", "player-resource-modal");
        const container = this.contentEl.createDiv("player-resource-modal-content");
        this.instance = new PlayerResourceSearch({
            target: container,
            props: {
                plugin: this.plugin,
                creature: this.creature,
                mode: this.mode
            }
        });
    }
    onClose(): void {
        this.instance?.$destroy?.();
        this.contentEl.empty();
    }
}
