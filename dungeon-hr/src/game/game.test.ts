import { describe, expect, it } from 'vitest';
import { autoplay } from './autoplay';
import { hrOptions, resolveHr } from './hr';
import { mulberry32 } from './rng';
import { simulateInvasion } from './sim';
import { newGame, reducer } from './state';
import { adjustRel, bond, chemistry, relationsOf, weeklyRelations } from './relations';
import { exportSave, importSave, migrate } from './save';
import { combatProfile } from './employees';
import { getRoom } from './dungeon';
import { forecast } from './forecast';

describe('invasion simulation', () => {
  it('always terminates with an outcome and consistent events', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed);
      const s = newGame('Test', rng);
      const sim = simulateInvasion(s, s.nextParty, rng);
      expect(['defended', 'breach']).toContain(sim.outcome);
      expect(sim.events.at(-1)?.t).toBe('end');
      for (const ev of sim.events) {
        if (ev.t === 'hit') {
          expect(ev.dmg).toBeGreaterThan(0);
          expect(sim.units[ev.tgt]).toBeDefined();
        }
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const a = newGame('T', mulberry32(7));
    const b = newGame('T', mulberry32(7));
    const ra = simulateInvasion(a, a.nextParty, mulberry32(99));
    const rb = simulateInvasion(b, b.nextParty, mulberry32(99));
    expect(ra.events.length).toBe(rb.events.length);
    expect(ra.outcome).toBe(rb.outcome);
  });
});

describe('reducer', () => {
  it('hires, assigns, and builds', () => {
    let s = newGame('T', mulberry32(3));
    const applicant = s.applicants[0];
    s = reducer(s, { type: 'HIRE', id: applicant.id });
    expect(s.employees.some((e) => e.id === applicant.id)).toBe(true);
    s = reducer(s, { type: 'BUILD', zone: 'route', slot: 1, roomType: 'guardpost' });
    const gp = s.rooms.find((r) => r.type === 'guardpost')!;
    expect(gp).toBeDefined();
    s = reducer(s, { type: 'ASSIGN', empId: applicant.id, roomId: gp.id });
    expect(s.employees.find((e) => e.id === applicant.id)!.roomId).toBe(gp.id);
  });

  it('rejects hiring without gold', () => {
    let s = newGame('T', mulberry32(3));
    s = { ...s, gold: 0 };
    const next = reducer(s, { type: 'HIRE', id: s.applicants[0].id });
    expect(next.employees.length).toBe(s.employees.length);
    expect(next.toast?.tone).toBe('bad');
  });
});

describe('HR events', () => {
  it('every generated option resolves without throwing', () => {
    const rng = mulberry32(11);
    const r = autoplay(12, rng);
    expect(r.weeks).toBeGreaterThan(0);
    let s = newGame('T', rng);
    const kinds = [
      'raise', 'union', 'vacation', 'burnout', 'sick', 'resignation', 'dispute', 'review', 'pip', 'promotion', 'inspection', 'news',
      'feud', 'poach', 'birthday', 'suggestion', 'merger', 'auditprep', 'retirement',
    ] as const;
    for (const kind of kinds) {
      const ev = { id: 'x', kind, title: 't', body: 'b', empId: s.employees[0].id, empId2: s.employees[1].id, amount: kind === 'suggestion' ? 2 : 20, from: 'f' };
      for (const o of hrOptions(s, ev)) {
        const clone = structuredClone(s);
        expect(typeof resolveHr(clone, ev, o.id, rng)).toBe('string');
      }
    }
    s = reducer(s, { type: 'GO', phase: 'hr' });
    expect(s.phase).toBe('manage');
  });
});

describe('balance', () => {
  it('a reasonable player survives a long run more often than an idle one', () => {
    const smart = [];
    const idle = [];
    for (let seed = 1; seed <= 12; seed++) {
      smart.push(autoplay(30, mulberry32(seed), 'smart'));
      idle.push(autoplay(30, mulberry32(seed), 'idle'));
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const smartWeeks = avg(smart.map((r) => r.weeks));
    const idleWeeks = avg(idle.map((r) => r.weeks));
    // eslint-disable-next-line no-console
    console.log(
      `smart: avg weeks ${smartWeeks.toFixed(1)}, game overs ${smart.filter((r) => r.gameOver).length}/12, avg level ${avg(smart.map((r) => r.finalLevel)).toFixed(1)}, defense rate ${(avg(smart.map((r) => r.defenses / Math.max(1, r.weeks))) * 100).toFixed(0)}%, fatalities ${avg(smart.map((r) => r.fatalities)).toFixed(1)}, staff ${avg(smart.map((r) => r.staff)).toFixed(1)}, gold ${avg(smart.map((r) => r.finalGold)).toFixed(0)}\n` +
        `idle: avg weeks ${idleWeeks.toFixed(1)}, game overs ${idle.filter((r) => r.gameOver).length}/12`,
    );
    expect(smartWeeks).toBeGreaterThan(idleWeeks);
    expect(idleWeeks).toBeLessThan(20);
  });
});

describe('relationships', () => {
  it('forms friendships and rivalries that change combat stats', () => {
    const s = newGame('T', mulberry32(5));
    const [a, b] = s.employees; // both start in the hallway
    const base = combatProfile(a, s, getRoom(s, a.roomId), false).atk;
    adjustRel(s, a.id, b.id, 60);
    expect(bond(s, a.id, b.id)).toBe('friend');
    expect(chemistry(s, a, [b]).mult).toBeGreaterThan(1);
    expect(combatProfile(a, s, getRoom(s, a.roomId), false).atk).toBeGreaterThan(base);
    adjustRel(s, a.id, b.id, -150);
    expect(bond(s, b.id, a.id)).toBe('rival');
    expect(combatProfile(a, s, getRoom(s, a.roomId), false).atk).toBeLessThan(base);
    expect(relationsOf(s, a.id)[0].other.id).toBe(b.id);
  });

  it('roommates drift toward friendship over time', () => {
    const s = newGame('T', mulberry32(9));
    const [a, b] = s.employees;
    a.traits = [];
    b.traits = [];
    const rng = mulberry32(1);
    for (let i = 0; i < 12; i++) weeklyRelations(s, rng, new Set([a.id, b.id]), true);
    expect(bond(s, a.id, b.id)).toBe('friend');
  });
});

describe('saves', () => {
  it('round-trips through export/import', () => {
    const s = newGame('Exported Inc.', mulberry32(2));
    const back = importSave(exportSave(s));
    expect(back.company).toBe('Exported Inc.');
    expect(back.employees.length).toBe(s.employees.length);
  });

  it('migrates v1 saves', () => {
    const s = newGame('Old', mulberry32(2)) as unknown as Record<string, unknown>;
    delete s.relations;
    delete s.flags;
    delete s.weeklyBuff;
    delete s.tipsSeen;
    s.version = 1;
    const m = migrate(s)!;
    expect(m.version).toBe(3);
    expect(m.board).toBe(5);
    expect(m.relations).toEqual([]);
    expect(m.flags).toEqual([]);
  });

  it('rejects files that are not saves', () => {
    expect(() => importSave('{"hello": 1}')).toThrow();
    expect(() => importSave('not json')).toThrow();
  });
});

describe('simplified flow', () => {
  it('auto-assign guards the vault and empties the bench when there is room', () => {
    let s = newGame('T', mulberry32(4));
    for (const e of s.employees) e.roomId = null;
    s = reducer(s, { type: 'AUTO_ASSIGN' });
    const vault = s.rooms.find((r) => r.type === 'vault')!;
    expect(s.employees.some((e) => e.roomId === vault.id)).toBe(true);
    expect(s.employees.filter((e) => !e.roomId).length).toBe(0);
  });

  it('new hires are placed automatically when a position is free', () => {
    let s = newGame('T', mulberry32(6));
    s = reducer(s, { type: 'BUILD', zone: 'route', slot: 1, roomType: 'guardpost' });
    const hireId = s.applicants[0].id;
    s = reducer(s, { type: 'HIRE', id: hireId });
    expect(s.employees.find((e) => e.id === hireId)!.roomId).not.toBeNull();
  });

  it('Handle all resolves every memo', () => {
    let s = newGame('T', mulberry32(8));
    s = {
      ...s,
      phase: 'hr',
      hrInbox: [
        { id: 'a', kind: 'raise', title: 'Raise', body: '', empId: s.employees[0].id, amount: 10, from: 'x' },
        { id: 'b', kind: 'vacation', title: 'Vacation', body: '', empId: s.employees[1].id, from: 'x' },
        { id: 'c', kind: 'auditprep', title: 'Audit', body: '', from: 'x' },
      ],
    };
    s = reducer(s, { type: 'HR_AUTO' });
    expect(s.hrInbox.length).toBe(0);
    expect(s.hrOutcome?.text.length).toBeGreaterThan(0);
    s = reducer(s, { type: 'HR_NEXT' });
    expect(s.phase).toBe('manage');
  });

  it('forecast returns a probability and staffing the vault improves it', () => {
    const s = newGame('T', mulberry32(10));
    const staffed = forecast(s).winChance;
    const empty = structuredClone(s);
    for (const e of empty.employees) e.roomId = null;
    expect(staffed).toBeGreaterThanOrEqual(0);
    expect(staffed).toBeLessThanOrEqual(1);
    expect(forecast(empty).winChance).toBeLessThanOrEqual(staffed);
  });
});
