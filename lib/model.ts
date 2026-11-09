import type { Episode, PublicSeason, Round, RuleId, Table } from "./types";
import { statusNames } from "./types";

export function episodesThrough(season: PublicSeason, through = Infinity) {
  return season.episodes.filter(e => e.number <= through).sort((a, b) => a.number - b.number);
}

export function statusAt(season: PublicSeason, player: string, through = Infinity, tableId?: string) {
  for (const e of episodesThrough(season, through)) {
    const early = e.exits.find(x => x.player === player && x.timing === "before");
    if (early) return { status: early.method, episode: e.number };
    for (const table of e.tables) {
      if (table.id === tableId) return { status: "active" as const, episode: null };
      if (table.decision?.player === player) return { status: "banished" as const, episode: e.number };
    }
    const exit = e.exits.find(x => x.player === player && x.timing === "after");
    if (exit && (!tableId || e.number !== through)) return { status: exit.method, episode: e.number };
  }
  return { status: "active" as keyof typeof statusNames, episode: null };
}

export function tallies(round: Round) {
  const counts: Record<string, number> = {};
  for (const id of round.eligible) {
    const target = round.votes[id]?.target;
    if (target) counts[target] = (counts[target] ?? 0) + 1;
  }
  return counts;
}
export function filled(round: Round) {
  return round.eligible.length > 0 && round.eligible.every(id => Object.hasOwn(round.votes, id));
}
export function finalRound(round: Round) {
  return round.complete && filled(round);
}
export function leaders(round: Round) {
  if (!finalRound(round)) return [];
  const counts = tallies(round);
  const high = Math.max(0, ...Object.values(counts));
  return Object.keys(counts).filter(id => counts[id] === high);
}
export function decidingRound(table: Table) {
  const round = table.rounds.find(r => r.id === table.decision?.roundId);
  return round && finalRound(round) ? round : undefined;
}
export function burnVotes(table: Table, ordinal: number, role = table.decision?.role) {
  const round = decidingRound(table);
  if (!round || role !== "faithful" || ordinal > 3) return [];
  const counts = tallies(round);
  return round.eligible.filter(id => {
    const target = round.votes[id]?.target;
    return target && target !== table.decision?.player && counts[target] === 1;
  });
}
export function publicFacts(season: PublicSeason, through: number) {
  return episodesThrough(season, through).flatMap(e => [
    ...e.facts.map(f => ({ ...f, observed: e.number })),
    ...e.tables.flatMap(({ decision: d, id }) => d?.role ? [{ id, player: d.player, kind: "confirmation" as const, role: d.role, from: e.number, observed: e.number }] : []),
    ...e.exits.flatMap(x => x.role ? [{ id: x.id, player: x.player, kind: "confirmation" as const, role: x.role, from: e.number, observed: e.number }] : []),
  ]);
}

export type Evidence = { rule: RuleId; points: number; eventEpisode: number; appliedEpisode: number; detail: string };
type Score = { score: number; evidence: Evidence[]; votes: number };

export function forecast(season: PublicSeason, through: number) {
  const scores = new Map<string, Score>(season.participants.filter(p => p.joined <= through).map(p => [p.id, { score: 0, evidence: [], votes: 0 }]));
  const name = (id: string) => season.participants.find(p => p.id === id)?.name ?? id;
  function add(player: string, rule: RuleId, eventEpisode: number, appliedEpisode: number, detail: string) {
    const entry = scores.get(player);
    const setting = season.model.rules[rule];
    if (!entry || !setting.enabled) return;
    entry.evidence.push({ rule, points: setting.points, eventEpisode, appliedEpisode, detail });
    entry.score = Number((entry.score + setting.points).toFixed(6));
  }
  const seen: { voter: string; target: string; ep: number; table: string }[] = [];
  const breakfasts: { people: string[]; ep: number }[] = [];
  const visibleFacts = publicFacts(season, through);
  const reveals = new Map<string, number>();
  let ordinal = 0;
  for (const episode of episodesThrough(season, through)) {
    for (const b of episode.breakfasts) {
      if (b.order !== "actual" && !(b.order === "broadcast" && season.model.allowBroadcastBreakfast)) continue;
      const group = b.groups.find(g => g.id === b.last);
      if (group) breakfasts.push({ people: group.people, ep: episode.number });
    }
    for (const table of episode.tables) {
      ordinal++;
      const decision = table.decision;
      const deciding = decidingRound(table);
      const fact = visibleFacts.filter(f => f.player === decision?.player && f.from <= episode.number &&
        (f.observed <= episode.number || (f.kind === "confirmation" && f.from === episode.number)))
        .sort((a, b) => b.from - a.from || a.observed - b.observed)[0];
      const role = decision?.role ?? fact?.role;
      const applied = decision?.role ? episode.number : Math.max(episode.number, fact?.observed ?? episode.number);
      const burned = new Set(burnVotes(table, ordinal, role));
      const traitor = role === "traitor" ? decision?.player : undefined;
      if (traitor && deciding) reveals.set(table.id, applied);
      for (const round of table.rounds.filter(finalRound)) {
        for (const voter of round.eligible) {
          const target = round.votes[voter]?.target;
          if (!target) continue;
          const entry = scores.get(voter);
          if (entry) entry.votes++;
          if (round.id === deciding?.id) {
            if (burned.has(voter)) add(voter, "burn", episode.number, applied, name(target));
            if (traitor) {
              const first = season.model.firstVote && season.model.rules.first.enabled &&
                !seen.some(v => v.voter === voter && v.target === traitor);
              add(voter, target === traitor ? (first ? "first" : "banished") : "other",
                episode.number, applied, name(target));
            }
          }
          seen.push({ voter, target, ep: episode.number, table: table.id });
        }
      }
    }
  }

  // Rebuild at the observation date of each reveal, including a later confirmation
  // that explicitly refers to the episode where the player was banished.
  for (const episode of episodesThrough(season, through)) {
    for (const { decision, id } of episode.tables) {
      if (!decision) continue;
      const facts = visibleFacts.filter(f => f.player === decision.player);
      const reveal = reveals.get(id);
      if (reveal === undefined) continue;
      const recruited = Math.max(0, ...facts.filter(f => f.kind === "recruitment" && f.from <= episode.number).map(f => f.from));
      const already = new Set<string>();
      const tableIndex = episode.tables.findIndex(t => t.id === id);
      for (const v of seen) {
        const prior = v.ep < episode.number || (v.ep === episode.number && episode.tables.findIndex(t => t.id === v.table) < tableIndex);
        if (!prior || v.ep < recruited || v.voter !== decision.player || already.has(v.target)) continue;
        already.add(v.target);
        add(v.target, "history", v.ep, reveal, name(decision.player));
      }
      already.clear();
      for (const b of breakfasts) {
        if (b.ep > episode.number || b.ep < recruited || !b.people.includes(decision.player)) continue;
        for (const player of b.people) {
          if (player === decision.player || already.has(player)) continue;
          already.add(player);
          add(player, "breakfast", b.ep, reveal, name(decision.player));
        }
      }
    }
  }
  return season.participants.filter(p => scores.has(p.id)).map(p => ({
    ...p, ...scores.get(p.id)!, ...statusAt(season, p.id, through),
  })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name,"bg") || a.id.localeCompare(b.id));
}

export function publicInput(season: PublicSeason): PublicSeason {
  const { participants, episodes, model, initialTraitors } = season;
  return { participants, episodes, model, initialTraitors };
}

export function forecasts(season: PublicSeason) {
  return episodesThrough(season).map(({ number }) => ({ number, ranking: forecast(season, number) }));
}

export function freshEpisode(number: number): Episode {
  return { id: crypto.randomUUID(), number, date: "", notes: "", events: "", breakfasts: [], tables: [], exits: [], facts: [] };
}
