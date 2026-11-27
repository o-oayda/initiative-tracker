import type { SRDMonster } from "src/types/creatures";
import { writable } from "svelte/store";
import { players } from "./players";
import { Creature } from "src/utils/creature";
import { pf2eCreatureLevel, type Pf2eAdjustment } from "src/utils/pf2e-adjustment";
export type EncounterCreature = SRDMonster | Creature;

function createEncounter() {
    const store = writable<Map<EncounterCreature, number>>(new Map());
    const { subscribe, set, update } = store;
    return {
        players,
        subscribe,
        add: (item: EncounterCreature) =>
            update((monsters) => {
                monsters.set(item, (monsters.get(item) ?? 0) + 1);
                return monsters;
            }),
        remove: (item: EncounterCreature) =>
            update((monsters) => {
                let existing = monsters.get(item);
                if (!existing) return monsters;
                if (existing == 1) {
                    monsters.delete(item);
                }
                if (existing > 1) {
                    monsters.set(item, existing - 1);
                }
                return monsters; // this line is important to update the store value !!
            }),
        delete: (item: EncounterCreature) =>
            update((monsters) => {
                monsters.delete(item);
                return monsters;
            }),
        set: (item: EncounterCreature, count: number) =>
            update((monsters) => {
                monsters.set(item, count);
                return monsters;
            }),
        setMultiple: (creatures: [item: EncounterCreature, count: number][]) =>
            update((monsters) => {
                for (const [item, count] of creatures) {
                    monsters.set(item, count);
                }
                return monsters;
            }),
        empty: () => set(new Map()),
        setPf2eAdjustment: (item: EncounterCreature, adjustment: Pf2eAdjustment) =>
            update((monsters) => {
                if (!monsters.has(item) || pf2eCreatureLevel(item.level) == null) return monsters;
                const adjusted = Creature.from(item);
                adjusted.setPf2eAdjustment(adjustment);
                // Replace only this encounter entry, preserving the bestiary creature.
                return new Map([...monsters].map(([creature, count]) =>
                    [creature === item ? adjusted : creature, count]
                ));
            }),
        update: (creature: EncounterCreature) =>
            update((monsters) => {
                monsters.set(creature, monsters.get(creature) ?? 1);
                return monsters;
            })
    };
}

export const encounter = createEncounter();
