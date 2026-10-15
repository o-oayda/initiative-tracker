export type Pf2eAdjustment = "normal" | "weak" | "elite";

/** Fantasy Statblocks PF2e layouts commonly store levels as `Creature 2`. */
export function pf2eCreatureLevel(value: unknown): number | null {
    if (typeof value === "number") return Number.isInteger(value) ? value : null;
    if (typeof value !== "string") return null;
    const match = value.trim().match(/^(?:Creature\s+)?(-?\d+)$/i);
    return match ? Number(match[1]) : null;
}

export function pf2eAdjustedLevel(level: number, adjustment: Pf2eAdjustment): number {
    if (adjustment === "elite") return level + (level <= 0 ? 2 : 1);
    if (adjustment === "weak") return level - (level === 1 ? 2 : 1);
    return level;
}

export function pf2eHpChange(level: number, adjustment: Pf2eAdjustment): number {
    if (adjustment === "elite") return level <= 1 ? 10 : level <= 4 ? 15 : level <= 19 ? 20 : 30;
    if (adjustment === "weak") return -(level <= 2 ? 10 : level <= 5 ? 15 : level <= 20 ? 20 : 30);
    return 0;
}

export function parsePf2eAdjustment(name: string): { name: string; adjustment: Pf2eAdjustment } | null {
    const suffix = name.match(/^(.+?)\s+\(([WE])\)$/i);
    if (suffix) return { name: suffix[1].trim(), adjustment: suffix[2].toUpperCase() === "W" ? "weak" : "elite" };
    const prefix = name.match(/^(Weak|Elite)\s+(.+)$/i);
    if (prefix) return { name: prefix[2].trim(), adjustment: prefix[1].toLowerCase() as Pf2eAdjustment };
    return null;
}

/** Duplicated tracker creatures wrap their original statblock in `.creature`. */
export function originalPf2eStatblockSource(source: Record<string, any>): Record<string, any> {
    let original = source;
    for (let depth = 0; depth < 8; depth++) {
        const inner = original?.creature;
        if (!inner || typeof inner !== "object" || inner === original) break;
        original = inner;
    }
    return original;
}

/** A copy for Fantasy Statblocks; the source creature is never changed. */
export function adjustedPf2eStatblock(source: Record<string, any>, adjustment: Pf2eAdjustment): Record<string, any> {
    if (adjustment === "normal") return source;
    const change = adjustment === "elite" ? 2 : -2;
    const level = pf2eCreatureLevel(source.level);
    // Hazards and unlevelled entries are outside the creature adjustment rules.
    if (level == null) return source;
    const adjusted = { ...source };
    if (level != null) {
        const newLevel = pf2eAdjustedLevel(level, adjustment);
        adjusted.level = typeof source.level === "string" && /^Creature\s/i.test(source.level.trim())
            ? `Creature ${newLevel}` : newLevel;
        const hp = typeof source.hp === "number" ? source.hp : parsePlainNumber(source.hp);
        if (hp != null) {
            const newHP = Math.max(0, hp + pf2eHpChange(level, adjustment));
            adjusted.hp = typeof source.hp === "string" ? String(newHP) : newHP;
            adjusted.health = mapRows(source.health, item => item.name === "HP"
                ? changeLeadingNumber(item, newHP - hp, true) : item);
        }
    }
    for (const key of ["ac", "modifier", "fortitude", "reflex", "will", "spellDC", "spellAttack"]) {
        if (typeof source[key] === "number") adjusted[key] = source[key] + change;
        else if (parsePlainNumber(source[key]) != null) adjusted[key] = String(Number(source[key]) + change);
    }
    if (typeof source.perception === "number") adjusted.perception = source.perception + change;
    else if (parsePlainNumber(source.perception) != null) adjusted.perception = String(Number(source.perception) + change);
    else adjusted.perception = mapRows(source.perception, item => item.name === "Perception"
        ? changeLeadingNumber(item, change) : item);
    adjusted.skills = mapRows(source.skills, item => item.name === "Skills" && typeof item.desc === "string"
        ? { ...item, desc: item.desc.replace(/((?:^|,\s*)[^,:;]+:\s*)([+-]\d+)(?=\b)/g,
            (_match: string, label: string, bonus: string) => `${label}${signed(Number(bonus) + change)}`) } : item);
    adjusted.armorclass = mapRows(source.armorclass, item => {
        if (item.name !== "AC" || typeof item.desc !== "string") return item;
        const ac = changeLeadingNumber(item, change, true);
        return { ...ac, desc: (ac.desc as string).replace(/(__(?:Fort|Ref|Will)__\s*)([+-]\d+)\b/g,
            (_match: string, label: string, bonus: string) => `${label}${signed(Number(bonus) + change)}`) };
    });
    adjusted.attacks = mapRows(source.attacks, item => {
        if (typeof item.name !== "string" || typeof item.desc !== "string") return item;
        if (/^\*\*(?:Melee|Ranged)\*\*/i.test(item.name)) return changeLeadingNumber(item, change);
        if (/\bSpells?\b|\bRituals?\b/i.test(item.name) && /^\s*DC\s+\d+\b/i.test(item.desc)) {
            return { ...item, desc: item.desc
                .replace(/^(\s*DC\s+)(\d+)\b/i, (_match: string, label: string, dc: string) => `${label}${Number(dc) + change}`)
                .replace(/([,;]\s*attack\s+)([+-]\d+)\b/i,
                    (_match: string, label: string, bonus: string) => `${label}${signed(Number(bonus) + change)}`) };
        }
        return item;
    });
    for (const key of ["saves", "skillsaves"]) {
        const values = source[key];
        if (values && !Array.isArray(values) && typeof values === "object") {
            adjusted[key] = Object.fromEntries(Object.entries(values).map(([name, value]) =>
                [name, /^(?:fortitude|fort|reflex|ref|will)$/i.test(name) && typeof value === "number" ? value + change : value]));
        }
    }
    return adjusted;
}

function parsePlainNumber(value: unknown): number | null {
    return typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : null;
}

function signed(value: number): string { return value >= 0 ? `+${value}` : String(value); }

function mapRows(value: unknown, transform: (item: Record<string, any>) => Record<string, any>): unknown {
    return Array.isArray(value) ? value.map(item => item && typeof item === "object" ? transform(item) : item) : value;
}

function changeLeadingNumber(item: Record<string, any>, change: number, unsigned = false): Record<string, any> {
    if (typeof item.desc !== "string") return item;
    const desc = item.desc.replace(/^(\s*)([+-]?\d+)\b/, (match: string, space: string, value: string) => {
        if (!unsigned && !/^[+-]/.test(value)) return match;
        const result = Number(value) + change;
        return `${space}${unsigned ? result : signed(result)}`;
    });
    return desc === item.desc ? item : { ...item, desc };
}
