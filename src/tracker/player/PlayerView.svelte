<script lang="ts">
    import { setIcon } from "obsidian";
    import { fade } from "svelte/transition";
    import { SyncLoader } from "svelte-loading-spinners";

    import { AC, FRIENDLY, HP, INITIATIVE } from "src/utils";
    import type { Creature } from "src/utils/creature";
    import { createEventDispatcher, onDestroy, setContext } from "svelte";
    import type InitiativeTracker from "src/main";

    import { tracker } from "../stores/tracker";
    const { state, ordered, data } = tracker;
    export let plugin: InitiativeTracker;
    setContext<InitiativeTracker>("plugin", plugin);

    let turnStart: number | null = null;
    let elapsedMs = 0;
    let timerInterval: ReturnType<typeof setInterval> | null = null;
    let activeTurnId: Creature["id"] | null = null;

    const stopTimer = () => {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        turnStart = null;
        elapsedMs = 0;
    };

    const startTimer = () => {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
        }
        turnStart = Date.now();
        elapsedMs = 0;
        timerInterval = setInterval(() => {
            if (turnStart !== null) {
                elapsedMs = Date.now() - turnStart;
            }
        }, 1000);
    };

    const formatElapsed = (ms: number) => {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60)
            .toString()
            .padStart(2, "0");
        const seconds = (totalSeconds % 60).toString().padStart(2, "0");
        return `${minutes}:${seconds}`;
    };

    onDestroy(() => {
        stopTimer();
    });

    const hoverLink = (evt: MouseEvent, href: string) => {
        try {
            plugin.app.workspace.trigger(
                "link-hover",
                {},
                evt.currentTarget as HTMLElement,
                href,
                "/"
            );
        } catch (e) {}
    };

    const hpIcon = (node: HTMLElement) => {
        setIcon(node, HP);
    };
    const acIcon = (node: HTMLElement) => {
        setIcon(node, AC);
    };
    const iniIcon = (node: HTMLElement) => {
        setIcon(node, INITIATIVE);
    };

    const getHpStatus = (hp: number, max: number) => {
        if (!hp) return "";
        if (hp <= 0) return "Defeated";
        if (hp < max / 2) return "Bloodied";
        if (hp < max) return "Hurt";
        return "Healthy";
    };

    const amIActive = (creature: Creature) => {
        if (creature.hidden) return false;
        if (creature.active) return true;

        const active = $ordered.findIndex((c) => c.active);
        const index = $ordered.indexOf(creature);
        if (active == -1 || active < index) return false;

        const remaining = $ordered.slice(index + 1, active + 1);
        if (remaining.every((c) => c.hidden)) return true;
        return false;
    };

    $: activeAndVisible = $ordered.filter((c) => c.enabled && !c.hidden);

    const name = (creature: Creature) => creature.getName();
    const friendIcon = (node: HTMLElement) => {
        setIcon(node, FRIENDLY);
    };

    $: {
        const active = $ordered.find((creature) => creature.active);
        if (!$state || !active) {
            activeTurnId = null;
            stopTimer();
        } else if (active.id !== activeTurnId) {
            activeTurnId = active.id;
            startTimer();
        }
    }
</script>

<div class="player-view-container">
    <table class="initiative-tracker-table" transition:fade>
        <thead class="tracker-table-header">
            <th style="width:5%"><strong use:iniIcon /></th>
            <th class="left" style="width:30%"><strong>Name</strong></th>
            <th style="width:15%" class="center"><strong use:hpIcon /></th>
            <th style="width:30%"><strong>Statuses</strong></th>
            <th style="width:25%" class="center"><strong>Concentrating</strong></th>
        </thead>
        <tbody>
            {#each activeAndVisible as creature (creature.id)}
                <tr class:active={amIActive(creature) && $state}>
                    <td class="center">{creature.initiative}</td>
                    <td class='name'>
                        <div class="name-content">
                            {#if creature.friendly}
                                <div
                                    class="contains-icon"
                                    use:friendIcon
                                    aria-label={`This creature is an ally.`}
                                />
                            {/if}
                            {name(creature)}
                        </div>
                    </td>
                    <td
                        class:center={true}
                        class={getHpStatus(creature.hp, creature.max).toLowerCase()}
                    >
                        {#if creature.player && $data.diplayPlayerHPValues}
                            <div class="center">{@html creature.hpDisplay}</div>
                        {:else}
                            <span>{getHpStatus(creature.hp, creature.max)}</span>
                        {/if}
                    </td>
                    <td class="center">
                        <div class="statuses-list">
                            {#each [...creature.status].filter((s) => !s.link) as status}
                                <div class="status-line">{status.name}</div>
                            {/each}
                        </div>
                    </td>
                    <td class="center">
                        <div class="concentrating-list">
                            {#if creature.concentration?.size}
                                {#each [...creature.concentration] as status}
                                    <div class="concentrating-line">
                                        <a
                                            class="internal-link"
                                            href={status.link}
                                            data-href={status.link}
                                            on:click|preventDefault={() => plugin.app.workspace.openLinkText(status.link, "/", false)}
                                            on:mouseenter={(evt) => hoverLink(evt, status.link)}
                                        >{status.linkText ?? status.link}</a>
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>

    {#if $state && turnStart !== null}
        <div class="turn-timer">
            <span class="timer-label">Turn Timer</span>
            <span class="timer-value">{formatElapsed(elapsedMs)}</span>
        </div>
    {/if}
</div>

<style scoped>
    .player-view-container {
        position: relative;
        height: 100%;
    }
    .full-center {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .initiative-tracker-table {
        padding: 0.5rem;
        align-items: center;
        gap: 0.25rem 0.5rem;
        width: 100%;
        margin-left: 0rem;
        table-layout: fixed;
        border-collapse: separate;
        border-spacing: 0 2px;
        font-size: larger;
    }
    .left {
        text-align: left;
    }
    td.name { vertical-align: middle; }
    .name-content, .name-content > :global(svg) {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .center {
        text-align: center;
    }
    .healthy {
        color: var(--text-success);
    }
    .hurt {
        color: var(--text-warning);
    }
    .bloodied {
        color: var(--text-error);
    }
    .defeated {
        color: var(--text-faint);
    }
    .statuses-inline {
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
    }
    .statuses-list {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        align-items: center; /* keep centered to match column */
        white-space: normal;
    }
    .status-line { white-space: normal; }
    .concentrating-inline { color: var(--text-accent); }
    .concentrating-list {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        align-items: center; /* keep centered to match column */
    }
    .concentrating-line { white-space: nowrap; }
    .active {
        background-color: rgba(0, 0, 0, 0.1);
    }
    :global(.theme-dark) .active {
        background-color: rgba(255, 255, 255, 0.1);
    }
    /* Subtle horizontal rules between rows */
    tbody tr td {
        border-bottom: 1px solid var(--background-modifier-border);
    }
    tbody tr:first-child td {
        border-top: 1px solid var(--background-modifier-border);
    }
    .turn-timer {
        position: absolute;
        bottom: 1rem;
        right: 1rem;
        background-color: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 0.5rem;
        padding: 0.35rem 0.75rem;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.1rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    .turn-timer .timer-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
    }
    .turn-timer .timer-value {
        font-size: 1.25rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--text-normal);
    }
</style>
