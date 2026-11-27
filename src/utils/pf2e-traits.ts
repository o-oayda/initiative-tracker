const sizes = new Set(["tiny", "small", "medium", "large", "huge", "gargantuan"]);
const rarities = new Set(["common", "uncommon", "rare", "unique"]);

function labels(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(labels);
    if (typeof value !== "string") return [];
    const links = /\[\[([^\]]+)\]\]|<STATBLOCK-WIKI-LINK>(.+?)<STATBLOCK-WIKI-LINK>/g;
    const text = value.replace(links, (_, wiki, sentinel) => {
        const [path, alias] = (wiki ?? sentinel).split("|");
        return alias ?? path.split("/").pop().replace(/\s*\(trait-\d+\)$/, "");
    });
    return text.split(/[,;]+/).map(label => label.trim().toLowerCase()).filter(Boolean);
}

export function pf2eTraits(creature: Record<string, unknown>) {
    const numbered = Object.entries(creature)
        .filter(([key]) => /^trait_\d+$/i.test(key))
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .flatMap(([, value]) => labels(value));
    return [...new Set([...numbered, ...labels(creature.traits)])];
}

export function pf2eCreatureTraits(creature: Record<string, unknown>) {
    return pf2eTraits(creature).filter(trait => !sizes.has(trait) && !rarities.has(trait));
}

export function pf2eCreatureRarity(creature: Record<string, unknown>) {
    const explicit = Object.entries(creature)
        .filter(([key]) => /^rare_\d+$/i.test(key))
        .flatMap(([, value]) => labels(value));
    return [...labels(creature.rarity), ...explicit, ...pf2eTraits(creature)]
        .find(trait => rarities.has(trait)) ?? "common";
}
