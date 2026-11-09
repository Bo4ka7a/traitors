import { z } from "zod";
import type { Season } from "./types";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).refine(s => !["__proto__", "constructor", "prototype"].includes(s));
const number = z.number().int().min(1).max(999);
const text = z.string().max(8000);
const role = z.enum(["traitor", "faithful"]);
const setting = z.strictObject({ enabled: z.boolean(), points: z.number().min(-100).max(100) });
const round = z.strictObject({
  id, eligible: z.array(id), candidates: z.array(id), complete: z.boolean(), notes: text,
  votes: z.record(id, z.strictObject({ target: id.nullable(), revealed: number.nullable(), cast: number.nullable() })),
});
export const seasonSchema = z.strictObject({
  id, title: z.string().trim().min(1).max(120), initialTraitors: z.number().int().min(0).max(100),
  participants: z.array(z.strictObject({ id, name: z.string().trim().min(1).max(120), photo: z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(1000)]), joined: number })).max(100),
  model: z.strictObject({ firstVote: z.boolean(), allowBroadcastBreakfast: z.boolean(),
    rules: z.strictObject({ burn: setting, banished: setting, first: setting, other: setting, history: setting, breakfast: setting }) }),
  hypothesis: z.strictObject({ enabled: z.boolean(), required: z.array(id), excluded: z.array(id), breakfastLimit: z.boolean() }),
  privateRoles: z.array(z.strictObject({ id, player: id, from: number, role })),
  episodes: z.array(z.strictObject({
    id, number, date: z.union([z.literal(""), z.iso.date()]), notes: text, events: text,
    breakfasts: z.array(z.strictObject({
      id, last: id.nullable(), order: z.enum(["unknown", "broadcast", "actual"]), notes: text,
      groups: z.array(z.strictObject({ id, people: z.array(id) })),
    })),
    tables: z.array(z.strictObject({ id, rounds: z.array(round),
      decision: z.strictObject({ roundId: id, player: id, role: role.nullable(), reason: text }).nullable() })),
    exits: z.array(z.strictObject({ id, player: id, method: z.enum(["murdered", "left"]), timing: z.enum(["before", "after"]), role: role.nullable(), notes: text })),
    facts: z.array(z.strictObject({ id, player: id, role, kind: z.enum(["confirmation", "recruitment"]), from: number })),
  })),
}).superRefine((s, ctx) => {
  function require(ok: unknown, message: string) {
    if (!ok) ctx.addIssue({ code: "custom", message });
  }
  const unique = (values: unknown[]) => new Set(values).size === values.length;
  const ids = [...s.participants, ...s.privateRoles].map(x => x.id);
  const people = new Map(s.participants.map(p => [p.id, p]));
  const valid = (id: string, ep = Infinity) => (people.get(id)?.joined ?? Infinity) <= ep && people.has(id);
  require(unique(s.episodes.map(e => e.number)), "Номерата на епизодите трябва да са уникални.");
  require(unique(s.privateRoles.map(r => r.player + "/" + r.from)), "Има два периода за една и съща роля и епизод.");
  require(s.privateRoles.every(r => valid(r.player, r.from)), "Невалиден участник или начален епизод на тайна роля.");
  require([...s.hypothesis.required, ...s.hypothesis.excluded].every(id => valid(id, 1)), "Хипотезите се отнасят само за началния състав.");
  const eliminated = new Set<string>();
  for (const e of [...s.episodes].sort((a,b) => a.number-b.number)) {
    ids.push(e.id, ...e.tables.map(t => t.id), ...e.breakfasts.map(b => b.id), ...e.exits.map(x => x.id), ...e.facts.map(x => x.id));
    require(e.facts.every(f => f.from <= e.number && valid(f.player, f.from) &&
      (f.kind !== "recruitment" || f.role === "traitor")), "Невалидно публично разкриване или вербуване.");
    for (const b of e.breakfasts) {
      const members = b.groups.flatMap(g => g.people);
      ids.push(...b.groups.map(g => g.id));
      require(unique(members) && members.every(p => valid(p, e.number)), "Дублиран или невалиден участник на закуска.");
      require(!b.last || b.groups.some(g => g.id === b.last && g.people.length), "Последната група трябва да съдържа участници.");
    }
    for (const x of e.exits.filter(x => x.timing === "before")) {
      require(valid(x.player, e.number) && !eliminated.has(x.player), "Невалидно напускане преди кръглите маси.");
      eliminated.add(x.player);
    }
    for (const t of e.tables) {
      ids.push(...t.rounds.map(r => r.id));
      for (const r of t.rounds) {
        require(unique(r.eligible) && unique(r.candidates) && [...r.eligible, ...r.candidates].every(id => valid(id, e.number) && !eliminated.has(id)), "Невалиден списък за гласуване. Проверете предходните прогонвания и напускания.");
        for (const [voter, ballot] of Object.entries(r.votes)) {
          require(r.eligible.includes(voter) && (!ballot.target || (r.candidates.includes(ballot.target) && ballot.target !== voter)),
            "Невалиден глас или кандидат.");
          require(!ballot.target || ballot.revealed, "Всеки подаден глас изисква пореден номер по телевизията.");
          require(ballot.target || (!ballot.revealed && !ballot.cast), "Негласувал участник няма ред на глас.");
        }
        for (const key of ["revealed", "cast"] as const) {
          require(unique(Object.values(r.votes).flatMap(v => v[key] ? [v[key]] : [])), "Дублиран пореден номер на глас.");
        }
        require(!r.complete || (r.eligible.length && r.eligible.every(id => Object.hasOwn(r.votes, id))), "За завършен тур е нужен запис за всеки гласуващ.");
      }
      if (t.decision) {
        const d = t.decision;
        const selected = t.rounds.find(r => r.id === d.roundId);
        require(selected?.complete && valid(d.player, e.number) && !eliminated.has(d.player), "Прогонването изисква завършен тур и активен участник.");
        const counts = new Map<string, number>();
        for (const vote of Object.values(selected?.votes ?? {})) if (vote.target) counts.set(vote.target, (counts.get(vote.target) ?? 0) + 1);
        const top = Math.max(0, ...counts.values());
        require(d.reason.trim() || (top > 0 && counts.get(d.player) === top && [...counts.values()].filter(n => n === top).length === 1),
          "При равенство или нестандартно решение въведете основание.");
        eliminated.add(d.player);
      }
    }
    for (const x of e.exits.filter(x => x.timing === "after")) {
      require(valid(x.player, e.number) && !eliminated.has(x.player), "Участникът вече е напуснал или още не участва.");
      eliminated.add(x.player);
    }
  }
  require(unique(ids), "Идентификаторите в сезона трябва да са уникални.");
});
export function validateSeason(value: unknown): Season {
  const result = seasonSchema.safeParse(value);
  if (!result.success) throw new Error(result.error.issues.map(i => (i.path.length ? i.path.join(".") + " · " : "") + i.message).slice(0, 4).join(" "));
  if (new TextEncoder().encode(JSON.stringify(result.data)).length > 720_000) throw new Error("Сезонът надхвърля размера за съхранение. Архивирайте данните.");
  return result.data;
}

export function parseBackup(raw: string) {
  if (raw.length > 20_000_000) throw new Error("Резервното копие е твърде голямо.");
  const value = z.strictObject({ schemaVersion: z.literal(1), exportedAt: z.iso.datetime(), seasons: z.array(z.unknown()).min(1).max(100) }).parse(JSON.parse(raw));
  const seasons = value.seasons.map(validateSeason);
  if (new Set(seasons.map(s => s.id)).size !== seasons.length) throw new Error("Има дублирани сезони в архива.");
  return seasons;
}
export function backup(seasons: Season[]) {
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), seasons }, null, 2);
}
