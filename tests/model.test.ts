import assert from "node:assert/strict";
import test from "node:test";
import { choose, combinations, evaluate, roleAt } from "../lib/analysis";
import { burnVotes, forecast, forecasts, freshEpisode, leaders, publicInput, statusAt } from "../lib/model";
import { newSeason } from "../lib/rules";
import type { Role, Round, Season, Table } from "../lib/types";
import { backup, parseBackup, validateSeason } from "../lib/validation";

function round(votes: Record<string, string | null>, complete = true): Round {
  const eligible = ["a", "b", "c", "d", "e"];
  return { id: crypto.randomUUID(), eligible, candidates: eligible, complete, notes: "",
    votes: Object.fromEntries(Object.entries(votes).map(([id,target],i) => [id,{ target, revealed: target ? i+1 : null, cast: null }])) };
}
function table(r: Round, player?: string, role: Role | null = null): Table {
  return { id: crypto.randomUUID(), rounds: [r], decision: player ? { player, role, roundId: r.id, reason: "" } : null };
}
function season(...tables: Table[]): Season {
  const s = newSeason("България");
  s.participants = ["a","b","c","d","e"].map(id => ({ id, name: id, joined: 1, photo: "" }));
  s.episodes = tables.map((table,i) => ({ ...freshEpisode(i+1), tables: [table] }));
  return s;
}
function points(s: Season, id: string, n = Infinity) {
  return forecast(publicInput(s),n).find(p => p.id === id)!.score;
}
const sample = { a: "c", b: "c", c: "b", d: "a", e: "c" };

test("burn votes are singletons for other candidates on an early faithful banishment", () => {
  const t = table(round(sample),"c","faithful");
  assert.deepEqual(burnVotes(t,1), ["c","d"]);
  assert.deepEqual(burnVotes(t,4), []);
  assert.equal(points(season(t),"d"), 0.47);
  assert.deepEqual(burnVotes(table(round(sample),"c","traitor"),1), []);
});
test("banishment of a traitor applies exactly one compatible score per ballot", () => {
  const s = season(table(round(sample),"c","traitor"));
  assert.equal(points(s,"a"), 0.33);
  assert.equal(points(s,"d"), -1.28);
  s.model.firstVote = true;
  assert.equal(points(s,"a"), 0.40);
  assert.equal(points(s,"d"), -1.28);
  s.model.rules.first.enabled = false;
  assert.equal(points(s,"a"), 0.33);
});
test("a faithful banishment never triggers traitor banishment scoring", () => {
  const s = season(table(round(sample),"c","faithful"));
  assert.equal(points(s,"a"), 0);
  assert.equal(points(s,"d"), 0.47);
});
test("earlier ballots and breakfast become evidence at the banishment reveal", () => {
  const before = table(round(sample));
  const s = season(before, table(round(sample),"c","traitor"));
  s.episodes[0].breakfasts = [{ id: "break", last: "last", order: "actual", notes: "", groups: [{ id: "last", people: ["c","d"] }] }];
  const history = forecasts(publicInput(s));
  assert.equal(history[0].ranking.find(p => p.id === "b")!.score, 0);
  assert.equal(points(s,"b"), -1.36);
  assert.equal(points(s,"d"), -3.01);
  const evidence = history[1].ranking.find(p => p.id === "d")!.evidence.find(e => e.rule === "breakfast");
  assert.deepEqual([evidence?.eventEpisode,evidence?.appliedEpisode], [1,2]);
  s.episodes[0].breakfasts[0].order = "broadcast";
  assert.equal(points(s,"d"), -1.28);
  s.model.allowBroadcastBreakfast = true;
  assert.equal(points(s,"d"), -3.01);
});
test("late confirmation leaves prior snapshots intact", () => {
  const s = season(table(round(sample)), table(round(sample),"c"));
  const historical = forecasts(publicInput(s));
  s.episodes.push({ ...freshEpisode(3), facts: [{ id: "reveal", player: "c", from: 2, kind: "confirmation", role: "traitor" }] });
  assert.deepEqual(forecasts(publicInput(s)).slice(0,2), historical);
  assert.equal(points(s,"a",3), 0.33);
  assert.equal(points(s,"b",3), -1.36);
});
test("changing an earlier vote removes obsolete evidence and deterministically rebuilds the ranking", () => {
  const s = season(table(round(sample),"c","traitor"));
  assert.equal(points(s,"a"), 0.33);
  const b = s.episodes[0].tables[0].rounds[0].votes.a;
  b.target = "d";
  assert.equal(points(s,"a"), -1.28);
  assert.deepEqual(forecasts(publicInput(s)), forecasts(publicInput(structuredClone(s))));
});
test("incomplete voting never reports a winner or adds score", () => {
  const r = round({ a: "c" },false);
  assert.deepEqual(leaders(r), []);
  assert.equal(points(season(table(r)),"a"), 0);
  r.complete = true;
  assert.throws(() => validateSeason(season(table(r))));
});
test("repeat rounds support a tie, abstentions and a single scoring round", () => {
  const tie = round({ a: "c", b: "a", c: "a", d: "c", e: null });
  const decisive = round(sample);
  const t = table(decisive,"c","traitor");
  t.rounds.unshift(tie);
  const s = season(t);
  assert.deepEqual(leaders(tie).sort(), ["a","c"]);
  s.model.firstVote = true;
  assert.equal(points(s,"a"), 0.33);
  assert.equal(points(s,"b"), 0.40);
  assert.equal(points(s,"d"), -1.28);
  assert.doesNotThrow(() => validateSeason(s));
});
test("recruitment limits retrospectively relevant evidence and preserves role periods", () => {
  const s = season(table(round(sample)), table(round(sample),"c","traitor"));
  s.episodes[1].facts = [{ id: "new-role", player: "c", kind: "recruitment", role: "traitor", from: 2 }];
  s.privateRoles = [{ id: "r1", player: "c", role: "faithful", from: 1 }, { id: "r2", player: "c", role: "traitor", from: 2 }];
  assert.equal(roleAt(s.privateRoles,"c",1),"faithful");
  assert.equal(roleAt(s.privateRoles,"c",2),"traitor");
  assert.equal(points(s,"b"), 0.33);
  assert.equal(combinations(publicInput(s),1).remaining, 10n);
  s.initialTraitors = 2;
  const result = combinations(publicInput(s),2);
  assert.equal(result.remaining, 6n);
  assert.deepEqual(result.recruited,["c"]);
  assert.ok(result.examples.every(e => !e.active.includes("c")));
});
test("combinations are counted exactly, with isolated opt-in breakfast hypotheses", () => {
  const s = season(table(round(sample)));
  s.initialTraitors = 2;
  s.episodes[0].facts = [{ id: "confirmed", player: "e", from: 1, kind: "confirmation", role: "faithful" }];
  s.episodes[0].breakfasts = [{ id: "b1", order: "actual", last: "g1", notes: "", groups: [{ id: "g1", people: ["a","b"] }] }];
  const base = combinations(publicInput(s),1);
  assert.equal(base.total,10n);
  assert.equal(base.remaining,6n);
  assert.equal(base.excluded,4n);
  const scenario = combinations(publicInput(s),1,{ enabled: true, required: [], excluded: [], breakfastLimit: true });
  assert.equal(scenario.remaining,5n);
  assert.equal(scenario.examples.length,5);
  assert.equal(choose(100,50),100891344545564193334812497256n);
});
test("private role data never changes historical forecasts", () => {
  const s = season(table(round(sample),"c","traitor"));
  const before = forecasts(publicInput(s));
  assert.equal(evaluate(s,publicInput(s)).eligibleFirst,0);
  s.privateRoles = ["a","b","c","d","e"].map(p => ({ id: "r-"+p, player: p, from: 1, role: p === "a" ? "traitor" : "faithful" }));
  assert.deepEqual(forecasts(publicInput(s)),before);
  assert.deepEqual(forecasts(s),before);
  assert.equal(evaluate(s,publicInput(s)).rows[0].top3,1);
});
test("an exit before voting removes eligibility and preserves the previous episode", () => {
  const s = season(table(round(sample)), table(round(sample)));
  s.episodes[1].exits = [{ id: "exit", player: "e", method: "murdered", timing: "before", role: null, notes: "" }];
  assert.equal(statusAt(s,"e",2,s.episodes[1].tables[0].id).status, "murdered");
  assert.equal(statusAt(s,"e",1).status, "active");
  assert.throws(() => validateSeason(s), /Невалиден списък/);
});
test("versioned backups round-trip and reject malformed references and duplicate IDs", () => {
  const s = season(table(round(sample),"c","traitor"));
  assert.deepEqual(parseBackup(backup([s])),[s]);
  assert.throws(() => parseBackup(backup([s,s])), /дублирани/);
  assert.throws(() => parseBackup(backup([s]).replace('"schemaVersion": 1','"schemaVersion": 9')));
  s.episodes[0].tables[0].rounds[0].votes.a.target = "unregistered";
  assert.throws(() => parseBackup(backup([s])), /Невалиден глас/);
});
