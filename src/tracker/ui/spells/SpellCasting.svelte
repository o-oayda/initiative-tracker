<script lang="ts">
    import type { Creature } from "src/utils/creature";
    import { tracker } from "src/tracker/stores/tracker";

    export let creature: Creature;

    const entries = () => Object.entries(creature.spellsPerDay ?? {});
    let refresh = 0;

    const dec = (spellName: string) => {
        const s = creature.spellsPerDay?.[spellName];
        if (!s) return;
        s.remaining = Math.max(0, (s.remaining ?? s.perDay) - 1);
        // Force Svelte to re-render after nested mutation
        creature = creature;
        refresh += 1;
        tracker.refresh();
    };
    const inc = (spellName: string) => {
        const s = creature.spellsPerDay?.[spellName];
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
        <em>No per‑day spells found.</em>
    {:else}
        <div class="list">
            {#key refresh}
                {#each entries() as [name, info]}
                    <div class="row">
                        <div class="name">{name}</div>
                        <div class="controls">
                            <button class="btn" on:click={() => dec(name)} aria-label={`Use one ${name}`}>−</button>
                            <span class="count">{info.remaining}/{info.perDay}</span>
                            <button class="btn" on:click={() => inc(name)} aria-label={`Restore one ${name}`}>+</button>
                        </div>
                    </div>
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
</style>
