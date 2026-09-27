import { CLASSES, GRADE_MULT, ROOMS, SPECIES } from './data';
import { routeOrder, roomStaff } from './dungeon';
import { combatProfile, coreStats, hasTrait, medicalSaveChance, suitability } from './employees';
import { chance, clamp, pick, vary, type Rng } from './rng';
import type { AdvClass, GameState, IncidentReport, Party, PartyKind, Room, SpeciesId, TraitId } from './types';

export interface UnitInfo {
  uid: string;
  side: 'emp' | 'adv';
  name: string;
  kind: SpeciesId | AdvClass;
  maxHp: number;
  hp: number;
  hue: number;
  level: number;
  roomId?: string;
}

export type HitTag = 'melee' | 'fire' | 'magic' | 'ambush' | 'trap' | 'smite' | 'drain' | 'arrow' | 'crit';

export type SimEvent =
  | { t: 'room'; roomIdx: number; roomId: string; staff: string[]; text: string }
  | { t: 'hit'; src: string | null; tgt: string; dmg: number; hp: number; crit: boolean; tag: HitTag; text: string }
  | { t: 'heal'; src: string; tgt: string; amt: number; hp: number; text: string }
  | { t: 'down'; uid: string; fatal: boolean; text: string }
  | { t: 'flee'; uid: string; text: string }
  | { t: 'revive'; uid: string; hp: number; text: string }
  | { t: 'log'; text: string; tone?: 'good' | 'bad' | 'info' | 'warn' }
  | { t: 'clear'; roomIdx: number; text: string }
  | { t: 'end'; outcome: 'defended' | 'breach'; text: string };

interface Unit extends UnitInfo {
  atk: number;
  def: number;
  spd: number;
  int: number;
  traits: TraitId[];
  alive: boolean;
  fled: boolean;
  hexed: number;
  reassembled: boolean;
  turns: number;
  kills: number;
  damage: number;
  saved: boolean;
  gear: string;
  tags: string[];
}

export interface EmpResult {
  hp: number;
  died: boolean;
  injured: boolean;
  fled: boolean;
  kills: number;
  damage: number;
  fought: boolean;
}

export interface SimResult {
  events: SimEvent[];
  units: Record<string, UnitInfo>;
  rooms: { id: string; type: Room['type']; level: number }[];
  outcome: 'defended' | 'breach';
  retreated: boolean;
  emp: Record<string, EmpResult>;
  slain: number;
  loot: number;
  incidents: IncidentReport[];
  revivals: number;
  absent: string[];
}

const ROUND_LIMIT = 24;

const BEAST: SpeciesId[] = ['slime', 'goblin', 'orc'];
const UNDEAD: SpeciesId[] = ['skeleton', 'vampire'];

const RECOMMENDATIONS = [
  'Improve benefits package',
  'Schedule mandatory safety seminar',
  'Replace with cheaper intern',
  'Send flowers (budget: 2 gold)',
  'Add "don\'t die" to job description',
  'Form a committee to discuss forming a committee',
  'Update the org chart',
  'Blame the previous HR manager',
];

const CLASS_RECS: Partial<Record<AdvClass, string>> = {
  wizard: 'Install fire extinguishers. Spread staff out.',
  paladin: 'Stop scheduling undead against paladins',
  cleric: 'Consider a less holy dungeon',
  rogue: 'Hire more muscle; rogues are fragile',
  ranger: 'Keep beast staff away from rangers',
  barbarian: 'Invest in better armor',
  bard: 'Ban live music on the premises',
};

function incidentName(species: SpeciesId, tag: HitTag, rng: Rng): string {
  if (species === 'skeleton') return 'Unscheduled Disassembly';
  if (tag === 'fire') return 'Spontaneous Combustion (Work-Related)';
  if (species === 'slime') return 'Loss of Structural Integrity';
  if (species === 'mimic') return 'Asset Liquidation';
  return pick(rng, ['Workplace Fatality', 'Involuntary Early Retirement', 'Permanent Leave of Absence']);
}

function describeCause(killer: Unit | null, advAlive: number): string {
  if (!killer) return 'A poorly maintained trap. Ironic.';
  const others = Math.max(0, advAlive - 1);
  const who = others > 0 ? `${numberWord(others + 1)} adventurers` : `A level ${killer.level} ${CLASSES[killer.kind as AdvClass]?.name ?? 'adventurer'}`;
  return `${who} and ${killer.gear}`;
}

function numberWord(n: number): string {
  return ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][n] ?? String(n);
}

export function simulateInvasion(state: GameState, party: Party, rng: Rng): SimResult {
  const events: SimEvent[] = [];
  const units: Record<string, Unit> = {};
  const rooms = routeOrder(state);
  const absent: string[] = [];
  const saveChance = medicalSaveChance(state);
  const incidents: IncidentReport[] = [];
  let revivals = 0;
  let slain = 0;
  let loot = 0;
  let retreated = false;
  const bossHunters = party.kind === 'bosshunters' || party.kind === 'audit';
  const insulated = state.tech.includes('insulation');

  // Build employee units.
  for (const room of rooms) {
    for (const e of roomStaff(state, room.id)) {
      if (e.status !== 'active') continue;
      if (state.policies.includes('pto') && chance(rng, 0.12)) {
        absent.push(e.id);
        continue;
      }
      const p = combatProfile(e, state, room, party.night);
      units[e.id] = {
        uid: e.id,
        side: 'emp',
        name: e.name,
        kind: e.species,
        maxHp: p.maxHp,
        hp: clamp(Math.round(e.hp), 1, p.maxHp),
        hue: e.hue,
        level: e.level,
        roomId: room.id,
        atk: p.atk,
        def: p.def,
        spd: p.spd,
        int: p.int,
        traits: e.traits,
        alive: true,
        fled: false,
        hexed: 0,
        reassembled: false,
        turns: 0,
        kills: 0,
        damage: 0,
        saved: false,
        gear: '',
        tags: SPECIES[e.species].tags,
      };
    }
  }
  const advs: Unit[] = party.members.map((a) => {
    const u: Unit = {
      uid: a.id,
      side: 'adv',
      name: a.name,
      kind: a.cls,
      maxHp: a.maxHp,
      hp: a.maxHp,
      hue: a.hue,
      level: a.level,
      atk: a.atk,
      def: a.def,
      spd: a.spd,
      int: 10,
      traits: [],
      alive: true,
      fled: false,
      hexed: 0,
      reassembled: false,
      turns: 0,
      kills: 0,
      damage: 0,
      saved: false,
      gear: a.gear,
      tags: [],
    };
    units[a.id] = u;
    return u;
  });
  let bardStacks = 0;

  const liveAdvs = () => advs.filter((a) => a.alive && !a.fled);

  const emit = (e: SimEvent) => events.push(e);

  function damage(src: Unit | null, tgt: Unit, raw: number, tag: HitTag, verb: string, ignoreDef = 0): number {
    let crit = false;
    if (src) {
      let critChance = 0.07;
      if (src.kind === 'rogue') critChance = 0.3;
      if (src.kind === 'goblin') critChance = 0.12;
      if (src.hexed > 0) raw *= 0.65;
      if (src.side === 'adv') {
        raw *= 1 + 0.1 * bardStacks;
        if (src.kind === 'barbarian' && src.hp < src.maxHp / 2) raw *= 1.5;
      }
      if (tag !== 'fire' && tag !== 'trap' && chance(rng, critChance)) {
        crit = true;
        raw *= 1.7;
      }
    }
    const def = tgt.def * (1 - ignoreDef);
    const dmg = Math.max(1, Math.round(vary(rng, raw, 0.15) * (25 / (25 + def))));
    tgt.hp = Math.max(0, tgt.hp - dmg);
    if (src) src.damage += dmg;
    emit({ t: 'hit', src: src?.uid ?? null, tgt: tgt.uid, dmg, hp: tgt.hp, crit, tag: crit ? 'crit' : tag, text: verb.replace('{dmg}', String(dmg)) });
    if (tgt.hp <= 0) down(tgt, src, tag);
    return dmg;
  }

  function down(u: Unit, killer: Unit | null, tag: HitTag) {
    if (u.side === 'adv') {
      u.alive = false;
      slain += 1;
      loot += party.members.find((m) => m.id === u.uid)?.loot ?? 0;
      if (killer) killer.kills += 1;
      emit({ t: 'down', uid: u.uid, fatal: true, text: `${u.name} has been permanently offboarded.${killer ? ` Credit: ${killer.name}.` : ''}` });
      return;
    }
    const sp = u.kind as SpeciesId;
    if (sp === 'skeleton' && !u.reassembled && chance(rng, state.tech.includes('necro') ? 0.6 : 0.3)) {
      u.reassembled = true;
      u.hp = Math.round(u.maxHp * 0.35);
      emit({ t: 'revive', uid: u.uid, hp: u.hp, text: `${u.name} collapses into a pile of bones… then reassembles. Attendance: perfect.` });
      return;
    }
    u.alive = false;
    const dept = SPECIES[sp].department;
    if (chance(rng, saveChance)) {
      u.saved = true;
      u.hp = 1;
      if (state.policies.includes('rehire')) revivals += 1;
      emit({ t: 'down', uid: u.uid, fatal: false, text: `${u.name} is down! Medical staff drag them to safety. Filing workers' comp.` });
      incidents.push({
        employee: u.name,
        species: sp,
        department: dept,
        incident: 'Serious Workplace Injury',
        cause: describeCause(killer, liveAdvs().length),
        action: '1 week medical leave. Casserole from coworkers.',
        fatal: false,
      });
      return;
    }
    emit({ t: 'down', uid: u.uid, fatal: true, text: `${u.name} has suffered a workplace fatality.` });
    const killerCls = killer?.kind as AdvClass | undefined;
    incidents.push({
      employee: u.name,
      species: sp,
      department: dept,
      incident: incidentName(sp, tag, rng),
      cause: describeCause(killer, liveAdvs().length),
      action: (killerCls && CLASS_RECS[killerCls] && chance(rng, 0.5) ? CLASS_RECS[killerCls] : pick(rng, RECOMMENDATIONS))!,
      fatal: true,
    });
  }

  function pickTarget(pool: Unit[], actor: Unit): Unit {
    const weights = pool.map((t) => {
      let w = 1;
      if (actor.side === 'adv') {
        if (t.kind === 'slime') w *= 3;
        if (actor.kind === 'rogue') w *= 1 + (1 - t.hp / t.maxHp) * 2;
        if (actor.kind === 'paladin' && UNDEAD.includes(t.kind as SpeciesId)) w *= 2;
        if (actor.kind === 'ranger' && BEAST.includes(t.kind as SpeciesId)) w *= 1.6;
        if (bossHunters && (t.kind === 'dragon' || t.kind === 'vampire')) w *= 2;
      } else {
        if (actor.int > 12) w *= 1 + (1 - t.hp / t.maxHp) * 2;
        if (t.kind === 'wizard' || t.kind === 'cleric') w *= 1.3;
      }
      return w;
    });
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rng() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function empAct(u: Unit, staff: Unit[]) {
    const targets = liveAdvs();
    if (!targets.length) return;
    u.turns += 1;
    if (hasTraitU(u, 'coward') && u.hp < u.maxHp * 0.3 && chance(rng, 0.5)) {
      u.fled = true;
      emit({ t: 'flee', uid: u.uid, text: `${u.name} has left the building. Reason given: "a dentist appointment".` });
      return;
    }
    const sp = u.kind as SpeciesId;
    if (sp === 'dragon' && u.turns % 2 === 1) {
      const mult = state.tech.includes('dragonfuel') ? 1.05 : 0.7;
      emit({ t: 'log', text: `${u.name} delivers a scorching quarterly keynote. FIRE BREATH!`, tone: 'good' });
      for (const t of targets) damage(u, t, u.atk * mult, 'fire', `${t.name} is roasted for {dmg}.`);
      return;
    }
    if (sp === 'witch' && chance(rng, 0.45)) {
      const unhexed = targets.filter((t) => t.hexed <= 0);
      if (unhexed.length) {
        const t = unhexed.sort((a, b) => b.atk - a.atk)[0];
        t.hexed = 3;
        emit({ t: 'log', text: `${u.name} hexes ${t.name}. Their productivity drops 35%.`, tone: 'good' });
        damage(u, t, u.atk * 0.5, 'magic', `The hex stings for {dmg}.`, 0.5);
        return;
      }
    }
    const t = pickTarget(targets, u);
    if (sp === 'vampire') {
      const dealt = damage(u, t, u.atk, 'drain', `${u.name} drains ${t.name} for {dmg}.`);
      const heal = Math.round(dealt * (state.tech.includes('bloodbank') ? 0.8 : 0.4));
      if (heal > 0 && u.alive) {
        u.hp = Math.min(u.maxHp, u.hp + heal);
        emit({ t: 'heal', src: u.uid, tgt: u.uid, amt: heal, hp: u.hp, text: `${u.name} feels refreshed (+${heal}).` });
      }
      return;
    }
    if (sp === 'witch') {
      damage(u, t, u.atk, 'magic', `${u.name} casts a Very Serious Bolt at ${t.name} for {dmg}.`, 0.5);
      return;
    }
    const verbs: Record<string, string> = {
      slime: `${u.name} engulfs ${t.name} for {dmg}.`,
      goblin: `${u.name} stabs ${t.name} with a mop handle for {dmg}.`,
      skeleton: `${u.name} rattles a spear at ${t.name} for {dmg}.`,
      orc: `${u.name} performs a heavy-handed review of ${t.name}: {dmg}.`,
      mimic: `${u.name} chomps ${t.name} for {dmg}.`,
      dragon: `${u.name} claws ${t.name} for {dmg}.`,
    };
    void staff;
    damage(u, t, u.atk, 'melee', verbs[sp] ?? `${u.name} hits ${t.name} for {dmg}.`);
  }

  function advAct(u: Unit, staff: Unit[], allies: Unit[]) {
    const targets = staff.filter((s) => s.alive && !s.fled);
    if (!targets.length) return;
    u.turns += 1;
    const cls = u.kind as AdvClass;
    if (cls === 'cleric') {
      const hurt = allies.filter((a) => a.alive && !a.fled && a.hp < a.maxHp * 0.5).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) {
        const amt = Math.round(vary(rng, u.atk * 2.2, 0.15));
        hurt.hp = Math.min(hurt.maxHp, hurt.hp + amt);
        emit({ t: 'heal', src: u.uid, tgt: hurt.uid, amt, hp: hurt.hp, text: `${u.name} heals ${hurt.name} for ${amt}.` });
        return;
      }
    }
    if (cls === 'bard' && bardStacks < 3 && chance(rng, 0.6)) {
      bardStacks += 1;
      emit({ t: 'log', text: `${u.name} plays an inspiring power ballad. Party damage +${bardStacks * 10}%.`, tone: 'warn' });
      return;
    }
    if (cls === 'wizard' && u.turns % 2 === 1) {
      const mult = state.tech.includes('wards') ? 0.39 : 0.65;
      emit({ t: 'log', text: `${u.name} casts FIREBALL. The sprinklers do not activate.`, tone: 'bad' });
      for (const t of targets) damage(u, t, u.atk * mult, 'fire', `${t.name} takes {dmg} fire damage.`);
      return;
    }
    const t = pickTarget(targets, u);
    let raw = u.atk;
    let tag: HitTag = 'melee';
    const tSp = t.kind as SpeciesId;
    if ((cls === 'paladin' || cls === 'cleric') && UNDEAD.includes(tSp)) {
      raw *= cls === 'paladin' ? (insulated ? 1.375 : 1.75) : insulated ? 1.5 : 2;
      tag = 'smite';
    }
    if (cls === 'ranger') {
      tag = 'arrow';
      if (BEAST.includes(tSp)) raw *= 1.3;
    }
    if (bossHunters && (tSp === 'dragon' || tSp === 'vampire')) raw *= 1.35;
    const verb =
      tag === 'smite'
        ? `${u.name} smites ${t.name} with righteous fury for {dmg}.`
        : cls === 'wizard'
          ? `${u.name} fires a Magic Missile at ${t.name} for {dmg}.`
          : tag === 'arrow'
            ? `${u.name} shoots ${t.name} for {dmg}.`
            : `${u.name} hits ${t.name} with ${u.gear} for {dmg}.`;
    damage(u, t, raw, tag, verb, cls === 'wizard' ? 0.5 : 0);
  }

  function hasTraitU(u: Unit, t: TraitId) {
    return u.traits.includes(t);
  }

  // --- Main loop through the route ---
  for (let idx = 0; idx < rooms.length; idx++) {
    const room = rooms[idx];
    const isVault = room.type === 'vault';
    const alive = liveAdvs();
    if (!alive.length) break;

    // Lone badly hurt survivor may retreat.
    if (alive.length === 1 && alive[0].hp < alive[0].maxHp * 0.35 && chance(rng, 0.5) && idx > 0) {
      alive[0].fled = true;
      retreated = true;
      emit({ t: 'flee', uid: alive[0].uid, text: `${alive[0].name} looks around, alone and bleeding, and decides to pursue other opportunities.` });
      break;
    }

    const staff = Object.values(units).filter((u) => u.side === 'emp' && u.roomId === room.id && u.alive && !u.fled);
    emit({
      t: 'room',
      roomIdx: idx,
      roomId: room.id,
      staff: staff.map((s) => s.uid),
      text: `The party enters the ${ROOMS[room.type].name}.`,
    });

    if (room.type === 'trap') {
      runTrap(room, staff);
      if (!liveAdvs().length) break;
    }

    if (!staff.length) {
      if (isVault) break;
      emit({ t: 'log', text: pick(rng, ['Nobody is on shift here. The party admires the décor.', 'The room is unstaffed. Someone left a "Back in 5 min" sign.', 'Empty room. The adventurers help themselves to the snacks.']), tone: 'info' });
      continue;
    }

    // Opening strikes.
    const rogueAlive = () => liveAdvs().some((a) => a.kind === 'rogue');
    for (const s of staff) {
      const disguised = s.kind === 'mimic' || hasTraitU(s, 'disguise');
      if (!disguised || !s.alive) continue;
      const targets = liveAdvs();
      if (!targets.length) break;
      const t = targets[0];
      const spotChance = state.tech.includes('mimicry') ? 0.25 : 0.5;
      if (rogueAlive() && chance(rng, spotChance)) {
        emit({ t: 'log', text: `A rogue pokes the "treasure chest". ${s.name}'s disguise is blown!`, tone: 'warn' });
        damage(s, t, s.atk * 1.2, 'ambush', `${s.name} lunges anyway: {dmg}.`);
      } else {
        const bonus = state.tech.includes('mimicry') ? 1.5 : 1;
        const suit = isVault && s.kind === 'mimic' ? 1.2 : 1;
        emit({ t: 'log', text: `${t.name} reaches for the treasure… it was ${s.name} all along!`, tone: 'good' });
        damage(s, t, s.atk * 2.5 * bonus * suit, 'ambush', `SURPRISE AUDIT! ${s.name} bites for {dmg}.`);
      }
    }
    if (room.type === 'ambush') {
      emit({ t: 'log', text: 'The lights go out. Staff spring from the shadows!', tone: 'good' });
      const mult = 1.2 + room.level * 0.15;
      for (const s of staff) {
        const targets = liveAdvs();
        if (!targets.length || !s.alive) break;
        const t = pickTarget(targets, s);
        damage(s, t, s.atk * mult, 'ambush', `${s.name} ambushes ${t.name} for {dmg}.`);
      }
    }

    // Combat rounds.
    let round = 0;
    const staffUp = () => staff.some((s) => s.alive && !s.fled);
    while (round < ROUND_LIMIT && staffUp() && liveAdvs().length) {
      round += 1;
      const actors = [...staff.filter((s) => s.alive && !s.fled), ...liveAdvs()];
      const order = actors
        .map((a) => ({ a, init: a.spd * (0.75 + rng() * 0.5) }))
        .sort((x, y) => y.init - x.init)
        .map((x) => x.a);
      const avgSpd = (side: 'emp' | 'adv') => {
        const pool = actors.filter((a) => a.side === side);
        return pool.reduce((s, a) => s + a.spd, 0) / Math.max(1, pool.length);
      };
      const empSpd = avgSpd('emp');
      const advSpd = avgSpd('adv');
      for (const a of order) {
        if (!a.alive || a.fled) continue;
        if (!staffUp() || !liveAdvs().length) break;
        const act = () => (a.side === 'emp' ? empAct(a, staff) : advAct(a, staff, advs));
        act();
        const enemyAvg = a.side === 'emp' ? advSpd : empSpd;
        const extra = clamp((a.spd / Math.max(1, enemyAvg) - 1) * 0.5, 0, 0.5);
        if (extra > 0 && chance(rng, extra) && a.alive && !a.fled && staffUp() && liveAdvs().length) act();
      }
      for (const u of [...staff, ...advs]) if (u.hexed > 0) u.hexed -= 1;
    }

    if (!liveAdvs().length) break;
    if (staffUp()) {
      // Stalemate: party pushes past (or gives up at the vault).
      if (isVault) {
        retreated = true;
        emit({ t: 'log', text: 'The exhausted party gives up on the vault and limps home. Treasury intact.', tone: 'good' });
        for (const a of liveAdvs()) a.fled = true;
        break;
      }
      emit({ t: 'clear', roomIdx: idx, text: 'The party slips past the remaining staff while they argue about whose turn it is.' });
    } else {
      emit({ t: 'clear', roomIdx: idx, text: isVault ? 'The vault staff are down!' : `The ${ROOMS[room.type].name} has been cleared. The party presses on.` });
    }
  }

  function runTrap(room: Room, staff: Unit[]) {
    const tech = staff.find((s) => s.alive);
    const techEmp = tech ? state.employees.find((e) => e.id === tech.uid) : undefined;
    let mult = tech ? (1 + (tech.int ?? 0) / 40) * GRADE_MULT[suitability(tech.kind as SpeciesId, 'trap')] : state.tech.includes('autoreset') ? 0.7 : 0.35;
    if (techEmp) mult *= 1 + coreStats(techEmp).int / 200;
    if (state.tech.includes('spikes')) mult *= 1.4;
    if (state.tech.includes('poison')) mult *= 1.4;
    const base = (12 + room.level * 10) * mult;
    const rogue = liveAdvs().find((a) => a.kind === 'rogue');
    if (rogue && chance(rng, 0.55)) {
      emit({ t: 'log', text: `${rogue.name} disarms the pressure plate. HR notes: impressive attention to detail.`, tone: 'warn' });
      if (!(state.tech.includes('poison') && chance(rng, 0.3))) return;
      emit({ t: 'log', text: 'But the poison darts were on a separate subscription!', tone: 'good' });
    }
    if (!tech && !state.tech.includes('autoreset')) emit({ t: 'log', text: 'No technician on duty — the traps are only half-armed.', tone: 'warn' });
    for (const a of liveAdvs()) {
      damage(null, a, vary(rng, base, 0.2), 'trap', `A trap springs on ${a.name} for {dmg}.`, 0.5);
    }
  }

  const outcome: 'defended' | 'breach' = liveAdvs().length && !retreated ? 'breach' : 'defended';
  if (outcome === 'breach') {
    emit({ t: 'end', outcome, text: 'SECURITY BREACH: The adventurers have reached the treasury.' });
  } else {
    emit({ t: 'end', outcome, text: retreated ? 'The visitors have retreated. Threat neutralized.' : 'All visitors have been processed. Threat neutralized.' });
  }

  const emp: Record<string, EmpResult> = {};
  for (const u of Object.values(units)) {
    if (u.side !== 'emp') continue;
    emp[u.uid] = {
      hp: u.hp,
      died: !u.alive && !u.saved && !u.fled,
      injured: u.saved,
      fled: u.fled,
      kills: u.kills,
      damage: u.damage,
      fought: events.some((ev) => ev.t === 'room' && ev.staff.includes(u.uid)),
    };
  }

  const info: Record<string, UnitInfo> = {};
  for (const u of Object.values(units)) {
    info[u.uid] = { uid: u.uid, side: u.side, name: u.name, kind: u.kind, maxHp: u.maxHp, hp: u.side === 'adv' ? u.maxHp : initialHp(state, u), hue: u.hue, level: u.level, roomId: u.roomId };
  }

  return {
    events,
    units: info,
    rooms: rooms.map((r) => ({ id: r.id, type: r.type, level: r.level })),
    outcome,
    retreated,
    emp,
    slain,
    loot,
    incidents,
    revivals,
    absent,
  };
}

function initialHp(state: GameState, u: Unit): number {
  const e = state.employees.find((x) => x.id === u.uid);
  if (!e) return u.maxHp;
  return clamp(Math.round(e.hp), 1, u.maxHp);
}

export function partyKindLabel(kind: PartyKind): string {
  return {
    beginner: 'Beginner Party',
    goblinhunters: 'Goblin Hunters',
    experienced: 'Experienced Adventurers',
    wizards: 'Wizard Party',
    paladins: 'Paladin Squad',
    rogues: 'Rogue Guild',
    bosshunters: 'Boss-Hunting Party',
    audit: 'Quarterly Audit (Boss Wave)',
  }[kind];
}

export { hasTrait };
