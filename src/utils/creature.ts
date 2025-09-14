import type { Condition } from "src/types/creatures";
import type { HomebrewCreature } from "src/types/creatures";
import type { SRDMonster } from "src/types/creatures";
import type { CreatureState } from "src/types/creatures";
import { Conditions } from ".";
import { DEFAULT_UNDEFINED } from "./constants";
import type InitiativeTracker from "src/main";

export function getId() {
    return "ID_xyxyxyxyxyxy".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export class Creature {
    active: boolean;
    name: string;
    modifier: number | number[];
    hp: number;
    hit_dice?: string;
    rollHP?: boolean;
    temp: number;
    ac: number | string;
    current_ac: number | string;
    dirty_ac: boolean;
    note: string;
    enabled: boolean = true;
    hidden: boolean = false;
    max: number;
    current_max: number;
    level: number;
    player: boolean;
    status: Set<Condition> = new Set();
    /** Abilities currently under concentration (separate from normal statuses) */
    concentration: Set<Condition> = new Set();
    marker: string;
    initiative: number;
    manualOrder: number;
    static: boolean = false;
    source: string | string[];
    id: string;
    xp: number;
    viewing: boolean = false;
    number = 0;
    display: string;
    friendly: boolean = false;
    "statblock-link": string;
    cr: string | number;
    path: string;
    /**
     * Per-day resources, keyed by name.
     * e.g. { "Hold Person": { perDay: 2, remaining: 2, kind: "spell" } }
     */
    resourcesPerDay: { [name: string]: { perDay: number; remaining: number; kind?: string; atWill?: boolean } } = {};
    setModifier(modifier: number[] | number) {
        if (modifier) {
            if (Array.isArray(modifier)) {
                this.modifier = [...modifier];
            }
            if (!isNaN(Number(modifier))) {
                this.modifier = Number(modifier);
            }
        }
        this.modifier = this.modifier ?? 0;
    }
    addCondition(condition: Condition) {
        if (![...this.status].find(cond => cond.name === condition.name && cond.amount === condition.amount)) {
            this.status.add(condition);
        }
    }
    removeCondition(condition: Condition) {
        this.status = new Set(
            [...this.status].filter((s) => s.id != condition.id)
        );    }
    addConcentration(cond: Condition) {
        if (![...this.concentration].find(c => (c.linkText ?? c.name) === (cond.linkText ?? cond.name))) {
            this.concentration.add(cond);
        }
    }
    removeConcentration(cond: Condition) {
        this.concentration = new Set(
            [...this.concentration].filter((s) => s.id != cond.id && (s.linkText ?? s.name) !== (cond.linkText ?? cond.name))
        );
    }
    constructor(public creature: HomebrewCreature, initiative: number = 0) {
        this.name = creature.name;
        this.display = creature.display;
        this.initiative =
            "initiative" in creature
                ? (creature as Creature).initiative
                : Number(initiative ?? 0);
        this.static = creature.static ?? false;
        this.setModifier(creature.modifier);
        this.current_ac = this.ac = creature.ac ?? undefined;
        this.dirty_ac = false;
        this.max = this.current_max = creature.hp ? Number(creature.hp) : 0;
        this.note = creature.note;
        this.level = creature.level;
        this.player = creature.player;

        this.rollHP = creature.rollHP;

        this.marker = creature.marker;

        this.hp = this.max;
        this.temp = 0;
        this.source = creature.source;

        this.friendly = creature.friendly ?? this.friendly;

        this.active = creature.active;

        this.hidden = creature.hidden ?? false;

        this.note = creature.note;
        this.path = creature.path;

        this.xp = creature.xp;

        this.cr = creature.cr;
        this.id = creature.id ?? getId();
        if ("statblock-link" in creature) {
            this["statblock-link"] = (creature as any)[
                "statblock-link"
            ] as string;
        }
        if ("hit_dice" in creature && typeof creature.hit_dice == "string") {
            this.hit_dice = creature.hit_dice;
        }

        // Extract per-day resources from statblock/frontmatter attributes if present
        this.extractPerDayResources();
    }
    get hpDisplay() {
        if (this.current_max) {
            const tempMods =
                this.temp > 0
                    ? `aria-label="Temp HP: ${this.temp}" style="font-weight:bold"`
                    : "";
            return `
                <span ${tempMods}>${this.hp + this.temp}</span><span>/${
                this.current_max
            }</span>
            `;
        }
        return DEFAULT_UNDEFINED;
    }
    /**
     * Parse per‑day resources from a source object (SRD creature or note frontmatter).
     * Supports:
     *  - Top‑level keys: "N/day [kind]", optional "each" suffix, and "At will [kind]"
     *  - Legacy blocks from Fantasy Statblocks/frontmatter: "spells", "psionics", "spellcasting"
     *    in either array form (mixed strings + objects) or object form.
     */
    static readPerDayResources(obj: any) {
        // Capture "N/day" with optional kind, but do NOT capture the trailing "each"
        // Examples: "2/day", "2/day spell", "2/day each", "2/day spells each"
        const perDayRegex = /^(\d+)\/day(?:\s+(?!each\b)([a-z- ]+))?(?:\s*each)?$/i;
        // Capture legacy/explicit at‑will headers: "At will", "At-will", with optional kind
        const atWillRegex = /^at\s*-?\s*will(?:\s+([a-z- ]+))?$/i;
        const resources: { [name: string]: { perDay: number; remaining: number; kind?: string; atWill?: boolean } } = {};
        if (!obj || typeof obj !== "object") return resources;
        // Normalize kind strings: case, whitespace, simple plurals (spells->spell, abilities->ability)
        const normalizeKind = (raw?: string): string => {
            if (!raw) return "spell"; // default for backwards compatibility
            let k = raw.toLowerCase().trim();
            // collapse whitespace
            k = k.replace(/\s+/g, " ");
            // simple plural handling
            if (k.endsWith("ies")) k = k.slice(0, -3) + "y"; // abilities -> ability
            else if (k.endsWith("s")) k = k.slice(0, -1); // spells -> spell, powers -> power
            return k;
        };
        // Add names under a given header as per‑day or at‑will entries
        const addNames = (
            names: string[],
            opts: { perDay?: number; kind?: string; atWill?: boolean }
        ) => {
            const kind = normalizeKind(opts.kind);
            if (opts.atWill) {
                // At‑will: no counters; mark explicitly for the UI
                for (const n of names) resources[n] = { perDay: 0, remaining: 0, kind, atWill: true };
            } else {
                const perDay = Number(opts.perDay ?? 0) || 0;
                for (const n of names) resources[n] = { perDay, remaining: perDay, kind };
            }
        };
        // Accept comma‑separated strings or arrays of strings/values
        const parseNames = (val: any): string[] => {
            const list: string[] = [];
            if (Array.isArray(val)) {
                for (const entry of val) {
                    if (typeof entry === "string") list.push(...entry.split(",").map((s) => s.trim()).filter(Boolean));
                }
            } else if (typeof val === "string") {
                list.push(...val.split(",").map((s) => s.trim()).filter(Boolean));
            }
            return list;
        };
        for (const key of Object.keys(obj)) {
            const match = key.match(perDayRegex);
            const at = key.match(atWillRegex);
            if (match) {
                const perDay = parseInt(match[1], 10);
                const kind = match[2];
                const names = parseNames(obj[key]);
                addNames(names, { perDay, kind });
                continue;
            }
            if (at) {
                const kind = at[1];
                const names = parseNames(obj[key]);
                addNames(names, { atWill: true, kind });
                continue;
            }
            // Legacy spellcasting/psionics blocks like:
            // spells: [ 'At will: light, mage hand', '2/day each: ...', '1/day each: ...' ]
            // Legacy blocks from Statblocks/frontmatter. Example shapes:
            //   spells: ["desc...", {"At will": "light, mage hand"}, {"2/day each": "..."} ]
            //   psionics: { "At will": [...], "3/day each": [...] }
            if (["spells", "psionics", "spellcasting"].includes(key.toLowerCase())) {
                const kindDefault = key.toLowerCase() === "psionics" ? "power" : "spell";
                const block = obj[key];
                if (Array.isArray(block)) {
                    for (const line of block) {
                        if (typeof line === "string") {
                            const parts = line.split(":");
                            if (parts.length < 2) continue;
                            const header = parts[0].trim();
                            const listPart = parts.slice(1).join(":");
                            const m2 = header.match(perDayRegex);
                            const aw2 = header.match(atWillRegex);
                            if (m2) {
                                const perDay = parseInt(m2[1], 10);
                                const kind = m2[2] ?? kindDefault;
                                addNames(parseNames(listPart), { perDay, kind });
                            } else if (aw2) {
                                const kind = aw2[1] ?? kindDefault;
                                addNames(parseNames(listPart), { atWill: true, kind });
                            } else {
                                // ignore descriptive lines
                            }
                        } else if (line && typeof line === "object") {
                            // Object entry: iterate subheaders (e.g. "At will", "2/day each")
                            for (const sub of Object.keys(line)) {
                                const header = sub.trim();
                                const listVal = (line as any)[sub];
                                const names = parseNames(listVal);
                                const m2 = header.match(perDayRegex);
                                const aw2 = header.match(atWillRegex);
                                if (m2) {
                                    const perDay = parseInt(m2[1], 10);
                                    const kind = m2[2] ?? kindDefault;
                                    addNames(names, { perDay, kind });
                                } else if (aw2) {
                                    const kind = aw2[1] ?? kindDefault;
                                    addNames(names, { atWill: true, kind });
                                }
                            }
                        }
                    }
                } else if (block && typeof block === "object") {
                    for (const sub of Object.keys(block)) {
                        const header = sub.trim();
                        const names = parseNames(block[sub]);
                        const m2 = header.match(perDayRegex);
                        const aw2 = header.match(atWillRegex);
                        if (m2) {
                            const perDay = parseInt(m2[1], 10);
                            const kind = m2[2] ?? kindDefault;
                            addNames(names, { perDay, kind });
                        } else if (aw2) {
                            const kind = aw2[1] ?? kindDefault;
                            addNames(names, { atWill: true, kind });
                        }
                    }
                }
            }
        }
        return resources;
    }
    private extractPerDayResources() {
        this.resourcesPerDay = Creature.readPerDayResources(this.creature as any);
    }

    getName() {
        let name = [this.display ?? this.name];
        /* if (this.display) {
            return this.display;
        } */
        if (this.number > 0) {
            name.push(`${this.number}`);
        }
        return name.join(" ");
    }
    getStatblockLink(): string {
        if ("statblock-link" in this) {
            const value = this["statblock-link"];
            return value.startsWith("#")
                ? `[${this.name}](${this.note}${value})`
                : value;
        }
    }

    *[Symbol.iterator]() {
        yield this.name;
        yield this.initiative;
        yield this.static;
        yield this.modifier;
        yield this.max;
        yield this.ac;
        yield this.note;
        yield this.path;
        yield this.id;
        yield this.marker;
        yield this.xp;
        yield this.hidden;
        yield this.hit_dice;
        yield this.current_ac;
        yield this.rollHP;
    }

    static new(creature: Creature) {
        const clone = new Creature(
            {
                ...creature,
                id: getId()
            },
            creature.initiative
        );
        // Preserve per-day resources when duplicating a creature
        if (creature.resourcesPerDay && Object.keys(creature.resourcesPerDay).length) {
            clone.resourcesPerDay = JSON.parse(JSON.stringify(creature.resourcesPerDay));
        }
        return clone;
    }

    static from(creature: HomebrewCreature | SRDMonster) {
        const modifier =
            "modifier" in creature
                ? creature.modifier
                : Math.floor(
                      (("stats" in creature && creature.stats.length > 1
                          ? creature.stats[1]
                          : 10) -
                          10) /
                          2
                  );
        return new Creature({
            ...creature,
            modifier: modifier
        });
    }

    update(creature: HomebrewCreature) {
        this.name = creature.name;

        this.setModifier(creature.modifier);

        this.current_max = this.max = creature.hp ? Number(creature.hp) : 0;

        if (this.hp > this.max) this.hp = this.max;

        this.current_ac = this.ac = creature.ac ?? undefined;
        this.note = creature.note;
        this.level = creature.level;
        this.player = creature.player;
        this["statblock-link"] = creature["statblock-link"];

        this.marker = creature.marker;
        this.source = creature.source;
    }

    toProperties() {
        return { ...this };
    }

    toJSON(): CreatureState {
        return {
            name: this.name,
            display: this.display,
            initiative: this.initiative,
            static: this.static,
            modifier: this.modifier,
            hp: this.max,
            currentMaxHP: this.current_max,
            cr: this.cr,
            ac: this.ac,
            currentAC: this.current_ac,
            note: this.note,
            path: this.path,
            id: this.id,
            marker: this.marker,
            currentHP: this.hp,
            tempHP: this.temp,
            status: Array.from(this.status).map((c) => c.name),
            concentrating: Array.from(this.concentration).map((c) => ({ link: c.link, linkText: c.linkText, name: c.name, kind: (c as any).kind })),
            enabled: this.enabled,
            level: this.level,
            player: this.player,
            xp: this.xp,
            active: this.active,
            hidden: this.hidden,
            friendly: this.friendly,
            "statblock-link": this["statblock-link"],
            hit_dice: this.hit_dice,
            rollHP: this.rollHP,
            resourcesPerDay: this.resourcesPerDay
        };
    }

    static fromJSON(state: CreatureState, plugin: InitiativeTracker) {
        let creature: Creature;
        if (state.player) {
            creature =
                plugin.getPlayerByName(state.name) ??
                new Creature(state, state.initiative);
            creature.initiative = state.initiative;
        } else {
            creature = new Creature(state, state.initiative);
        }
        creature.enabled = state.enabled;

        creature.temp = state.tempHP ? state.tempHP : 0;
        creature.current_max = state.currentMaxHP;
        creature.hp = state.currentHP;
        creature.current_ac = state.currentAC;
        let statuses: Condition[] = [];
        for (const status of state.status) {
            const existing = Conditions.find(({ name }) => status == name);
            if (existing) {
                statuses.push(existing);
            } else {
                statuses.push({
                    name: status,
                    description: null,
                    id: getId()
                });
            }
        }
        creature.status = new Set(statuses);
        // Restore concentration (linked abilities) if present
        if ((state as any).concentrating?.length) {
            const concList: Condition[] = [];
            for (const item of (state as any).concentrating as any[]) {
                if (item?.link) {
                    concList.push({ name: item.name ?? 'Concentrating on', description: null, id: getId(), link: item.link, linkText: item.linkText ?? null, kind: item.kind } as any);
                }
            }
            creature.concentration = new Set(concList);
        }
        creature.active = state.active;
        // Restore per-day resources from state; otherwise try to infer from source
        if (state.resourcesPerDay) {
            creature.resourcesPerDay = state.resourcesPerDay as any;
        } else {
            const base = plugin.getBaseCreatureFromBestiary?.(state.name);
            creature.resourcesPerDay = Creature.readPerDayResources(base ?? state);
        }
        return creature;
    }
}
