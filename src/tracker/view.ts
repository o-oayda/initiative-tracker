import {
    debounce,
    ExtraButtonComponent,
    ItemView,
    MarkdownRenderer,
    parseLinktext,
    resolveSubpath,
    WorkspaceLeaf
} from "obsidian";
import {
    BASE,
    CREATURE,
    CREATURE_TRACKER_VIEW,
    INITIATIVE_TRACKER_VIEW
} from "../utils";

import type InitiativeTracker from "../main";

import App from "./ui/App.svelte";
import type { Creature } from "../utils/creature";
import { adjustedPf2eStatblock, originalPf2eStatblockSource } from "../utils/pf2e-adjustment";
import { PLAYER_VIEW_VIEW } from "../utils/constants";
import type PlayerView from "./player-view";

export default class TrackerView extends ItemView {
    ui: App;

    constructor(public leaf: WorkspaceLeaf, public plugin: InitiativeTracker) {
        super(leaf);
        if (this.plugin.data.state?.creatures?.length) {
        } else {
        }
    }
    async onOpen() {
        this.ui = new App({
            target: this.contentEl,
            props: {
                plugin: this.plugin
            }
        });
        this.ui.$on("player-view", () => this.openPlayerView());
    }
    getViewType() {
        return INITIATIVE_TRACKER_VIEW;
    }
    getDisplayText() {
        return "Initiative Tracker";
    }
    getIcon() {
        return BASE;
    }

    //legacy Leaflet support...
    get pcs(): Creature[] {
        return [];
    }
    get npcs(): Creature[] {
        return [];
    }

    //open player view
    playerViewOpened = false;
    getExistingPlayerView(): PlayerView | undefined {
        const existing =
            this.plugin.app.workspace.getLeavesOfType(PLAYER_VIEW_VIEW);

        if (existing.length) {
            return existing[0].view as PlayerView;
        }
    }
    async getPlayerView(): Promise<PlayerView> {
        const existing = this.getExistingPlayerView();
        if (existing) {
            this.app.workspace.revealLeaf(existing.leaf);
            return existing;
        }

        const leaf = this.app.workspace.getLeaf("window");
        await leaf.setViewState({
            type: PLAYER_VIEW_VIEW
        });
        await this.app.workspace.setActiveLeaf(leaf, { focus: true });
        return leaf.view as PlayerView;
    }
    async openPlayerView() {
        await this.getPlayerView();
        this.playerViewOpened = true;
    }
}

export class CreatureView extends ItemView {
    viewedCreatureId?: string;
    buttonEl = this.contentEl.createDiv("creature-view-button");
    statblockEl = this.contentEl.createDiv("creature-statblock-container");
    constructor(leaf: WorkspaceLeaf, public plugin: InitiativeTracker) {
        super(leaf);
        this.load();
        this.containerEl.addClass("creature-view-container");
        this.containerEl.on(
            "mouseover",
            "a.internal-link",
            debounce(
                (ev) =>
                    app.workspace.trigger(
                        "link-hover",
                        {}, //hover popover, but don't need
                        ev.target as HTMLElement, //targetEl
                        (ev.target as HTMLAnchorElement).dataset.href, //linkText
                        "initiative-tracker " //source
                    ),
                10
            )
        );
        this.containerEl.on("click", "a.internal-link", (ev) =>
            app.workspace.openLinkText(
                (ev.target as HTMLAnchorElement).dataset.href,
                "initiative-tracker"
            )
        );
    }
    onload() {
        new ExtraButtonComponent(this.buttonEl)
            .setIcon("cross")
            .setTooltip("Close Statblock")
            .onClick(async () => {
                await this.render();
                this.app.workspace.trigger("initiative-tracker:stop-viewing");
            });
    }
    onunload(): void {
        this.app.workspace.trigger("initiative-tracker:stop-viewing");
    }
    async render(creature?: Creature) {
        this.statblockEl.empty();
        this.viewedCreatureId = creature?.id;
        if (!creature) {
            this.statblockEl.createEl("em", {
                text: "Select a creature to view it here."
            });
            return;
        }

        if (this.plugin.data.rpgSystem === "pathfinder2e" && creature.pf2eAdjustment !== "normal") {
            const sign = creature.pf2eAdjustment === "elite" ? "+" : "−";
            const heading = creature.pf2eAdjustment === "elite" ? "Elite" : "Weak";
            const summary = this.statblockEl.createDiv("pf2e-adjustment-summary");
            summary.createEl("strong", { text: `${heading} adjustment · level ${creature.level ?? "?"} · HP ${creature.max} · AC ${creature.ac ?? "?"}` });
            summary.createEl("div", { text: `Recognized creature rows below include ${sign}2 to attacks, Strike damage, spell DCs, saves, Perception, and skills. For unmatched text, apply those changes manually; also apply ${sign}2 damage for repeatable offensive abilities, or ${sign}4 damage for limited-use abilities.` });
        }

        if (
            creature["statblock-link"] &&
            (this.plugin.data.preferStatblockLink ||
                !this.plugin.canUseStatBlocks)
        ) {
            await this.renderEmbed(creature.getStatblockLink());
        } else if (this.plugin.canUseStatBlocks) {
            const bestiary = this.plugin.getBaseCreatureFromBestiary(creature.name);
            const stored = originalPf2eStatblockSource(creature.creature);
            const bestiarySource = bestiary && originalPf2eStatblockSource(bestiary);
            const completeStoredSource = this.plugin.data.rpgSystem === "pathfinder2e" && stored &&
                Number(stored.hp) > 0 && Number.isFinite(Number(stored.ac)) &&
                (Number(bestiarySource?.hp) <= 0 || !Number.isFinite(Number(bestiarySource?.ac)) ||
                    (Array.isArray(stored.attacks) && !Array.isArray(bestiarySource?.attacks)));
            const source = completeStoredSource ? stored : bestiarySource ?? stored;
            const rendered = this.plugin.data.rpgSystem === "pathfinder2e" && !(source as any).pf2eAdjustment
                ? adjustedPf2eStatblock(source as Record<string, any>, creature.pf2eAdjustment)
                : source;
            const statblock = window.FantasyStatblocks.render(
                rendered,
                this.statblockEl,
                creature.display
            );
            this.addChild(statblock);
        } else {
            this.statblockEl.createEl("em", {
                text: "Install the TTRPG Statblocks plugin or add a statblock-link to your monster to use this feature!"
            });
        }
    }

    async renderEmbed(embedLink: string) {
        if (
            this.plugin.canUseStatBlocks &&
            window.FantasyStatblocks.isStatblockLink?.(embedLink)
        ) {
            embedLink = window.FantasyStatblocks.parseStatblockLink(embedLink);
        }
        if (/\[.+\]\(.+\)/.test(embedLink)) {
            //md
            [, embedLink] = embedLink.match(/\[.+?\]\((.+?)\)/);
        } else if (/\[\[.+\]\]/.test(embedLink)) {
            //wiki
            [, embedLink] = embedLink.match(/\[\[(.+?)(?:\|.+?)?\]\]/);
        }

        const { path, subpath } = parseLinktext(embedLink);

        const file = this.app.metadataCache.getFirstLinkpathDest(path, "/");

        let content = `Oops! Something is wrong with your statblock-link:<br />${embedLink}`;
        if (file) {
            const fileContent = await this.app.vault.cachedRead(file);
            if (subpath && fileContent) {
                const cache = app.metadataCache.getFileCache(file);
                const subpathResult = resolveSubpath(cache, subpath);
                if (subpathResult) {
                    content = fileContent.slice(
                        subpathResult.start.offset,
                        subpathResult.end.offset
                    );
                }
            } else if (fileContent) {
                content = fileContent;
            }
        }

        await MarkdownRenderer.render(
            this.app,
            content,
            this.statblockEl.createDiv("markdown-rendered"),
            path,
            this
        );
    }

    getDisplayText(): string {
        return "Combatant";
    }
    getIcon(): string {
        return CREATURE;
    }
    getViewType(): string {
        return CREATURE_TRACKER_VIEW;
    }
}
