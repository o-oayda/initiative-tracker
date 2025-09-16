<script lang="ts">
    import { SyncLoader } from "svelte-loading-spinners";
    import { onMount, setContext } from "svelte";
    import type InitiativeTracker from "src/main";
    import type { Creature } from "src/utils/creature";

    export let plugin: InitiativeTracker;
    export let creature: Creature;
    export let mode: "spell" | "power";

    setContext<InitiativeTracker>("plugin", plugin);

    type Entry = {
        path: string;
        name: string;
        level: number | null;
        tags: string[];
    };

    let entries: Entry[] = [];
    let loading = true;
    let query = "";
    $: creatureName = creature?.getName?.() ?? creature?.name ?? "";

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

    const tagPrefix = mode === "spell" ? "spell/level/" : "power/level/";

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
                    <button type="button" on:click={() => openFile(entry)}>
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
</div>

<style scoped>
    :global(.player-resource-modal-content) {
        padding: 0.75rem 0.75rem 1rem;
    }
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
</style>
