<script lang="ts">
    import { ExtraButtonComponent, setIcon } from "obsidian";
    import type { Condition } from "src/types/creatures";
    import { createEventDispatcher, getContext } from "svelte";
    import type InitiativeTracker from "src/main";
    import { findConditionNote, previewTrackerLink } from "src/utils/condition-link";
    
    const dispatch = createEventDispatcher();

    export let status: Condition;
    export let concentration = false;
    $: link = status.link ?? findConditionNote(plugin.app, status.name);
    if (isNaN(status.amount) || status.amount < 0) {
        status.amount = status.startingAmount;
    }
    const deleteIcon = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon("cross-in-box");
    };
    const minus = (node: HTMLElement) => {
        setIcon(node, "minus");
    };
    const plus = (node: HTMLElement) => {
        setIcon(node, "plus");
    };


    const plugin = getContext<InitiativeTracker>("plugin");
</script>

<!-- svelte-ignore a11y-unknown-aria-attribute -->
<div
    class="tag"
    class:concentration={concentration}
    class:spell={status.kind?.toLowerCase?.() === 'spell'}
    class:power={status.kind?.toLowerCase?.() === 'power'}
    class:other={concentration && status.kind?.toLowerCase?.() !== 'spell' && status.kind?.toLowerCase?.() !== 'power'}
>
    <span
        aria-label-classes="initiative-tracker-condition-tooltip"
        aria-label={!link && status.description?.length ? status.description : null}
    >
        {#if link}
            <a
                class="internal-link"
                href={link}
                data-href={link}
                on:click|preventDefault|stopPropagation={() => plugin.app.workspace.openLinkText(link, "/", false)}
                on:mouseover={(evt) => previewTrackerLink(plugin.app, evt, link)}
            >{status.linkText ?? (concentration ? link : status.name)}</a>
        {:else}
            {status.name}
        {/if}
    </span>
    {#if status.hasAmount}
        <div class="amount">
            <div
                class="icon"
                use:minus
                on:click={() => {
                    status.amount--;
                    if (status.amount <= 0) dispatch("remove");
                    else dispatch("amountChange");
                }}
            />
            <span>{status.amount}</span>
            <div class="icon" use:plus on:click={() => {
                status.amount++;
                dispatch("amountChange");
            }} />
        </div>
    {/if}
    <div use:deleteIcon on:click={() => dispatch("remove")} />
</div>

<style>
    .amount,
    .tag {
        display: flex;
        align-items: center;
        gap: 0.125rem;
    }
    .tag {
        color: var(--text-muted);
        font-size: 0.7rem;
        width: fit-content;
        border-color: var(--border-color);
        border-radius: 0.25rem;
        padding: 0 0.25rem;
    }
    .tag.concentration {
        color: var(--text-normal);
        border-color: transparent;
        padding: 0 0.35rem;
        border-radius: 0.25rem;
    }
    .tag.concentration.spell {
        background-color: rgba(var(--color-blue-rgb, 59, 130, 246), 0.15);
        border: 1px solid rgba(var(--color-blue-rgb, 59, 130, 246), 0.35);
    }
    .tag.concentration.power {
        background-color: rgba(var(--color-pink-rgb, 236, 72, 153), 0.15);
        border: 1px solid rgba(var(--color-pink-rgb, 236, 72, 153), 0.35);
    }
    .tag.concentration.other {
        background-color: rgba(var(--color-orange-rgb, 245, 158, 11), 0.15);
        border: 1px solid rgba(var(--color-orange-rgb, 245, 158, 11), 0.35);
    }
    /* Tame the wikilink color inside concentration tags */
    .tag.concentration :global(a.internal-link) {
        color: var(--text-normal) !important;
        text-decoration: none !important;
        font-weight: normal;
    }
    .tag :global(.clickable-icon) {
        margin: 0;
        transform-origin: center;
        width: 16px;
        height: 16px;
        padding: 0;
    }
    .icon {
        display: flex;
        align-items: center;
    }
</style>
