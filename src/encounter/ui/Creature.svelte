<script lang="ts">
    import { setIcon } from "obsidian";
    import type InitiativeTracker from "src/main";
    import { FRIENDLY, HIDDEN, RANDOM_HP, getRpgSystem } from "src/utils";
    import type { Creature } from "src/utils/creature";
    import { getContext } from "svelte";

    const plugin = getContext<InitiativeTracker>("plugin");
    const rpgSystem = getRpgSystem(plugin);

    export let creature: Creature;
    export let count: string | number;
    export let xp: number;
    export let shouldShowRoll: boolean;

    const creatureLabel = (creature: Creature, count: string | number) => {
        const plural = Number(count) === 1 ? "" : "s";
        const adjustment = creature.pf2eAdjustment === "weak" ? " (W)" : creature.pf2eAdjustment === "elite" ? " (E)" : "";
        const display = `${creature.display ?? creature.name}${plural}${adjustment}`;
        return creature.display && creature.display !== creature.name ? `${display} (${creature.name})` : display;
    };

    const rollEl = (node: HTMLElement) => {
        setIcon(node, RANDOM_HP);
    };
    const friendly = (node: HTMLElement) => {
        setIcon(node, FRIENDLY);
    };
    const hidden = (node: HTMLElement) => {
        setIcon(node, HIDDEN);
    };
</script>

<slot />
<div class="creature-container">
    {#if creature.friendly}
        <span class="has-icon" use:friendly />
    {/if}
    {#if creature.hidden}
        <span class="has-icon" use:hidden />
    {/if}
    <span class="creature-name" on:click={() => plugin.openCombatant(creature)}>
        {creatureLabel(creature, count)}
        {#if shouldShowRoll && creature.hit_dice?.length}
            <span class="has-icon" aria-label="Rolling for HP" use:rollEl />
        {/if}
    </span>
    {#if xp}
        <span class="xp-parent">
            <span class="paren left">&nbsp;(</span>
            <span class="xp-container">
                <span class="xp number"
                    >{rpgSystem.formatDifficultyValue(xp)}</span
                >
                <span class="xp text">{rpgSystem.valueUnit}</span>
            </span>
            <span class="paren right">)</span>
        </span>
    {/if}
</div>

<style>
    .has-icon,
    .creature-container {
        display: inline-flex;
        align-items: center;
    }
    .creature-name {
        cursor: pointer;
    }
    .creature-name {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }
    .has-icon {
        display: flex;
        align-items: center;
    }
    .xp-parent {
        display: inline-flex;
    }
</style>
