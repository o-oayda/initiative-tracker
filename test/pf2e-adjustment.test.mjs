import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
    entryPoints: ['src/utils/pf2e-adjustment.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false
});
const rules = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);

test('level exceptions and original-level HP bands', () => {
    assert.equal(rules.pf2eCreatureLevel('Creature 2'), 2);
    assert.equal(rules.pf2eCreatureLevel('Creature -1'), -1);
    assert.equal(rules.pf2eCreatureLevel('2'), 2);
    assert.equal(rules.pf2eCreatureLevel('Level unknown'), null);
    assert.equal(rules.pf2eAdjustedLevel(-1, 'elite'), 1);
    assert.equal(rules.pf2eAdjustedLevel(0, 'elite'), 2);
    assert.equal(rules.pf2eAdjustedLevel(1, 'weak'), -1);
    assert.equal(rules.pf2eAdjustedLevel(5, 'weak'), 4);
    for (const [level, change] of [[1, 10], [2, 15], [4, 15], [5, 20], [19, 20], [20, 30]]) {
        assert.equal(rules.pf2eHpChange(level, 'elite'), change);
    }
    for (const [level, change] of [[1, -10], [2, -10], [3, -15], [5, -15], [6, -20], [20, -20], [21, -30]]) {
        assert.equal(rules.pf2eHpChange(level, 'weak'), change);
    }
});

test('prefix and suffix forms resolve to the same original name', () => {
    for (const [input, adjustment] of [['Weak Goblin', 'weak'], ['Goblin (W)', 'weak'], ['Elite Goblin', 'elite'], ['Goblin (E)', 'elite']]) {
        assert.deepEqual(rules.parsePf2eAdjustment(input), { name: 'Goblin', adjustment });
    }
    assert.equal(rules.parsePf2eAdjustment('Goblin'), null);
});

test('structured statistics change without mutating the source or prose', () => {
    const source = { name: 'Goblin', level: 1, hp: 12, ac: 15, perception: 7, saves: { fortitude: 5 }, actions: [{ desc: '1d6 damage' }] };
    const weak = rules.adjustedPf2eStatblock(source, 'weak');
    assert.equal(weak.level, -1);
    assert.equal(weak.hp, 2);
    assert.equal(weak.ac, 13);
    assert.equal(weak.perception, 5);
    assert.equal(weak.saves.fortitude, 3);
    assert.equal(weak.actions[0].desc, '1d6 damage');
    assert.equal(source.ac, 15);
    assert.equal(source.saves.fortitude, 5);
});

test('Fantasy Statblocks PF2e level and HP display both adjust', () => {
    const source = { name: 'Kholo Hunter', level: 'Creature 2', hp: 29, ac: 18, health: [{ name: '' }, { name: 'HP', desc: '29' }] };
    const weak = rules.adjustedPf2eStatblock(source, 'weak');
    assert.equal(weak.level, 'Creature 1');
    assert.equal(weak.hp, 19);
    assert.equal(weak.health[1].desc, '19');
    assert.equal(source.health[1].desc, '29');
});

test('creature display rows adjust once and preserve qualifiers, damage, and source', () => {
    const source = {
        name: 'Horned Dragon (Adult)', level: 'Creature 12', hp: 215, ac: 34, modifier: 22,
        perception: [{ name: 'Perception', desc: '+22; Darkvision, Scent (Imprecise) 60 Feet' }],
        skills: [{ name: 'Skills', desc: 'Acrobatics: +19, Athletics: +24, Forest Lore: +22; +1 to Track' }],
        armorclass: [{ name: 'AC', desc: '34; __Fort__ +20, __Ref__ +22, __Will__ +23; +1 status to all saves vs. magic' }],
        health: [{ name: 'HP', desc: '215; __Immunities__ paralyzed, poison' }],
        attacks: [
            { name: '**Melee** `pf2:1` Jaws', desc: '+26 (magical, reach 15 feet) __Damage__ 3d10 + 12 piercing 3d4 poison' },
            { name: 'Primal Innate Spells', desc: 'DC 32, attack +24; __4th __ _[[Spells/Suggestion|Suggestion]]_' },
            { name: 'Draconic Frenzy', desc: '`pf2:2` Two claw Strikes and one horn Strike; DC 31' }
        ]
    };
    const elite = rules.adjustedPf2eStatblock(source, 'elite');
    assert.equal(elite.level, 'Creature 13');
    assert.equal(elite.hp, 235);
    assert.equal(elite.ac, 36);
    assert.equal(elite.modifier, 24);
    assert.equal(elite.perception[0].desc, '+24; Darkvision, Scent (Imprecise) 60 Feet');
    assert.equal(elite.skills[0].desc, 'Acrobatics: +21, Athletics: +26, Forest Lore: +24; +1 to Track');
    assert.equal(elite.armorclass[0].desc, '36; __Fort__ +22, __Ref__ +24, __Will__ +25; +1 status to all saves vs. magic');
    assert.equal(elite.health[0].desc, '235; __Immunities__ paralyzed, poison');
    assert.equal(elite.attacks[0].desc, '+28 (magical, reach 15 feet) __Damage__ 3d10 + 12 piercing 3d4 poison');
    assert.equal(elite.attacks[1].desc, 'DC 34, attack +26; __4th __ _[[Spells/Suggestion|Suggestion]]_');
    assert.equal(elite.attacks[2].desc, source.attacks[2].desc);
    assert.equal(source.health[0].desc, '215; __Immunities__ paralyzed, poison');
    assert.equal(source.attacks[0].desc.startsWith('+26'), true);
    assert.equal(rules.adjustedPf2eStatblock(source, 'weak').attacks[0].desc.startsWith('+24'), true);
    assert.equal(rules.adjustedPf2eStatblock(source, 'elite').attacks[0].desc.startsWith('+28'), true);
});

test('hazard statblocks are outside creature adjustment scope', () => {
    const hazard = { level: 'Hazard 4', hp: 40, ac: 20, modifier: 10,
        armorclass: [{ name: 'AC', desc: '20; __Fort__ +12' }] };
    assert.equal(rules.adjustedPf2eStatblock(hazard, 'elite'), hazard);
});

test('duplicated custom creatures use their original nested statblock', () => {
    const raw = { level: 'Creature 2', hp: 29, ac: 18, attacks: [{ name: '**Melee** Claw', desc: '+10 __Damage__ 1d8 + 4 slashing' }] };
    const wrapper = { ...raw, pf2eAdjustment: 'weak', creature: raw };
    const duplicate = { ...wrapper, creature: wrapper };
    assert.equal(rules.originalPf2eStatblockSource(duplicate), raw);
    assert.equal(rules.adjustedPf2eStatblock(rules.originalPf2eStatblockSource(duplicate), 'elite').attacks[0].desc,
        '+12 __Damage__ 1d8 + 4 slashing');
});
