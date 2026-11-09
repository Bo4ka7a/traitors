import { burnVotes, episodesThrough, finalRound, forecast, publicFacts, statusAt } from "./model";
import type { Hypothesis, PublicSeason, Role, RolePeriod, Season } from "./types";

export function choose(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  let count = 1n;
  for (let i = 1; i <= Math.min(k, n-k); i++) count = count * BigInt(n-i+1) / BigInt(i);
  return count;
}

export function combinations(season: PublicSeason, through: number, hypothesis?: Hypothesis) {
  const people = season.participants.filter(p => p.joined <= through);
  const ids = people.map(p => p.id);
  const initial = people.filter(p => p.joined <= 1).map(p => p.id);
  const facts = publicFacts(season, through);
  const required = new Set<string>();
  const excluded = new Set<string>();
  const recruited = new Map<string, number>();
  const conflicts: string[] = [];
  for (const f of facts.filter(f => f.kind === "recruitment")) {
    recruited.set(f.player, Math.min(f.from, recruited.get(f.player) ?? Infinity));
    excluded.add(f.player);
  }
  for (const f of facts.filter(f => f.kind === "confirmation")) {
    if ((recruited.get(f.player) ?? Infinity) <= f.from) {
      if (f.role === "faithful") conflicts.push("Несъвместими публични роли след вербуване.");
    } else if (f.role === "traitor") required.add(f.player);
    else excluded.add(f.player);
  }
  if (hypothesis?.enabled) {
    hypothesis.required.filter(id => ids.includes(id)).forEach(id => required.add(id));
    hypothesis.excluded.filter(id => ids.includes(id)).forEach(id => excluded.add(id));
  }
  if ([...required].some(id => excluded.has(id) || !initial.includes(id))) conflicts.push("Публичните роли или условията за началния състав си противоречат.");
  const rest = initial.filter(id => !required.has(id) && !excluded.has(id));
  const needed = season.initialTraitors - required.size;
  const total = choose(initial.length, season.initialTraitors);
  const constrained = conflicts.length ? 0n : choose(rest.length, needed);

  // The optional scenario limits one group, so count it by partitioning the
  // unassigned initial cast into members and non-members of that group.
  const breakfast = episodesThrough(season, through).flatMap(e => e.breakfasts.map(b => ({ ...b, ep: e.number })))
    .filter(b => b.order === "actual" && b.last).at(-1);
  const group = breakfast?.groups.find(g => g.id === breakfast.last)?.people ?? [];
  const limitGroup = hypothesis?.enabled && hypothesis.breakfastLimit && group.length > 1;
  const fixedInGroup = group.filter(id => required.has(id) || (recruited.get(id) ?? Infinity) <= (breakfast?.ep ?? -1)).length;
  const freeInGroup = rest.filter(id => group.includes(id)).length;
  let remaining = constrained;
  if (limitGroup && constrained > 0n) {
    remaining = 0n;
    for (let i = 0; i <= Math.min(freeInGroup, needed, 1-fixedInGroup); i++) {
      remaining += choose(freeInGroup, i) * choose(rest.length-freeInGroup, needed-i);
    }
  }

  const examples: { initial: string[]; active: string[] }[] = [];
  const remainingGroupMembers = Array(rest.length + 1).fill(0) as number[];
  for (let i = rest.length - 1; i >= 0; i--) remainingGroupMembers[i] = remainingGroupMembers[i+1] + Number(group.includes(rest[i]));
  function collect(start: number, selected: string[], inGroup: number) {
    const left = needed - selected.length;
    if (examples.length >= 12 || rest.length - start < left) return;
    if (limitGroup) {
      const minimumInGroup = Math.max(0, left - (rest.length - start - remainingGroupMembers[start]));
      if (inGroup + minimumInGroup + fixedInGroup > 1) return;
    }
    if (!left) {
      const initial = [...required, ...selected];
      examples.push({ initial, active: [...initial, ...recruited.keys()].filter(id => statusAt(season, id, through).status === "active") });
      return;
    }
    for (let i = start; i <= rest.length - left && examples.length < 12; i++) {
      collect(i+1, [...selected, rest[i]], inGroup + Number(group.includes(rest[i])));
    }
  }
  if (remaining > 0n) collect(0, [], 0);
  return { total, remaining, excluded: total - remaining, examples, required: [...required], ruledOut: [...excluded],
    recruited: [...recruited.keys()], conflicts, fixedExcluded: total-constrained, breakfastExcluded: constrained-remaining };
}

export function roleAt(periods: RolePeriod[], player: string, episode: number): Role | undefined {
  return periods.filter(r => r.player === player && r.from <= episode).sort((a,b) => b.from - a.from)[0]?.role;
}

export function evaluate(season: Season, input: PublicSeason) {
  const rows = episodesThrough(input).map(({ number }) => {
    const ranking = forecast(input, number).filter(p => p.status === "active");
    // Withhold a top-k metric when there is no signal or the cut splits a tie.
    const metric = (k: number) => {
      const subset = ranking.slice(0, k);
      const roles = subset.map(p => roleAt(season.privateRoles, p.id, number));
      if (!subset.length || !ranking.some(p => p.evidence.length) ||
        ranking[k]?.score === subset.at(-1)?.score || roles.some(r => !r)) return null;
      return roles.filter(r => r === "traitor").length;
    };
    return { number, top1: metric(1), top3: metric(3), top5: metric(5) };
  });
  let ordinal = 0, burnTraitor = 0, burnKnown = 0;
  const faithfulEligible = new Set<string>(), faithfulBurn = new Set<string>();
  for (const e of episodesThrough(input)) {
    for (const t of e.tables) {
      ordinal++;
      const round = t.rounds.find(r => r.id === t.decision?.roundId);
      if (!round || !finalRound(round) || ordinal > 3 || !t.decision) continue;
      const exitRole = roleAt(season.privateRoles, t.decision.player, e.number) ?? t.decision.role;
      if (exitRole !== "faithful") continue;
      const burned = new Set(burnVotes(t, ordinal, exitRole));
      for (const p of round.eligible) {
        if (!round.votes[p]?.target) continue;
        const role = roleAt(season.privateRoles, p, e.number);
        if (role === "faithful") faithfulEligible.add(p);
        if (!burned.has(p) || !role) continue;
        burnKnown++;
        if (role === "traitor") burnTraitor++;
        else faithfulBurn.add(p);
      }
    }
  }
  const occurrences: Record<string, number> = {};
  for (const p of forecast(input, Infinity)) {
    for (const e of p.evidence) occurrences[e.rule] = (occurrences[e.rule] ?? 0) + 1;
  }
  const breakfastGroups = episodesThrough(input).flatMap(e => e.breakfasts.flatMap(b => {
    const last = b.groups.find(g => g.id === b.last);
    return last && b.order === "actual" ? [{ episode: e.number, roles: last.people.map(p => roleAt(season.privateRoles, p, e.number)) }] : [];
  })).filter(b => b.roles.every(Boolean));
  return { rows, first: rows.filter(r => r.top1 === 1).length, eligibleFirst: rows.filter(r => r.top1 !== null).length,
    burnTraitor, burnKnown, faithfulEligible: faithfulEligible.size, faithfulBurn: faithfulBurn.size, occurrences,
    breakfastTotal: breakfastGroups.length, breakfastWithTraitor: breakfastGroups.filter(g => g.roles.includes("traitor")).length };
}
