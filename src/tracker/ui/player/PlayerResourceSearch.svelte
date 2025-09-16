<script lang="ts">
    import { SyncLoader } from "svelte-loading-spinners";
    import { onMount, setContext, createEventDispatcher } from "svelte";
    import { TFile } from "obsidian";
    import type InitiativeTracker from "src/main";
    import type { Creature } from "src/utils/creature";

    export let plugin: InitiativeTracker;
    export let creature: Creature;
    export let mode: "spell" | "power";

    setContext<InitiativeTracker>("plugin", plugin);
    const dispatch = createEventDispatcher();

    type Entry = {
        path: string;
        name: string;
        level: number | null;
        tags: string[];
    };

    let entries: Entry[] = [];
    let loading = true;
    let query = "";
    let selected: Entry | null = null;
    let checkingConcentration = false;
    let requiresConcentration: boolean | null = null;
    let concentrationMessage: string | null = null;
    $: creatureName = creature?.getName?.() ?? creature?.name ?? "";
    $: castLabel = mode === "spell" ? "Cast" : "Manifest";

    const normalizeTag = (tag: unknown): string | null => {
        if (!tag) return null;
        const str = String(tag).trim();
        if (!str.length) return null;
        return str.startsWith("#") ? str.slice(1) : str;
    };

    const collectTags = (cache: any): string[] => {
        const tags: string[] = [];
        try {
            if (Array.isArray(cache?.tags)) {
                for (const t of cache.tags) {
                    const norm = normalizeTag(t?.tag ?? t);
                    if (norm) tags.push(norm.toLowerCase());
                }
            }
            const fm = cache?.frontmatter;
            const appendFrom = (value: any) => {
                if (!value) return;
                if (Array.isArray(value)) {
                    for (const v of value) {
                        const norm = normalizeTag(v);
                        if (norm) tags.push(norm.toLowerCase());
                    }
                } else if (typeof value === "string") {
                    value
                        .split(/[,\s]+/)
                        .map((v) => normalizeTag(v))
                        .filter(Boolean)
                        .forEach((t) => tags.push(t!.toLowerCase()));
                }
            };
            appendFrom(fm?.tags);
            appendFrom(fm?.tag);
        } catch {}
        return tags;
    };

    let tagPrefix = "spell/level/";
    $: tagPrefix = mode === "spell" ? "spell/level/" : "power/level/";

    const extractLevel = (tags: string[]): number | null => {
        for (const tag of tags) {
            if (!tag.startsWith(tagPrefix)) continue;
            const suffix = tag.slice(tagPrefix.length);
            if (!suffix) continue;
            if (/cantrip/i.test(suffix)) return 0;
            const num = Number.parseInt(suffix, 10);
            if (!Number.isNaN(num)) return num;
        }
        return null;
    };

    const scanVault = async () => {
        try {
            const mdFiles = plugin.app.vault.getMarkdownFiles();
            const collected: Entry[] = [];
            for (const file of mdFiles) {
                const cache: any = plugin.app.metadataCache.getFileCache(file);
                if (!cache) continue;
                const tags = collectTags(cache);
                if (!tags.some((t) => t.startsWith(tagPrefix))) continue;
                collected.push({
                    path: file.path,
                    name: file.basename,
                    level: extractLevel(tags),
                    tags
                });
            }
            collected.sort((a, b) => a.name.localeCompare(b.name));
            entries = collected;
        } finally {
            loading = false;
        }
    };

    onMount(() => {
        scanVault();
    });

    const matchesQuery = (entry: Entry, q: string) => {
        if (!q) return true;
        if (entry.name.toLowerCase().includes(q)) return true;
        if (entry.path.toLowerCase().includes(q)) return true;
        return false;
    };

    $: search = query.trim().toLowerCase();
    $: filtered = entries.filter((entry) => matchesQuery(entry, search));

    const openFile = (entry: Entry) => {
        plugin.app.workspace.openLinkText(entry.path, "/", false);
    };

    const concentrationRegex = /(^|\n)\s*[-*]?\s*(?:\*\*|__)?duration\s*[:\.\-\u2014\u2013]?(?:\*\*|__)?\s*[:\.\-\u2014\u2013]?\s*concentration\b/i;

    const selectEntry = async (entry: Entry) => {
        selected = entry;
        checkingConcentration = true;
        requiresConcentration = null;
        concentrationMessage = null;
        try {
            const file = plugin.app.vault.getAbstractFileByPath(entry.path);
            if (!(file instanceof TFile)) {
                requiresConcentration = false;
                concentrationMessage = "Unable to locate note";
                return;
            }
            const content = await plugin.app.vault.cachedRead(file);
            const requires = concentrationRegex.test(content);
            requiresConcentration = requires;
            concentrationMessage = null;
        } catch (e) {
            requiresConcentration = null;
            concentrationMessage = "Unable to determine concentration";
        } finally {
            checkingConcentration = false;
        }
    };

    const castSelected = () => {
        if (!selected) return;
        dispatch("cast", {
            entry: selected,
            requiresConcentration: !!requiresConcentration
        });
    };
</script>

<div class="resource-search">
    {#if creatureName}
        <div class="creature-name">{creatureName}</div>
    {/if}
    <div class="search-header">
        <input
            type="search"
            placeholder={`Search ${mode === "spell" ? "spells" : "powers"}...`}
            bind:value={query}
            autofocus
        />
    </div>
    {#if loading}
        <div class="loading">
            <SyncLoader color="var(--text-muted)" size={6} margin={2} />
        </div>
    {:else if !filtered.length}
        <div class="empty">No {mode === "spell" ? "spells" : "powers"} found.</div>
    {:else}
        <ul class="results">
            {#each filtered as entry}
                <li>
                    <button
                        type="button"
                        class:selected={selected?.path === entry.path}
                        on:click={() => selectEntry(entry)}
                        on:dblclick={() => openFile(entry)}
                    >
                        <div class="result-line">
                            {#if entry.level !== null}
                                <span class="pill">Level {entry.level}</span>
                            {/if}
                            <span class="result-name">{entry.name}</span>
                        </div>
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
    {#if selected}
        <div class="selection-summary">
            <div class="summary-header">
                <span>Ready:</span>
                <span class="summary-name">{selected.name}</span>
                {#if selected.level !== null}
                    <span class="summary-level">(Level {selected.level})</span>
                {/if}
            </div>
            <div class="summary-meta">
                {#if checkingConcentration}
                    Checking concentration...
                {:else}
                    {#if requiresConcentration === true}
                        <span class="concentration-flag requires">✔ Requires concentration</span>
                    {:else if requiresConcentration === false}
                        <span class="concentration-flag none">No concentration required</span>
                    {:else}
                        <span class="concentration-flag unknown">Concentration unknown</span>
                    {/if}
                {/if}
                {#if concentrationMessage && !checkingConcentration}
                    <span class="summary-message">{concentrationMessage}</span>
                {/if}
            </div>
            <div class="summary-actions">
                <button
                    type="button"
                    class="cast-button"
                    on:click={castSelected}
                    disabled={!selected || checkingConcentration}
                >
                    {castLabel}
                </button>
                <button type="button" class="open-button" on:click={() => selected && openFile(selected)}>
                    Open Note
                </button>
            </div>
        </div>
    {/if}
</div>

<style scoped>
    :global(.player-resource-modal-content) {
        padding: 0.75rem 0.75rem 1rem;
    }
    .resource-search {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: 22rem;
        max-height: 60vh;
    }
    .creature-name {
        font-weight: 600;
        font-size: 0.95rem;
    }
    .search-header input {
        width: 100%;
        padding: 0.4rem 0.6rem;
        border-radius: 0.5rem;
        border: 1px solid var(--background-modifier-border);
        background-color: var(--background-primary);
        color: var(--text-normal);
    }
    .search-header input:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--interactive-accent);
    }
    .loading {
        display: flex;
        justify-content: center;
        padding: 2rem 0;
    }
    .empty {
        text-align: center;
        color: var(--text-muted);
        padding: 2rem 0;
    }
    .results {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        overflow-y: auto;
    }
    .results li button {
        width: 100%;
        text-align: left;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 0.5rem;
        padding: 0.6rem 0.8rem;
        color: inherit;
        cursor: pointer;
        box-sizing: border-box;
        overflow-wrap: anywhere;
    }
    .results li button.selected {
        border-color: var(--interactive-accent);
        background: var(--background-secondary);
    }
    .results li button:hover {
        background: var(--background-secondary);
    }
    .results li button:focus {
        outline: none;
        box-shadow: 0 0 0 2px var(--interactive-accent);
    }
    .result-line {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        line-height: 1.2;
    }
    .result-name {
        font-weight: 600;
        overflow-wrap: anywhere;
    }
    .pill {
        background: var(--background-modifier-form-field);
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        color: var(--text-muted);
    }
    .selection-summary {
        margin-top: 1rem;
        padding: 0.75rem;
        border-radius: 0.5rem;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }
    .summary-header {
        font-weight: 600;
        display: flex;
        gap: 0.35rem;
        align-items: baseline;
    }
    .summary-name {
        font-weight: 700;
    }
    .summary-level {
        font-weight: 500;
        color: var(--text-muted);
    }
    .summary-meta {
        font-size: 0.85rem;
        color: var(--text-muted);
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
    }
    .concentration-flag.requires {
        color: var(--text-accent);
        font-weight: 600;
    }
    .concentration-flag.none {
        color: var(--text-muted);
    }
    .concentration-flag.unknown {
        color: var(--text-muted);
        font-style: italic;
    }
    .summary-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .cast-button {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        border-radius: 0.5rem;
        padding: 0.4rem 0.8rem;
        cursor: pointer;
    }
    .cast-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .open-button {
        border: 1px solid var(--background-modifier-border);
        border-radius: 0.5rem;
        padding: 0.4rem 0.8rem;
        background: var(--background-secondary);
        color: inherit;
        cursor: pointer;
    }
</style>
