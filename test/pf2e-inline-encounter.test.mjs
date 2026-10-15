import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
    entryPoints: ['src/encounter/index.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [{
        name: 'obsidian-and-svelte-stubs',
        setup(build) {
            build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'stub' }));
            build.onResolve({ filter: /\.svelte$/ }, () => ({ path: 'svelte', namespace: 'stub' }));
            build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({
                contents: args.path === 'obsidian'
                    ? `import { parse } from 'yaml'; export const parseYaml = parse; export class MarkdownRenderChild {} export class Notice {} export const Platform = { isMacOS: false };`
                    : 'export default class {}',
                loader: 'js',
                resolveDir: process.cwd()
            }));
        }
    }]
});
const { EncounterParser } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);

test('inline PF2e encounter reads fenced stats when bestiary entries are incomplete', async () => {
    const notes = {
        'Kholo Hunter': '---\nstatblock: inline\nlevel: 2\n---\n```statblock\nname: Kholo Hunter\nlevel: Creature 2\nmodifier: 7\nac: 18\nhp: 29\n```',
        Hyena: '---\r\nstatblock: inline\r\n---\r\n```statblock\r\nname: Hyena\r\nlevel: Creature 1\r\nmodifier: 6\r\nac: 16\r\nhp: 20\r\n```'
    };
    const plugin = {
        data: { rpgSystem: 'pathfinder2e' },
        canUseDiceRoller: false,
        getCreatureFromBestiary(name) {
            return ['Kholo Hunter', 'Hyena'].includes(name)
                ? { name, max: 0, ac: undefined, creature: { name } }
                : null;
        },
        app: {
            metadataCache: {
                getFirstLinkpathDest(name) {
                    return name in notes ? { name } : null;
                }
            },
            vault: { cachedRead: async file => notes[file.name] }
        }
    };
    const creatures = await new EncounterParser(plugin).parseRawCreatures(['Elite Kholo Hunter', 'Hyena'], false);
    const result = [...creatures].map(([creature, count]) => ({ creature, count }));
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(({ count }) => count), [1, 1]);
    assert.deepEqual(result.map(({ creature }) => ({
        name: creature.name, hp: creature.hp, ac: creature.ac, level: creature.level, modifier: creature.modifier
    })), [
        { name: 'Kholo Hunter', hp: 44, ac: 20, level: 3, modifier: 9 },
        { name: 'Hyena', hp: 20, ac: 16, level: 'Creature 1', modifier: 6 }
    ]);
    const elite = result[0].creature;
    const clone = elite.constructor.new(elite);
    const saved = clone.toJSON();
    assert.equal(saved.currentHP, 44);
    assert.equal(saved.currentAC, 20);
    assert.equal(saved.pf2eAdjustment, 'elite');
});
