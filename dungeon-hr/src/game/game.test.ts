import { describe, expect, it } from 'vitest';
import { autoplay } from './autoplay';
import { hrOptions, resolveHr } from './hr';
import { mulberry32 } from './rng';
import { simulateInvasion } from './sim';
import { newGame, reducer } from './state';

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
    const kinds = ['raise', 'union', 'vacation', 'burnout', 'sick', 'resignation', 'dispute', 'review', 'pip', 'promotion', 'inspection', 'news'] as const;
    for (const kind of kinds) {
      const ev = { id: 'x', kind, title: 't', body: 'b', empId: s.employees[0].id, empId2: s.employees[1].id, amount: 20, from: 'f' };
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
