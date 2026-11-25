import type { App } from "obsidian";

export function findConditionNote(app: App, name: string): string | undefined {
    const title = name.trim();
    const slug = title.replace(/\s+/g, "-");
    for (const candidate of new Set([title, slug, title.replace(/-/g, " ")])) {
        if (!candidate) continue;
        const file = app.metadataCache.getFirstLinkpathDest(candidate, "/");
        if (file?.extension === "md") return file.path;
    }
}

export const CONDITION_HOVER_SOURCE = "initiative-tracker-conditions";

export function previewConditionNote(app: App, event: MouseEvent, linktext: string) {
    const targetEl = event.currentTarget as HTMLElement;
    app.workspace.trigger("hover-link", {
        event,
        source: CONDITION_HOVER_SOURCE,
        hoverParent: targetEl,
        targetEl,
        linktext,
        sourcePath: ""
    });
}
