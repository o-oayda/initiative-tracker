import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
    entryPoints: ['src/utils/creature.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    plugins: [{
        name: 'obsidian-test-stub',
        setup(build) {
            build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'stub' }));
            build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const Platform = { isMacOS: false };', loader: 'js' }));
        }
    }]
});
const { Creature } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);

test('PF2e text level changes HP, AC, Perception initiative modifier, level and survives a tracker round trip', () => {
    const source = { name: 'Kholo Hunter', level: 'Creature 2', hp: 29, ac: 18, modifier: 7 };
    const creature = Creature.from(source);
    creature.setPf2eAdjustment('weak');
    assert.equal(creature.level, 1);
    assert.equal(creature.max, 19);
    assert.equal(creature.hp, 19);
    assert.equal(creature.ac, 16);
    assert.equal(creature.modifier, 5);

    const copy = Creature.new(creature);
    assert.equal(copy.max, 19);
    const restored = Creature.fromJSON(copy.toJSON(), { getBaseCreatureFromBestiary: () => source });
    assert.equal(restored.max, 19);
    assert.equal(restored.hp, 19);
    restored.hp = 14;
    restored.setPf2eAdjustment('elite');
    assert.equal(restored.level, 3);
    assert.equal(restored.max, 44);
    assert.equal(restored.hp, 39);
    assert.equal(restored.ac, 20);
    assert.equal(restored.modifier, 9);
    restored.setPf2eAdjustment('normal');
    assert.equal(restored.max, 29);
    assert.equal(restored.hp, 24);
    assert.equal(restored.modifier, 7);
});

test('previously saved text-level adjustment gains its missing HP change on load', () => {
    const state = new Creature({ name: 'Kholo Hunter', level: 'Creature 2', hp: 29, ac: 18 }).toJSON();
    state.pf2eAdjustment = 'weak';
    state.pf2eBaseHP = 29;
    state.pf2eBaseAC = 18;
    state.ac = 16;
    state.currentAC = 16;
    const restored = Creature.fromJSON(state, { data: { rpgSystem: 'pathfinder2e' }, getBaseCreatureFromBestiary: () => null });
    assert.equal(restored.level, 1);
    assert.equal(restored.max, 19);
    assert.equal(restored.hp, 19);
    assert.equal(restored.ac, 16);
});

test('older adjusted saves migrate the original initiative modifier', () => {
    const state = new Creature({ name: 'Kholo Hunter', level: 2, hp: 29, ac: 18, modifier: 7 }).toJSON();
    state.pf2eAdjustment = 'weak';
    state.pf2eBaseLevel = 2;
    state.pf2eBaseHP = 29;
    state.pf2eBaseAC = 18;
    state.level = 1;
    state.hp = 19;
    state.currentHP = 19;
    state.currentMaxHP = 19;
    const restored = Creature.fromJSON(state, { data: { rpgSystem: 'pathfinder2e' }, getBaseCreatureFromBestiary: () => null });
    assert.equal(restored.modifier, 5);
    assert.equal(restored.pf2eBaseModifier, 7);
    restored.setPf2eAdjustment('elite');
    assert.equal(restored.modifier, 9);
});
