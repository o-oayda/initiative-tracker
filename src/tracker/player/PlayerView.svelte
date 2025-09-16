<script lang="ts">
    import { setIcon } from "obsidian";
    import { fade } from "svelte/transition";
    import { SyncLoader } from "svelte-loading-spinners";

    import { AC, FRIENDLY, HP, INITIATIVE, RESTART } from "src/utils";
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
    let timerStarted = false;
    let paused = false;

    const clearTimerInterval = () => {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    };

    const resetTimer = () => {
        clearTimerInterval();
        turnStart = null;
        elapsedMs = 0;
        activeTurnId = null;
        timerStarted = false;
        paused = false;
    };

    const prepareIdleTimer = () => {
        clearTimerInterval();
        turnStart = null;
        elapsedMs = 0;
        timerStarted = false;
        paused = false;
    };

    const startTimer = () => {
        clearTimerInterval();
        turnStart = Date.now();
        elapsedMs = 0;
        timerStarted = true;
        paused = false;
        timerInterval = setInterval(() => {
            if (turnStart !== null) {
                elapsedMs = Date.now() - turnStart;
            }
        }, 1000);
    };

    const resumeTimer = () => {
        clearTimerInterval();
        turnStart = Date.now() - elapsedMs;
        timerStarted = true;
        paused = false;
        timerInterval = setInterval(() => {
            if (turnStart !== null) {
                elapsedMs = Date.now() - turnStart;
            }
        }, 1000);
    };

    const pauseTimer = () => {
        if (!timerStarted || paused) return;
        if (turnStart !== null) {
            elapsedMs = Date.now() - turnStart;
        }
        clearTimerInterval();
        turnStart = null;
        paused = true;
    };

    const resetCurrentTimer = () => {
        if (!activeTurnId) return;
        if ($state) {
            startTimer();
            return;
        }
        if (timerStarted || paused) {
            clearTimerInterval();
            elapsedMs = 0;
            turnStart = null;
            paused = true;
            timerStarted = true;
        }
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
        resetTimer();
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
    const wandIcon = (node: HTMLElement) => {
        setIcon(node, "wand");
    };
    const brainIcon = (node: HTMLElement) => {
        setIcon(node, "brain");
    };
    const sparklesIcon = (node: HTMLElement) => {
        setIcon(node, "sparkles");
    };
    const pauseIcon = (node: HTMLElement) => {
        setIcon(node, "pause");
    };
    const resetIcon = (node: HTMLElement) => {
        setIcon(node, RESTART);
    };

    $: activeCreature = $ordered.find((creature) => creature.active);

    $: {
        if (!activeCreature) {
            resetTimer();
        } else {
            if (activeCreature.id !== activeTurnId) {
                activeTurnId = activeCreature.id;
                if ($state) {
                    startTimer();
                } else {
                    prepareIdleTimer();
                }
            } else if ($state) {
                if (!timerStarted) {
                    startTimer();
                } else if (turnStart === null && paused) {
                    resumeTimer();
                }
            } else if (timerStarted && !paused) {
                pauseTimer();
            }
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
                <tr
                    class:active={amIActive(creature) && $state}
                    class:paused-active={amIActive(creature) && !$state}
                >
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
                <td class="concentrating-cell">
                    <div class="concentrating-list">
                        {#if creature.concentration?.size}
                            {#each [...creature.concentration] as status}
                                <div class="concentrating-line">
                                    <span class="concentration-icon" class:spell={status.kind === 'spell'} class:power={status.kind === 'power'}>
                                        {#if status.kind === 'spell'}
                                            <span class="icon" use:wandIcon aria-hidden="true" />
                                        {:else if status.kind === 'power'}
                                            <span class="icon" use:brainIcon aria-hidden="true" />
                                        {:else}
                                            <span class="icon" use:sparklesIcon aria-hidden="true" />
                                        {/if}
                                    </span>
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

    {#if activeTurnId !== null && (timerStarted || paused)}
        <div class="turn-timer" class:paused={paused}>
            <div class="timer-header">
                <span class="timer-label">Turn Timer</span>
            </div>
            <div class="timer-value">
                <button
                    class="timer-reset"
                    type="button"
                    on:click={resetCurrentTimer}
                    aria-label="Reset turn timer"
                    title="Reset turn timer"
                >
                    <span class="reset-icon" aria-hidden="true" use:resetIcon />
                </button>
                {#if paused}
                    <span
                        class="timer-status"
                        aria-label="Timer paused"
                        title="Timer paused"
                    >
                        <span class="pause-icon" aria-hidden="true" use:pauseIcon />
                    </span>
                {/if}
                <span class="timer-digits">{formatElapsed(elapsedMs)}</span>
            </div>
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
        align-items: flex-start;
        text-align: left;
    }
    .concentrating-line {
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
    }
    .concentrating-cell {
        text-align: left;
        vertical-align: top;
    }
    .concentration-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1.25rem;
    }
    .concentration-icon .icon {
        display: inline-flex;
        width: 1rem;
        height: 1rem;
    }
    .concentration-icon .icon :global(svg) {
        width: 100%;
        height: 100%;
    }
    .active {
        background-color: rgba(0, 0, 0, 0.1);
    }
    :global(.theme-dark) .active {
        background-color: rgba(255, 255, 255, 0.1);
    }
    .paused-active {
        background-color: inherit;
        background-image: repeating-linear-gradient(
            45deg,
            transparent 0,
            transparent 8px,
            rgba(0, 0, 0, 0.1) 8px,
            rgba(0, 0, 0, 0.1) 16px
        );
    }
    :global(.theme-dark) .paused-active {
        background-color: inherit;
        background-image: repeating-linear-gradient(
            45deg,
            transparent 0,
            transparent 8px,
            rgba(255, 255, 255, 0.1) 8px,
            rgba(255, 255, 255, 0.1) 16px
        );
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
        gap: 0.2rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    .turn-timer.paused {
        opacity: 0.9;
    }
    .timer-header {
        display: flex;
        align-items: center;
    }
    .turn-timer .timer-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
    }
    .timer-value {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .timer-reset {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 999px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        color: var(--text-muted);
        padding: 0;
        cursor: pointer;
    }
    .timer-reset:hover {
        color: var(--text-normal);
        background: var(--background-primary-alt);
    }
    .timer-reset:focus {
        outline: none;
        box-shadow: 0 0 0 1px var(--interactive-accent);
    }
    .timer-reset:active {
        transform: scale(0.95);
    }
    .timer-reset .reset-icon {
        display: inline-flex;
        width: 0.75rem;
        height: 0.75rem;
    }
    .timer-reset .reset-icon :global(svg) {
        width: 100%;
        height: 100%;
    }
    .timer-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1rem;
        height: 1rem;
        border-radius: 999px;
        background: var(--background-primary-alt);
        border: 1px solid var(--background-modifier-border);
    }
    .pause-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 0.75rem;
        height: 0.75rem;
    }
    .pause-icon :global(svg) {
        width: 100%;
        height: 100%;
    }
    .timer-digits {
        font-size: 1.25rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--text-normal);
    }
</style>
