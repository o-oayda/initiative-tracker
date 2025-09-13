<script lang="ts">
    import type { Creature } from "src/utils/creature";
    import { tracker } from "src/tracker/stores/tracker";

    export let creature: Creature;

    const entries = () => Object.entries(creature.resourcesPerDay ?? {});
    let refresh = 0;
    const pluralize = (k: string) => (k?.endsWith("y") ? k.slice(0, -1) + "ies" : k + "s");
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    const parseWikiLink = (raw: string) => {
        const text = raw?.trim() ?? "";
        // Handle Fantasy Statblocks sentinel format: <STATBLOCK-WIKI-LINK>target|Display<STATBLOCK-WIKI-LINK>
        const sentinel = text.match(/^<STATBLOCK-WIKI-LINK>(.+?)<STATBLOCK-WIKI-LINK>$/);
        if (sentinel) {
            const content = sentinel[1];
            const [target, display] = content.split("|");
            return {
                isLink: true,
                target: target?.trim() ?? "",
                display: (display ?? target)?.trim() ?? ""
            } as const;
        }
        // Handle standard Obsidian wiki link: [[target|Display]] or [[target]]
        const m = text.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
        if (m) {
            const target = m[1];
            const display = m[2] ?? m[1];
            return { isLink: true, target, display } as const;
        }
        return { isLink: false, target: null, display: raw } as const;
    };
    const openInternal = (target: string) => {
        try {
            // Use creature.path as source if available for resolution
            const source = creature?.path ?? "";
            app.workspace.openLinkText(target, source, false);
        } catch (e) {
            // noop
        }
    };
    let hoverTimeout: NodeJS.Timeout = null;
    const tryHover = (evt: MouseEvent, target: string) => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
            try {
                const anchor = (evt.currentTarget as HTMLElement) ?? (evt.target as HTMLElement);
                // Trigger native hover (ensure it can render above modal via CSS)
                app.workspace.trigger("link-hover", {}, anchor, target, creature?.path ?? "");
            } catch (e) {
                // ignore
            }
        }, 300);
    };
    const cancelHover = () => {
        clearTimeout(hoverTimeout);
    };

    const dec = (spellName: string) => {
        const s = creature.resourcesPerDay?.[spellName];
        if (s?.atWill) return;
        if (!s) return;
        s.remaining = Math.max(0, (s.remaining ?? s.perDay) - 1);
        // Force Svelte to re-render after nested mutation
        creature = creature;
        refresh += 1;
        tracker.refresh();
    };
    const inc = (spellName: string) => {
        const s = creature.resourcesPerDay?.[spellName];
        if (s?.atWill) return;
        if (!s) return;
        s.remaining = Math.min(s.perDay, (s.remaining ?? 0) + 1);
        // Force Svelte to re-render after nested mutation
        creature = creature;
        refresh += 1;
        tracker.refresh();
    };
    const resetAll = () => {
        for (const [, info] of entries()) {
            info.remaining = info.perDay;
        }
        // Force Svelte to re-render after nested mutation
        creature = creature;
        refresh += 1;
        tracker.refresh();
    };
</script>

<div class="spell-casting">
    {#if !entries().length}
        <em>No per‑day resources found.</em>
    {:else}
        <div class="list">
            {#key refresh}
                {#each Array.from(new Set(Object.values(creature.resourcesPerDay ?? {}).map((r) => (r.kind ?? 'spell')))) as kind}
                    <div class="kind-header">{cap(pluralize(kind))}</div>
                    {#each entries().filter(([_, info]) => (info.kind ?? 'spell') === kind) as [name, info]}
                        <div class="row">
                            <div class="name">
                                {#if parseWikiLink(name).isLink}
                                    <a
                                        class="internal-link"
                                        href={parseWikiLink(name).target}
                                        data-href={parseWikiLink(name).target}
                                        on:click|preventDefault|stopPropagation={() => openInternal(parseWikiLink(name).target)}
                                        on:mouseover={(evt) => tryHover(evt, parseWikiLink(name).target)}
                                        on:mouseleave={cancelHover}
                                    >{parseWikiLink(name).display}</a>
                                {:else}
                                    {name}
                                {/if}
                            </div>
                            <div class="controls">
                                {#if info.atWill}
                                    <span class="at-will">(at will)</span>
                                {:else}
                                    <button class="btn" on:click={() => dec(name)} aria-label={`Use one ${name}`}>−</button>
                                    <span class="count">{info.remaining}/{info.perDay}</span>
                                    <button class="btn" on:click={() => inc(name)} aria-label={`Restore one ${name}`}>+</button>
                                {/if}
                            </div>
                        </div>
                    {/each}
                {/each}
            {/key}
        </div>
        <div class="footer">
            <button class="reset" on:click={resetAll}>Reset All</button>
        </div>
    {/if}
    
</div>

<style scoped>
    .spell-casting {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: 20rem;
        max-width: 32rem;
        max-height: 60vh;
    }
    .list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        overflow: auto;
    }
    .kind-header {
        margin-top: 0.25rem;
        font-size: 0.9rem;
        font-weight: var(--font-semibold);
        color: var(--text-muted);
        text-transform: none;
    }
    .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.25rem 0;
        border-bottom: 1px solid var(--background-modifier-border);
    }
    .row:last-child { border-bottom: none; }
    .name { font-weight: var(--font-semibold); }
    .controls {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
    }
    .btn {
        padding: 0 0.4rem;
        min-width: 1.25rem;
        height: 1.25rem;
        line-height: 1.25rem;
        font-size: 0.8rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 0.2rem;
        background: var(--background-secondary);
        color: var(--text-muted);
        cursor: pointer;
    }
    .btn:hover {
        color: var(--text-normal);
        background: var(--background-modifier-form-field);
    }
    .count { min-width: 3.5rem; text-align: center; }
    .footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.5rem;
    }
    .reset {
        padding: 0.25rem 0.5rem;
    }
    /* Ensure Obsidian's native hover popover appears above the modal */
    :global(.popover),
    :global(.hover-popover) {
        z-index: 100000 !important;
    }
</style>
