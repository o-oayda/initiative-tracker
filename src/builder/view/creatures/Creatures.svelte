<script lang="ts">
    import Creature from "./Creature.svelte";
    import { getContext } from "svelte";
    import Filters from "../filters/Filters.svelte";
    import { Menu, Notice, setIcon } from "obsidian";
    import Pagination from "./Pagination.svelte";
    import type { BuiltFilterStore } from "../../stores/filter/filter";

    import type { BuiltTableStore } from "../../stores/table/table";
    import { HeadersModal } from "src/builder/stores/table/headers-modal";
    import { FiltersModal } from "src/builder/stores/filter/filters-modal";
    import type InitiativeTracker from "src/main";
    import Ajv from "ajv";
    import schema from "../../stores/filter/filter-schema.json";
    import type { BuilderState } from "src/builder/builder.types";
    import { pf2eCreatureTraits } from "src/utils/pf2e-traits";

    const table = getContext<BuiltTableStore>("table");
    const { sortDir, allHeaders, creatures } = table;
    const filterStore = getContext<BuiltFilterStore>("filters");
    const { filtered, layout } = filterStore;
    const plugin = getContext<InitiativeTracker>("plugin");

    let slice = 50;

    const sortUp = (node: HTMLElement) => {
        setIcon(node, "chevron-up");
    };
    const sortDown = (node: HTMLElement) => {
        setIcon(node, "chevron-down");
    };

    const settingsMenu = (evt: CustomEvent<MouseEvent>) => {
        const menu = new Menu();
        menu.addItem((item) => {
            item.setTitle("Edit Headers").onClick(() => {
                openHeadersModal();
            });
        })
            .addItem((item) => {
                item.setTitle("Edit Filters").onClick(() => {
                    openFiltersModal();
                });
            })
            .addSeparator()
            .addItem((item) => {
                item.setTitle("Export").onClick(() => {
                    const link = createEl("a");
                    const file = new Blob(
                        [JSON.stringify(plugin.data.builder)],
                        {
                            type: "json"
                        }
                    );
                    const url = URL.createObjectURL(file);
                    link.href = url;
                    link.download = `initiative-tracker-encounter-builder.json`;
                    link.click();
                });
            })
            .addItem((item) => {
                item.setTitle("Import").onClick(() => {
                    //validate;
                    const ajv = new Ajv();

                    // validate is a type guard for MyData - type is inferred from schema type
                    const validate = ajv.compile<BuilderState>(schema);
                    const input = createEl("input", {
                        attr: {
                            type: "file",
                            name: "builder_state",
                            accept: ".json"
                        }
                    });
                    input.onchange = async () => {
                        const { files } = input;
                        if (!files.length) return;

                        const reader = new FileReader();
                        reader.onload = async (
                            event: ProgressEvent<FileReader>
                        ) => {
                            if (typeof event.target.result == "string") {
                                let json: any;
                                try {
                                    json = JSON.parse(event.target.result);
                                } catch (e) {
                                    new Notice(
                                        "There was an issue parsing the file as JSON."
                                    );
                                }
                                if (validate(json)) {
                                    plugin.data.builder = { ...json };
                                    await plugin.saveSettings();
                                    filterStore.resetLayout();
                                } else {
                                    console.log(
                                        ...validate.errors.map((e) => e.message)
                                    );
                                    new Notice(
                                        "This file does not match the builder state schema."
                                    );
                                }
                            }
                        };
                        reader.readAsText(files[0]);
                    };
                    input.click();
                });
            });
        menu.showAtMouseEvent(evt.detail);
    };
    const openFiltersModal = () => {
        const modal = new FiltersModal($layout, filterStore);
        modal.open();
        modal.onClose = () => {
            if (modal.canceled) return;
            $layout = modal.layout;
        };
    };
    const openHeadersModal = () => {
        const modal = new HeadersModal($table.map((t) => t.toState()));
        modal.open();
        modal.onClose = () => {
            if (modal.canceled) return;
            if (modal.reset) {
                table.resetToDefault();
                return;
            }
            table.setHeadersFromState(modal.headers);
        };
    };

    let page = 1;
    let selectedTraits: string[] = [];
    let traitSearch = "";
    const startsWithLetter = /^\p{L}/u;
    const isPf2e = plugin.data.rpgSystem === "pathfinder2e";
    $: availableTraits = isPf2e
        ? [...new Set($creatures.flatMap(pf2eCreatureTraits))].sort((a, b) => Number(startsWithLetter.test(b)) - Number(startsWithLetter.test(a)) || a.localeCompare(b))
        : [];
    $: visibleTraits = availableTraits.filter(trait => trait.includes(traitSearch.trim().toLowerCase()));
    $: matches = selectedTraits.length
        ? $filtered.filter(creature => {
            const traits = pf2eCreatureTraits(creature);
            return selectedTraits.every(trait => traits.includes(trait));
        })
        : $filtered;
    $: pages = Math.max(1, Math.ceil(matches.length / slice));
    $: page = Math.min(page, pages);

    function toggleTrait(trait: string) {
        selectedTraits = selectedTraits.includes(trait)
            ? selectedTraits.filter(selected => selected !== trait)
            : [...selectedTraits, trait];
        page = 1;
    }
</script>

<div class="filters">
    <Filters on:settings={(evt) => settingsMenu(evt)} />
</div>

{#if $allHeaders.length}
    <table class:pf2e-table={isPf2e}>
        {#if isPf2e}
            <colgroup>
                {#each $allHeaders as header}
                    <col class:traits-column={header.field === "pf2eTraits"}
                        class:level-column={header.field === "level"}
                        class:detail-column={header.field === "size" || header.field === "pf2eRarity"} />
                {/each}
            </colgroup>
        {/if}
        <thead>
            {#each $allHeaders as header (header.text)}
                <th on:click={() => {
                    if (header.field !== "pf2eTraits") table.sort(header);
                }}>
                    {#if header.field === "pf2eTraits"}
                        <div class="trait-heading">
                            <details class="trait-picker">
                                <summary>{header.text}</summary>
                                <div class="trait-options" aria-label="Required traits">
                                    <input class="trait-search" type="search" placeholder="Search traits"
                                        aria-label="Search traits" bind:value={traitSearch} />
                                    {#each visibleTraits as trait (trait)}
                                        <label>
                                            <input type="checkbox" checked={selectedTraits.includes(trait)}
                                                on:change={() => toggleTrait(trait)} />
                                            {trait}
                                        </label>
                                    {:else}
                                        <span>No matching traits</span>
                                    {/each}
                                </div>
                            </details>
                            {#each selectedTraits as trait}
                                <button type="button" class="selected-trait"
                                    aria-label={`Remove required trait: ${trait}`}
                                    on:click={() => toggleTrait(trait)}>
                                    {trait} ×
                                </button>
                            {/each}
                        </div>
                    {:else}
                    <div class="table-header">
                        <span class="table-header-content">{header.text}</span>
                        {#if header.active}
                            {#if $sortDir}
                                <div class="has-icon" use:sortUp />
                            {:else}
                                <div class="has-icon" use:sortDown />
                            {/if}
                        {/if}
                    </div>
                    {/if}
                </th>
            {/each}
        </thead>
        <tbody>
            {#each matches.slice((page - 1) * slice, page * slice) as creature}
                <Creature {creature} {selectedTraits} on:toggle-trait={(event) => toggleTrait(event.detail)} />
            {:else}
                <tr><td colspan={$allHeaders.length}>No matching creatures</td></tr>
            {/each}
        </tbody>
    </table>
{/if}

<Pagination
    {slice}
    {page}
    {pages}
    on:slice={(evt) => (slice = evt.detail)}
    on:previous={() => (page = page - 1)}
    on:next={() => (page = Math.min(page + 1, pages))}
    on:page={(evt) => (page = evt.detail)}
/>

<style scoped>
    .pf2e-table {
        table-layout: fixed;
        overflow-wrap: anywhere;
    }
    .traits-column { width: 27%; }
    .level-column { width: 9%; }
    .detail-column { width: 14%; }
    .trait-search {
        position: sticky;
        top: 0;
        width: 100%;
        margin-bottom: 0.25rem;
        background-color: var(--background-primary);
    }
    .trait-heading {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.25rem;
    }
    .trait-picker {
        position: relative;
    }
    .trait-picker summary {
        cursor: pointer;
        white-space: nowrap;
    }
    .trait-options {
        position: absolute;
        z-index: 5;
        inset-inline-start: 0;
        top: 100%;
        width: 11rem;
        max-height: 15rem;
        overflow: auto;
        padding: 0.35rem;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: var(--radius-s);
        box-shadow: var(--shadow-s);
    }
    .trait-options label {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.15rem;
        cursor: pointer;
        overflow-wrap: anywhere;
    }
    .selected-trait {
        height: auto;
        max-width: 100%;
        white-space: normal;
        padding: 0.15em 0.45em;
        border: 2px solid #d9c484;
        border-radius: 0;
        background: var(--statblock-color-trait, #560c06);
        color: #fff;
        font-size: 0.75em;
        text-transform: uppercase;
    }
    .filters {
        margin: 1rem 0;
    }
    .table-header {
        display: flex;
        gap: 0.25rem;
    }

    .has-icon {
        display: flex;
        align-items: center;
    }

    table {
        width: 100%;
    }
</style>
