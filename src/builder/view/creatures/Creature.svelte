<script lang="ts">
    import type { SRDMonster } from "src/types/creatures";
    import { ExtraButtonComponent, setIcon } from "obsidian";
    import { createEventDispatcher, getContext } from "svelte";
    import { encounter } from "../../stores/encounter";
    import Nullable from "../Nullable.svelte";
    import { convertFraction, DEFAULT_UNDEFINED } from "src/utils";
    import CreatureName from "../CreatureName.svelte";
    import type { createTable } from "src/builder/stores/table/table";

    const { players } = encounter;
    const { average } = players;

    const table = getContext<ReturnType<typeof createTable>>("table");

    export let creature: SRDMonster;
    export let selectedTraits: string[] = [];
    const dispatch = createEventDispatcher<{ "toggle-trait": string }>();
    const add = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon("plus-with-circle");
    };
    function stringify(
        property: Record<string, any> | string | any[] | number | boolean,
        depth: number = 0,
        joiner: string = " ",
        parens = true
    ): string {
        const ret = [];
        if (depth == 5) {
            return "";
        }
        if (property == null) return ``;
        if (typeof property == "string") return property;
        if (typeof property == "number") return `${property}`;
        if (Array.isArray(property)) {
            ret.push(
                `${parens ? "(" : ""}${property
                    .map((p) => stringify(p, depth++))
                    .join(joiner)}${parens ? ")" : ""}`
            );
        } else if (typeof property == "object") {
            for (const value of Object.values(property)) {
                ret.push(stringify(value, depth++));
            }
        }
        return ret.join(" ");
    }

    function getSource(source: string | string[]): string {
        if (!Array.isArray(source)) return source;
        let sliced = source.slice(0, 2);
        if (source.length > 2) {
            sliced.push(`and ${source.length - 2} more`);
        }

        return stringify(sliced, 0, ", ", false);
    }
    function getTooltip(source: string | string[]): string {
        if (!Array.isArray(source)) return "";
        return stringify(source, 0, ", ", false);
    }

    $: insignificant =
        "cr" in creature &&
        creature.cr &&
        convertFraction(creature.cr) < $average - 3;
    $: challenge =
        "cr" in creature &&
        creature.cr &&
        convertFraction(creature.cr) > $average + 3;

    const baby = (node: HTMLElement) => setIcon(node, "baby");
    const skull = (node: HTMLElement) => setIcon(node, "skull");
</script>

<tr class="creature">
    <td>
        <div class="creature-name-container">
            <div use:add on:click={() => encounter.add(creature)} />
            <!-- svelte-ignore a11y-mouse-events-have-key-events -->
            <div class="setting-item-name creature-name">
                <CreatureName {creature} />
                {#if insignificant}
                    <div
                        class="contains-icon"
                        use:baby
                        aria-label={"This creature is significantly under the average party level and might not contribute much to the fight."}
                    />
                {/if}
                {#if challenge}
                    <div
                        class="contains-icon"
                        use:skull
                        aria-label={"This creature is significantly over the average party level and might prove a challenge."}
                    />
                {/if}
            </div>
            <div class="setting-item-description">
                {#if creature.source?.length}
                    <span aria-label={getTooltip(creature.source)}>
                        {getSource(creature.source)}
                    </span>
                {/if}
            </div>
            <!-- <div class="creature-name">
            </div> -->
            <!-- svelte-ignore a11y-mouse-events-have-key-events -->
        </div>
    </td>
    {#each $table as header}
        {@const value = header.getValue(creature)}
        <td>
            {#if header.field === "pf2eTraits" && value.length}
                <div class="pf2e-traits">
                    {#each value as trait}
                        <button
                            type="button"
                            class="pf2e-chip trait-button"
                            aria-pressed={selectedTraits.includes(trait)}
                            on:click={() => dispatch("toggle-trait", trait)}
                        >{trait}</button>
                    {/each}
                </div>
            {:else if header.field === "pf2eRarity"}
                <span class="pf2e-chip rarity-{value}">{value}</span>
            {:else}
                <Nullable str={header.field === "pf2eTraits" ? DEFAULT_UNDEFINED : value ?? DEFAULT_UNDEFINED} />
            {/if}
        </td>
    {/each}
</tr>

<style scoped>
    .pf2e-traits {
        display: flex;
        flex-wrap: wrap;
        gap: 0.2rem;
        max-width: 15rem;
    }
    .pf2e-chip {
        display: inline-block;
        background-color: var(--statblock-color-trait, #560c06);
        border: 2px solid #d9c484;
        color: #fff;
        padding: 0.15em 0.45em;
        font-size: 0.75em;
        font-weight: 800;
        text-transform: uppercase;
    }
    .rarity-common { background-color: var(--statblock-color-common, #36454f); }
    .pf2e-traits .trait-button {
        height: auto;
        border-radius: 0;
        box-shadow: none;
        cursor: pointer;
    }
    .trait-button[aria-pressed="true"] {
        outline: 2px solid var(--interactive-accent);
        outline-offset: 1px;
    }
    .rarity-uncommon { background-color: var(--statblock-color-uncommon, #8f5542); }
    .rarity-rare { background-color: var(--statblock-color-rare, #0b2560); }
    .rarity-unique { background-color: var(--statblock-color-unique, #4d1b6a); }
    .creature-name-container {
        /* display: flex;
        align-items: center;
        gap: 0.5rem; */
        display: grid;
        grid-template-areas:
            "add name"
            ". desc";
        justify-content: flex-start;
        align-items: center;
        grid-template-columns: auto 1fr;
    }
    .creature-name {
        display: flex;
        justify-content: space-between;
    }
    .setting-item-description {
        grid-area: desc;
    }
    /* .creature-name > div {
        display: flex;
        align-items: center;
    } */
</style>
