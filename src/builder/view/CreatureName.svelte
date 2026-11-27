<script lang="ts">
    import { parseLinktext, setIcon } from "obsidian";
    import { getContext } from "svelte";
    import type InitiativeTracker from "src/main";
    import type { EncounterCreature } from "../stores/encounter";
    import { Creature } from "src/utils/creature";
    import { previewTrackerLink } from "src/utils/condition-link";

    export let creature: EncounterCreature;

    const plugin = getContext<InitiativeTracker>("plugin");
    const scrollIcon = (node: HTMLElement) => setIcon(node, "scroll-text");

    function findNote(creature: EncounterCreature) {
        const app = plugin.app;
        for (const raw of [creature["statblock-link"], creature.path, creature.note, creature.name]) {
            if (!raw || raw.startsWith("#")) continue;
            const link = raw.match(/^\[\[([^|\]]+)(?:\|[^\]]+)?\]\]$/)?.[1]
                ?? raw.match(/^\[[^\]]*\]\((.+)\)$/)?.[1]
                ?? raw.match(/^<STATBLOCK-WIKI-LINK>([^|<]+)(?:\|[^<]+)?<STATBLOCK-WIKI-LINK>$/)?.[1]
                ?? raw;
            const { path } = parseLinktext(link);
            const file = app.metadataCache.getFirstLinkpathDest(path, creature.path ?? "");
            if (file?.extension === "md") return file;
        }
    }

    $: note = findNote(creature);

    function openNote() {
        const target = findNote(creature);
        if (target) void plugin.app.workspace.getLeaf("tab").openFile(target);
    }
</script>

<span class="creature-label">
    {#if plugin.canUseStatBlocks || creature["statblock-link"]}
        <button
            type="button"
            class="clickable-icon"
            use:scrollIcon
            aria-label={`Show statblock for ${creature.name}`}
            on:click|stopPropagation={() => plugin.openCombatant(Creature.from(creature))}
        />
    {/if}
    {#if note}
        <a
            class="internal-link"
            href={note.path}
            data-href={note.path}
            on:click|preventDefault|stopPropagation={openNote}
            on:mouseover={(event) => previewTrackerLink(plugin.app, event, note.path)}
        >
            {creature.name}
        </a>
    {:else}
        <span>{creature.name}</span>
    {/if}
</span>

<style>
    .creature-label {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }
    .clickable-icon {
        padding: 0.15rem;
        flex: 0 0 auto;
    }
</style>
