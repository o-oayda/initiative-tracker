<script lang="ts">
    import { ExtraButtonComponent } from "obsidian";

    import type InitiativeTracker from "src/main";
    import { tracker } from "src/tracker/stores/tracker";
    import { START_ENCOUNTER, getRpgSystem } from "src/utils";
    import { Creature } from "src/utils/creature";
    import type { StackRoller } from "@javalent/dice-roller";
    import { setContext } from "svelte";

    export let creatures: Map<Creature, number | string>;

    export let plugin: InitiativeTracker;

    export let rollHP: boolean = plugin.data.rollHP;

    const creatureMap: Map<Creature, number> = new Map();
    const rollerMap: Map<Creature, StackRoller> = new Map();
    let totalXp: number | null = null;

    const updateTotalXp = () => {
        const rpgSystem = getRpgSystem(plugin);
        if (!creatureMap.size) {
            totalXp = null;
            return;
        }
        let sum = 0;
        for (const [creature, count] of creatureMap) {
            const xp = rpgSystem.getCreatureDifficulty(creature, []);
            const qty = Number(count) || 0;
            if (!isFinite(xp) || xp === undefined || xp === null) {
                totalXp = null;
                return;
            }
            sum += xp * qty;
        }
        totalXp = sum;
    };

    const setCreatureCount = (creature: Creature, value: number) => {
        creatureMap.set(creature, value);
        updateTotalXp();
    };

    for (let [creature, count] of creatures) {
        let number: number = Number(count);
        if (plugin.canUseDiceRoller) {
            let roller = plugin.getRoller(`${count}`);
            if (!roller) {
                setCreatureCount(creature, number);
            } else {
                roller.on("new-result", () => {
                    setCreatureCount(creature, roller.result);
                });
                rollerMap.set(creature, roller);
                roller.rollSync();
                setCreatureCount(creature, roller.result);
            }
        } else {
            setCreatureCount(creature, number);
        }
    }

    const openButton = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon(START_ENCOUNTER);
    };
    const open = async () => {
        if (!plugin.view) {
            await plugin.addTrackerView();
        }

        const view = plugin.view;
        const creatures: Creature[] = [...creatureMap]
            .map(([creature, number]) => {
                if (isNaN(Number(number)) || number < 1) return [creature];
                return [...Array(number).keys()].map((v) =>
                    Creature.new(creature)
                );
            })
            .flat();

        tracker.new(plugin, {
            creatures: creatures.map((c) => c.toJSON()),
            name: null,
            state: false,
            round: 1,
            logFile: null,
            newLog: true,
            roll: true
        });
        plugin.app.workspace.revealLeaf(view.leaf);
    };

    const addButton = (node: HTMLElement) => {
        new ExtraButtonComponent(node).setIcon("plus-with-circle");
    };

    const add = async (evt: MouseEvent) => {
        if (!plugin.view) {
            await plugin.addTrackerView();
        }
        const creatures: Creature[] = [...creatureMap]
            .map(([creature, number]) => {
                if (isNaN(Number(number)) || number < 1) return [creature];
                return [...Array(number).keys()].map((v) =>
                    Creature.new(creature)
                );
            })
            .flat();
        tracker.add(plugin, rollHP, ...creatures);
    };

    const rollerEl = (node: HTMLElement, creature: Creature) => {
        if (
            plugin.canUseDiceRoller &&
            rollerMap.has(creature) &&
            !rollerMap.get(creature)!.isStatic
        ) {
            node.appendChild(
                rollerMap.get(creature)?.containerEl ??
                    createSpan({ text: `${creatureMap.get(creature)}` })
            );
        } else {
            node.setText(`${creatureMap.get(creature)}`);
        }
    };

    const joiner = (index: number, length: number) => {
        if (length == 1 || index == 0) return "";
        const delim = length > 2 ? "," : "";
        if (index == length - 1) return `${delim} and `;
        return `${delim} `;
    };
    const label = (creature: Creature) => {
        if (!creature) return;
        let label = [];
        if (creature.hp) {
            label.push(`HP: ${creature.hp}`);
        }
        if (creature.ac) {
            label.push(`AC: ${creature.ac}`);
        }
        if (creature.modifier) {
            label.push(`MOD: ${creature.modifier}`);
        }
        return `${label.join(", ")}`;
    };
</script>

<span class="encounter-line encounter-row">
    <span>
        {#if creatures.size}
            {#each [...creatures] as [creature, count], index}
                <span aria-label={label(creature)}
                    >{joiner(index, creatures.size)}<strong
                        use:rollerEl={creature}
                    />
                    <span
                        class="creature-name"
                        on:click={() => plugin.openCombatant(creature)}
                        >{#if creature.display && creature.display != creature.name}{creature.display}{count ==
                            1
                                ? ""
                                : "s"} ({creature.name}){:else}{creature.name}{count ==
                            1
                                ? ""
                                : "s"}{/if}</span
                    ></span
                >
            {/each}
            {#if totalXp !== null}
                <span class="encounter-total-xp">Total XP: {totalXp}</span>
            {/if}
        {:else}
            -
        {/if}
    </span>
    <span class="icons">
        <span
            use:openButton
            on:click|stopPropagation={open}
            aria-label="Begin Encounter"
        />
        <span
            use:addButton
            on:click|stopPropagation={add}
            aria-label="Add to Encounter"
        />
    </span>
</span>

<style>
    .creature-name {
        cursor: pointer;
    }
    .encounter-line {
        display: flex;
        gap: 1rem;
    }
    .icons {
        display: flex;
    }
    .icons > span :global(.clickable-icon) {
        margin-right: 0;
    }
    .encounter-total-xp {
        margin-left: 0.75rem;
        font-style: italic;
        color: var(--text-muted);
    }
</style>
