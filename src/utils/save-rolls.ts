import { originalPf2eStatblockSource } from "./pf2e-adjustment";

const pf2eSaves = [
    { id: "fortitude", label: "Fortitude", aliases: ["fort"] },
    { id: "reflex", label: "Reflex", aliases: ["ref"] },
    { id: "will", label: "Will", aliases: [] }
];

const dndSaves = [
    { id: "strength", label: "Strength", aliases: ["str"] },
    { id: "dexterity", label: "Dexterity", aliases: ["dex"] },
    { id: "constitution", label: "Constitution", aliases: ["con"] },
    { id: "intelligence", label: "Intelligence", aliases: ["int"] },
    { id: "wisdom", label: "Wisdom", aliases: ["wis"] },
    { id: "charisma", label: "Charisma", aliases: ["cha"] }
];

const dndSystems = ["dnd5e", "dnd5e-2024", "dnd5e-lazygm", "dnd5e-cr2-simple", "dnd5e-flee-mortals"];

export function saveOptions(system: string) {
    if (system === "pathfinder2e") return pf2eSaves;
    return dndSystems.includes(system) ? dndSaves : [];
}

function integer(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isInteger(value)) return value;
    if (typeof value === "string" && /^[+−-]?\d+$/.test(value.trim())) {
        return Number(value.trim().replace("−", "-"));
    }
}

export function findSaveBonus(system: string, saveId: string, ...sources: Record<string, any>[]) {
    const saves = saveOptions(system);
    const index = saves.findIndex(save => save.id === saveId);
    if (index < 0) return;
    const save = saves[index];
    const names = [save.id, ...save.aliases];
    const records = sources.filter(Boolean).map(originalPf2eStatblockSource);

    for (const source of records) {
        const fields = [source.saves, source.saving_throws, source.savingThrows, source.skillsaves];
        if (system === "pathfinder2e") fields.push(source);
        for (const field of fields.flat()) {
            if (!field || typeof field !== "object") continue;
            for (const [key, value] of Object.entries(field)) {
                if (!names.includes(key.toLowerCase().trim())) continue;
                const bonus = integer(value);
                if (bonus !== undefined) return { bonus };
            }
        }
        if (system === "pathfinder2e" && Array.isArray(source.armorclass)) {
            for (const row of source.armorclass) {
                if (typeof row?.desc !== "string") continue;
                const text = row.desc.replace(/[*_]/g, "");
                const match = text.match(new RegExp(`\\b(?:${names.join("|")})\\s*:?\\s*([+−-]?\\d+)\\b`, "i"));
                const bonus = integer(match?.[1]);
                if (bonus !== undefined) return { bonus, detail: text };
            }
        }
    }

    if (system !== "pathfinder2e") {
        for (const source of records) {
            const score = integer(source.stats?.[index]);
            if (score !== undefined && score > 0) {
                return { bonus: Math.floor((score - 10) / 2), detail: "Ability modifier from the statblock" };
            }
        }
    }
}
