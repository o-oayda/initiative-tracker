import { type Updater, derived, get, writable } from "svelte/store";
import {
    SortFunctions,
    type TableHeaderState
} from "src/builder/builder.types";
import { type SRDMonster } from "src/types/creatures";
import { convertFraction } from "../../../utils";
import type InitiativeTracker from "../../../main";
import { Modal } from "obsidian";
import copy from "fast-copy";
import { getId } from "../../../utils/creature";
import { pf2eCreatureLevel } from "../../../utils/pf2e-adjustment";

import { pf2eCreatureRarity, pf2eCreatureTraits } from "../../../utils/pf2e-traits";

export const playerCount = writable(0);

export class TableHeader {
    public active: boolean;
    id = getId();
    constructor(
        public text: string,
        public field: string,
        public type: SortFunctions,
        public func?: string
    ) {}
    private _func: (a: SRDMonster, b: SRDMonster) => number =
        this.getSortByType();
    private getSortByType() {
        switch (this.type) {
            case SortFunctions.LOCAL_COMPARE: {
                return (a: Record<string, any>, b: Record<string, any>) =>
                    String(this.getValue(a) ?? "").localeCompare(String(this.getValue(b) ?? ""));
            }
            case SortFunctions.CONVERT_FRACTION: {
                return (a: Record<string, any>, b: Record<string, any>) =>
                    this.numericValue(this.getValue(a)) -
                    this.numericValue(this.getValue(b));
            }
            case SortFunctions.CUSTOM: {
                return new Function("a", "b", this.func!) as (
                    a: SRDMonster,
                    b: SRDMonster
                ) => number;
            }
        }
    }

    public getValue(creature: Record<string, any>) {
        if (this.field === "pf2eTraits") return pf2eCreatureTraits(creature);
        if (this.field === "pf2eRarity") return pf2eCreatureRarity(creature);
        return this.field === "level"
            ? pf2eCreatureLevel(creature.level)
            : creature[this.field];
    }

    private numericValue(value: any): number {
        return this.field === "level" ? value ?? -Infinity : convertFraction(value ?? 0);
    }

    public sortAsc(a: SRDMonster, b: SRDMonster) {
        return this._func(a, b);
    }
    public sortDesc(a: SRDMonster, b: SRDMonster) {
        return this._func(b, a);
    }

    public toState(): TableHeaderState {
        return {
            text: this.text,
            field: this.field,
            type: this.type,
            ...(this.func && this.func.length ? { func: this.func } : {})
        };
    }

    public static fromState(state: TableHeaderState): TableHeader {
        return new TableHeader(state.text, state.field, state.type, state.func);
    }
    public static get defaultState() {
        return {
            text: "",
            field: "",
            type: SortFunctions.LOCAL_COMPARE
        };
    }
}

export const DEFAULT_HEADERS: TableHeaderState[] = [
    {
        text: "CR",
        field: "cr",
        type: SortFunctions.CONVERT_FRACTION
    },
    {
        text: "Type",
        field: "type",
        type: SortFunctions.LOCAL_COMPARE
    },
    {
        text: "Size",
        field: "size",
        type: SortFunctions.LOCAL_COMPARE
    },
    {
        text: "Alignment",
        field: "alignment",
        type: SortFunctions.LOCAL_COMPARE
    }
];

export const NAME_HEADER = TableHeader.fromState({
    text: "Name",
    field: "name",
    type: SortFunctions.LOCAL_COMPARE
});

export type BuiltTableStore = ReturnType<typeof createTable>;
export function createTable(plugin: InitiativeTracker, monsters: SRDMonster[]) {
    const pf2eHeaders: Record<string, TableHeaderState> = {
        cr: { text: "Level", field: "level", type: SortFunctions.CONVERT_FRACTION },
        type: { text: "Traits", field: "pf2eTraits", type: SortFunctions.LOCAL_COMPARE },
        alignment: { text: "Rarity", field: "pf2eRarity", type: SortFunctions.LOCAL_COMPARE }
    };
    const isPf2e = plugin.data.rpgSystem === "pathfinder2e";
    const toHeader = (header: TableHeaderState) => TableHeader.fromState(
        (isPf2e && pf2eHeaders[header.field]) || header
    );
    const toSavedHeader = (header: TableHeaderState) => {
        if (!isPf2e) return header;
        return DEFAULT_HEADERS.find(({ field }) => {
            const display = pf2eHeaders[field];
            return display?.field === header.field &&
                display.text === header.text && display.type === header.type && !header.func;
        }) ?? header;
    };
    if (!plugin.data.builder) {
        plugin.data.builder = {
            sidebarIcon: true,
            showParty: true,
            showXP: true
        };
    }
    if (!plugin.data.builder.headers) {
        plugin.data.builder.headers = copy(DEFAULT_HEADERS);
        plugin.saveSettings();
    }

    const store = writable<TableHeader[]>(
        plugin.data.builder.headers.map(toHeader)
    );
    const { subscribe, set, update } = store;
    const creatures = writable<SRDMonster[]>(copy(monsters));

    let sortDir = writable(true); //true == asc, false == des
    const allHeaders = derived(store, (headers) => {
        return [NAME_HEADER, ...headers];
    });
    const sort = (field: TableHeader) =>
        update((headers) => {
            if (field.active) {
                sortDir.update((v) => !v);
            } else {
                const curr = get(allHeaders).find((h) => h.active);
                if (curr) curr.active = false;
                field.active = true;
                sortDir.set(true);
            }

            creatures.update((creatures) => {
                creatures.sort(
                    get(sortDir)
                        ? field.sortAsc.bind(field)
                        : field.sortDesc.bind(field)
                );
                return creatures;
            });
            return headers;
        });
    function updateAndSave(updater: Updater<TableHeader[]>): void {
        update(updater);
        plugin.saveSettings();
    }
    return {
        allHeaders,
        subscribe,
        set,
        update,
        sort,
        sortDir,
        creatures,
        reset: () =>
            creatures.update(() => {
                return copy(monsters);
            }),
        setHeadersFromState: (headers: TableHeaderState[]) =>
            updateAndSave((_) => {
                plugin.data.builder.headers = headers.map(toSavedHeader);
                const newHeaders = headers.map(toHeader);
                const active = _.findIndex((h) => h.active);
                if (active >= 0 && active < newHeaders.length) {
                    newHeaders[active].active = true;
                }
                return newHeaders;
            }),
        resetToDefault: () =>
            updateAndSave((_) => {
                plugin.data.builder.headers = copy(DEFAULT_HEADERS);
                return plugin.data.builder.headers.map(toHeader);
            })
    };
}

