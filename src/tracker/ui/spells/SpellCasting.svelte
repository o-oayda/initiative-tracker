<script lang="ts">
    import type { Creature } from "src/utils/creature";
    import { tracker } from "src/tracker/stores/tracker";
    import { getId } from "src/utils/creature";
    import { setIcon, Notice } from "obsidian";

    export let creature: Creature;

    const entries = () => Object.entries(creature.resourcesPerDay ?? {});
    let refresh = 0;
    const pluralize = (k: string) => (k?.endsWith("y") ? k.slice(0, -1) + "ies" : k + "s");
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    function kindIcon(node: HTMLElement, kind: string) {
        const setByKind = (k: string) => {
            const kk = (k ?? "spell").toLowerCase();
            const name = kk === "spell" ? "wand" : kk === "power" ? "brain" : "sparkles";
            setIcon(node, name);
        };
        setByKind(kind);
        return {
            update: (k: string) => setByKind(k)
        };
    }

    const parseWikiLink = (raw: string) => {
        const text = raw?.trim() ?? "";
        // Handle Fantasy Statblocks sentinel format: <STATBLOCK-WIKI-LINK>target|Display<STATBLOCK-WIKI-LINK>
        const sentinel = text.match(/^<STATBLOCK-WIKI-LINK>(.+?)<STATBLOCK-WIKI-LINK>$/);
        if (sentinel) {
            const content = sentinel[1];
            const [target, display] = content.split("|");
            return {
                isLink: true,
                target: target?.trim() ?? "",
                display: (display ?? target)?.trim() ?? ""
            } as const;
        }
        // Handle standard Obsidian wiki link: [[target|Display]] or [[target]]
        const m = text.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
        if (m) {
            const target = m[1];
            const display = m[2] ?? m[1];
            return { isLink: true, target, display } as const;
        }
        return { isLink: false, target: null, display: raw } as const;
    };
    // Resolve plain names to internal links if a matching file exists.
    const linkCache: Map<string, string | null> = new Map();
    const resolvePlainTarget = (name: string): string | null => {
        const norm = (s: string) => s?.normalize?.("NFKD")?.replace(/[’'"`]/g, "").trim();
        const base = norm(name);
        const hyphenate = (s: string) => s.replace(/\s+/g, "-");
        const dehyphenate = (s: string) => s.replace(/-/g, " ");
        const lower = (s: string) => s.toLowerCase();
        const candidates = Array.from(new Set([
            base,
            lower(base),
            hyphenate(base),
            hyphenate(lower(base)),
            dehyphenate(base),
            dehyphenate(lower(base))
        ].filter(Boolean)));
        try {
            for (const candidate of candidates) {
                const file = app.metadataCache.getFirstLinkpathDest(candidate, "/");
                if (file) return file.path;
            }
        } catch (e) {
            // ignore
        }
        return null;
    };
    const linkFor = (name: string) => {
        const wiki = parseWikiLink(name);
        if (wiki.isLink) return wiki;
        if (!linkCache.has(name)) {
            linkCache.set(name, resolvePlainTarget(name));
        }
        const target = linkCache.get(name);
        if (target) {
            return { isLink: true, target, display: name } as const;
        }
        return { isLink: false, target: null, display: name } as const;
    };
    const openInternal = (target: string) => {
        try {
            // Use creature.path as source if available for resolution
            const source = creature?.path ?? "";
            app.workspace.openLinkText(target, source, false);
        } catch (e) {
            // noop
        }
    };

    // Cache parsed levels per target path for performance
    const levelCache: Map<string, number | null> = new Map();
    // Local mapping from ability name to parsed level (null = unknown/none)
    let levels: Map<string, number | null> = new Map();
    let levelsRefresh = 0; // force key refresh after async updates

    const stripFrontmatter = (content: string) => content.replace(/^---[\s\S]*?---\s*/m, "");
    const extractLevelFromContent = (content: string): number | null => {
        const body = stripFrontmatter(content);
        // Match "2nd-level ..." (with optional italics) or the word "cantrip"
        const m = body.match(/(^|\n)\s*\*?\s*(?:(\d+)(?:st|nd|rd|th)\s*-?\s*level|cantrip)\b/i);
        if (!m) return null;
        if (m[0].toLowerCase().includes("cantrip")) return 0;
        const lvl = Number(m[2]);
        return Number.isFinite(lvl) ? lvl : null;
    };
    const extractLevelFromFrontmatter = (file: any): number | null => {
        try {
            const cache: any = app.metadataCache.getFileCache(file);
            const fm = cache?.frontmatter;
            if (!fm) return null;
            const tags: string[] = Array.isArray(fm.tags)
                ? fm.tags
                : typeof fm.tags === 'string'
                    ? fm.tags.split(/[,\s]+/).filter(Boolean)
                    : [];
            for (const t of tags) {
                const mm = String(t).match(/(?:^|\/)level\/(\d+)\b/i);
                if (mm) return Number(mm[1]);
            }
        } catch {}
        return null;
    };
    const getLevelFor = async (name: string): Promise<number | null> => {
        const lf = linkFor(name);
        if (!lf.isLink) return null;
        const file = getTargetFile(lf.target);
        if (!file) return null;
        const key = file.path;
        if (levelCache.has(key)) return levelCache.get(key)!;
        // Prefer frontmatter tags if present
        let lvl = extractLevelFromFrontmatter(file);
        if (lvl == null) {
            try {
                const content = await app.vault.cachedRead(file);
                lvl = extractLevelFromContent(content);
            } catch {
                lvl = null;
            }
        }
        levelCache.set(key, lvl);
        return lvl;
    };
    const warmLevels = () => {
        // Precompute levels for spells and powers, update local map as they resolve
        const entriesByKind = entries();
        for (const [name, info] of entriesByKind) {
            const k = (info.kind ?? 'spell').toLowerCase();
            if (k !== 'spell' && k !== 'power') continue;
            // If we've already computed a value for this name, skip
            if (levels.has(name)) continue;
            // Seed with null so unsorted shows initially
            levels.set(name, null);
            // Fire-and-forget async compute
            (async () => {
                const lvl = await getLevelFor(name);
                levels.set(name, lvl);
                levelsRefresh += 1;
            })();
        }
    };
    let hoverTimeout: NodeJS.Timeout = null;
    const tryHover = (evt: MouseEvent, target: string) => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
            try {
                const anchor = (evt.currentTarget as HTMLElement) ?? (evt.target as HTMLElement);
                // Trigger native hover (ensure it can render above modal via CSS)
                app.workspace.trigger("link-hover", {}, anchor, target, creature?.path ?? "");
            } catch (e) {
                // ignore
            }
        }, 300);
    };
    const cancelHover = () => {
        clearTimeout(hoverTimeout);
    };

    const dec = (spellName: string) => {
        const s = creature.resourcesPerDay?.[spellName];
        if (s?.atWill) return;
        if (!s) return;
        s.remaining = Math.max(0, (s.remaining ?? s.perDay) - 1);
        // Force Svelte to re-render after nested mutation
        creature = creature;
        refresh += 1;
        tracker.refresh();
    };
    const inc = (spellName: string) => {
        const s = creature.resourcesPerDay?.[spellName];
        if (s?.atWill) return;
        if (!s) return;
        s.remaining = Math.min(s.perDay, (s.remaining ?? 0) + 1);
        // Force Svelte to re-render after nested mutation
        creature = creature;
        refresh += 1;
        tracker.refresh();
    };
    const verbFor = (kind: string) => {
        const k = (kind ?? 'spell').toLowerCase();
        if (k === 'spell') return 'Cast';
        if (k === 'power') return 'Manifest';
        return 'Use';
    };

    const getTargetFile = (target: string) => {
        try {
            // First try Obsidian link resolution relative to the creature's note (if present)
            let file = app.metadataCache.getFirstLinkpathDest(target, creature?.path ?? "/");
            if (file) return file as any;
            // If it looks like a full path, try direct vault lookup
            if (/\.md$/i.test(target) || target.includes("/")) {
                const abs: any = app.vault.getAbstractFileByPath(target);
                if (abs && abs.path && typeof abs.path === 'string') return abs;
            }
        } catch (e) {
            // ignore
        }
        return null;
    };
    const checkAndApplyConcentration = async (abilityName: string, kind?: string) => {
        const lf = linkFor(abilityName);
        const target = lf.isLink ? lf.target : null;
        if (!target) return;
        const file = getTargetFile(target);
        if (!file) return;
        try {
            const content = await app.vault.cachedRead(file);
            // Match lines like "- **Duration:** Concentration, up to ..." (allowing bold around label and colon inside/outside bold)
            const re = /(^|\n)\s*[-*]?\s*(?:\*\*|__)?duration\s*[:\.\-\u2014\u2013]?(?:\*\*|__)?\s*[:\.\-\u2014\u2013]?\s*concentration\b/i;
            if (re.test(content)) {
                const status = { name: `Concentrating on`, link: target, linkText: (lf.display ?? abilityName), description: null, id: getId() } as any;
                const allowMultiple = (kind ?? 'spell').toLowerCase() === 'power';
                const existing = [...(creature.status ?? new Set())].find((s: any) =>
                    (s?.linkText && s.linkText === status.linkText) || s?.name === `Concentrating on ${status.linkText}`
                );
                if (existing) return; // already concentrating on this exact ability
                const change: any = { status: [status] };
                if (!allowMultiple) {
                    change.remove_status = [...(creature.status ?? new Set())].filter((s) => s?.name?.startsWith?.("Concentrating on"));
                }
                tracker.updateCreatures({ creature, change });
                new Notice(`Concentration started: ${lf.display ?? abilityName}`, 2000);
            } else {
                new Notice(`No concentration detected in: ${lf.display ?? abilityName}`, 1500);
            }
        } catch (e) {
            // ignore read errors
        }
    };

    const castAbility = async (name: string, info: { atWill?: boolean; remaining?: number; perDay?: number; kind?: string }) => {
        if (!info?.atWill) {
            if (info.remaining <= 0) return;
            dec(name);
        }
        await checkAndApplyConcentration(name, info?.kind);
    };
    const resetAll = () => {
        for (const [, info] of entries()) {
            info.remaining = info.perDay;
        }
        // Force Svelte to re-render after nested mutation
        creature = creature;
        refresh += 1;
        tracker.refresh();
    };

    // Kick off async level warming when inputs change
    $: warmLevels();
</script>

<div class="spell-casting">
    {#if !entries().length}
        <em>No per‑day resources found.</em>
    {:else}
        <div class="list">
            {#key refresh + levelsRefresh}
                {#each Array.from(new Set(Object.values(creature.resourcesPerDay ?? {}).map((r) => (r.kind ?? 'spell')))) as kind}
                    <div class="kind-header">
                        <span class="icon" use:kindIcon={kind} />
                        {cap(pluralize(kind))}
                    </div>
                    {#if ['spell','power'].includes((kind ?? 'spell').toLowerCase())}
                        {#await Promise.resolve() then}
                            {#if entries().filter(([_, info]) => (info.kind ?? 'spell') === kind).length}
                                {#if entries().filter(([n, info]) => (info.kind ?? 'spell') === kind && (!levels.has(n) || levels.get(n) == null)).length}
                                    <div class="subheader">Unsorted</div>
                                    {#each entries().filter(([n, info]) => (info.kind ?? 'spell') === kind && (!levels.has(n) || levels.get(n) == null)) as [name, info]}
                                        <div class="row">
                                            <div class="col name">
                                                {#if linkFor(name).isLink}
                                                    <a
                                                        class="internal-link"
                                                        href={linkFor(name).target}
                                                        data-href={linkFor(name).target}
                                                        on:click|preventDefault|stopPropagation={() => openInternal(linkFor(name).target)}
                                                        on:mouseover={(evt) => tryHover(evt, linkFor(name).target)}
                                                        on:mouseleave={cancelHover}
                                                    >{linkFor(name).display}</a>
                                                {:else}
                                                    {name}
                                                {/if}
                                            </div>
                                            <div class="col middle">
                                                {#if info.atWill}
                                                    <span class="at-will">(at will)</span>
                                                {:else}
                                                    <span class="count">{info.remaining}/{info.perDay}</span>
                                                    <button class="btn-mini" title="Decrease" on:click={() => dec(name)} aria-label={`Decrease ${name}`}>−</button>
                                                    <button class="btn-mini" title="Undo / Increase" on:click={() => inc(name)} aria-label={`Increase ${name}`}>+</button>
                                                {/if}
                                            </div>
                                            <div class="col action">
                                                <button
                                                    class="btn-verb"
                                                    on:click={() => castAbility(name, info)}
                                                    disabled={!info.atWill && info.remaining <= 0}
                                                >{verbFor(info.kind)}</button>
                                            </div>
                                        </div>
                                    {/each}
                                {/if}
                                {#each Array.from(new Set(entries().filter(([n, info]) => (info.kind ?? 'spell') === kind && levels.has(n) && levels.get(n) != null).map(([n]) => levels.get(n))))
                                        .sort((a, b) => Number(a) - Number(b)) as lvl}
                                    <div class="subheader">{Number(lvl) === 0 ? 'Cantrips' : `Level ${lvl}`}</div>
                                    {#each entries().filter(([n, info]) => (info.kind ?? 'spell') === kind && levels.get(n) === lvl) as [name, info]}
                                        <div class="row">
                                            <div class="col name">
                                                {#if linkFor(name).isLink}
                                                    <a
                                                        class="internal-link"
                                                        href={linkFor(name).target}
                                                        data-href={linkFor(name).target}
                                                        on:click|preventDefault|stopPropagation={() => openInternal(linkFor(name).target)}
                                                        on:mouseover={(evt) => tryHover(evt, linkFor(name).target)}
                                                        on:mouseleave={cancelHover}
                                                    >{linkFor(name).display}</a>
                                                {:else}
                                                    {name}
                                                {/if}
                                            </div>
                                            <div class="col middle">
                                                {#if info.atWill}
                                                    <span class="at-will">(at will)</span>
                                                {:else}
                                                    <span class="count">{info.remaining}/{info.perDay}</span>
                                                    <button class="btn-mini" title="Decrease" on:click={() => dec(name)} aria-label={`Decrease ${name}`}>−</button>
                                                    <button class="btn-mini" title="Undo / Increase" on:click={() => inc(name)} aria-label={`Increase ${name}`}>+</button>
                                                {/if}
                                            </div>
                                            <div class="col action">
                                                <button
                                                    class="btn-verb"
                                                    on:click={() => castAbility(name, info)}
                                                    disabled={!info.atWill && info.remaining <= 0}
                                                >{verbFor(info.kind)}</button>
                                            </div>
                                        </div>
                                    {/each}
                                {/each}
                            {/if}
                        {/await}
                    {:else}
                        {#each entries().filter(([_, info]) => (info.kind ?? 'spell') === kind) as [name, info]}
                            <div class="row">
                                <div class="col name">
                                    {#if linkFor(name).isLink}
                                        <a
                                            class="internal-link"
                                            href={linkFor(name).target}
                                            data-href={linkFor(name).target}
                                            on:click|preventDefault|stopPropagation={() => openInternal(linkFor(name).target)}
                                            on:mouseover={(evt) => tryHover(evt, linkFor(name).target)}
                                            on:mouseleave={cancelHover}
                                        >{linkFor(name).display}</a>
                                    {:else}
                                        {name}
                                    {/if}
                                </div>
                                <div class="col middle">
                                    {#if info.atWill}
                                        <span class="at-will">(at will)</span>
                                    {:else}
                                        <span class="count">{info.remaining}/{info.perDay}</span>
                                        <button class="btn-mini" title="Decrease" on:click={() => dec(name)} aria-label={`Decrease ${name}`}>−</button>
                                        <button class="btn-mini" title="Undo / Increase" on:click={() => inc(name)} aria-label={`Increase ${name}`}>+</button>
                                    {/if}
                                </div>
                                <div class="col action">
                                    <button
                                        class="btn-verb"
                                        on:click={() => castAbility(name, info)}
                                        disabled={!info.atWill && info.remaining <= 0}
                                    >{verbFor(info.kind)}</button>
                                </div>
                            </div>
                        {/each}
                    {/if}
                {/each}
            {/key}
        </div>
        <div class="footer">
            <button class="reset" on:click={resetAll}>Reset All</button>
        </div>
    {/if}
    
</div>

<style scoped>
    .spell-casting {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: 20rem;
        max-width: 32rem;
        max-height: 60vh;
    }
    .list {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        overflow: auto;
    }
    .kind-header {
        margin-top: 0.5rem;
        padding-bottom: 0.25rem;
        font-size: 0.95rem;
        font-weight: var(--font-semibold);
        color: var(--text-muted);
        text-transform: none;
        border-bottom: 1px solid var(--background-modifier-border);
    }
    .kind-header .icon {
        display: inline-flex;
        vertical-align: middle;
        margin-right: 0.35rem;
    }
    .subheader {
        margin: 0.25rem 0 0.1rem 0;
        font-size: 0.8rem;
        color: var(--text-muted);
    }
    .row {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 0.35rem;
        padding: 0.05rem 0; /* tighter vertical spacing */
    }
    .col { display: flex; align-items: center; }
    .name {
        font-weight: normal;
        font-size: 0.9rem;
    }
    .col.name { flex: 1 1 auto; min-width: 8rem; }
    .col.middle { flex: 0 0 8.5rem; gap: 0.35rem; justify-content: center; }
    .col.action { flex: 0 0 6.2rem; margin-left: auto; display: flex; justify-content: flex-end; }
    .btn-mini {
        padding: 0 0.25rem;
        min-width: 1rem;
        height: 1rem;
        line-height: 1rem;
        font-size: 0.7rem;
        border: 1px solid var(--background-modifier-border);
        border-radius: 0.2rem;
        background: var(--background-secondary);
        color: var(--text-muted);
        cursor: pointer;
    }
    .btn-mini:hover {
        color: var(--text-normal);
        background: var(--background-modifier-form-field);
    }
    .btn-verb {
        padding: 0 0.35rem; /* reduce padding for shorter height */
        height: 1.25rem; /* explicit compact height */
        line-height: 1.15rem; /* align text vertically */
        font-size: 0.72rem; /* slightly smaller text */
        border: 1px solid var(--background-modifier-border);
        border-radius: 0.25rem;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        min-width: 5.5rem; /* slightly narrower */
        text-align: center;
    }
    .btn-verb:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .count { min-width: 3.5rem; text-align: center; }
    .footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.5rem;
    }
    .reset {
        padding: 0.25rem 0.5rem;
    }
    /* Ensure Obsidian's native hover popover appears above the modal */
    :global(.popover),
    :global(.hover-popover) {
        z-index: 100000 !important;
    }
</style>
