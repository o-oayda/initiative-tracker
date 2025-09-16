import { Modal, Notice } from "obsidian";
import type InitiativeTracker from "src/main";
import type { Creature } from "src/utils/creature";
import PlayerResourceSearch from "./PlayerResourceSearch.svelte";
import { tracker } from "../../stores/tracker";
import { getId } from "src/utils/creature";

type ResourceEntry = {
    path: string;
    name: string;
    displayName: string;
    level: number | null;
    tags: string[];
};

type CastEventDetail = {
    entry: ResourceEntry;
    requiresConcentration: boolean;
};

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
        this.instance.$on("cast", (evt: CustomEvent<CastEventDetail>) => {
            const { entry, requiresConcentration } = evt.detail;
            if (requiresConcentration) {
                this.applyConcentration(entry);
            }
            this.close();
        });
    }
    onClose(): void {
        this.instance?.$destroy?.();
        this.contentEl.empty();
    }

    private applyConcentration(entry: ResourceEntry) {
        const kind = this.mode === "power" ? "power" : "spell";
        const allowMultiple = kind === "power";
        if (!this.creature.concentration) {
            this.creature.concentration = new Set();
        }
        const current = this.creature.concentration;
        const already = [...current].find((c: any) => c?.link === entry.path || c?.linkText === (entry.displayName ?? entry.name));
        if (already) return;
        const status = {
            name: "Concentration",
            link: entry.path,
            linkText: entry.displayName ?? entry.name,
            id: getId(),
            kind
        } as any;
        const change: any = { concentration: [status] };
        if (!allowMultiple) {
            change.remove_concentration = [...current];
        }
        tracker.updateCreatures({ creature: this.creature, change });
        new Notice(`Concentration started: ${entry.displayName ?? entry.name}`, 2000);
    }
}
