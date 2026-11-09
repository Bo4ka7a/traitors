import type { Model, RuleId, Season } from "./types";

export const frySource = "https://www.youtube.com/watch?v=twDvxNooI_4";
export const parkerSource = "https://www.youtube.com/watch?v=KxHKrbfnmTU";
export const rules: { id: RuleId; name: string; condition: string; points: number; experimental: boolean; source: string }[] = [
  { id: "burn", name: "Burn vote", condition: "При прогонен праведен в една от първите три кръгли маси: единичен глас за друг кандидат в решаващия тур.", points: 0.47, experimental: false, source: frySource },
  { id: "banished", name: "Глас за прогонен предател", condition: "Глас за публично разкрит предател в решаващия тур на прогонването му.", points: 0.33, experimental: false, source: frySource },
  { id: "first", name: "Първи глас за този предател", condition: "Замества +0.33, ако режимът е включен и няма предходен глас за същия участник сред въведените завършени турове.", points: 0.40, experimental: true, source: parkerSource },
  { id: "other", name: "Глас за друг кандидат", condition: "Глас за друг кандидат в решаващия тур, когато прогоненият публично е разкрит като предател.", points: -1.28, experimental: false, source: frySource },
  { id: "history", name: "Предишен глас от предател", condition: "Еднократно за двойка участници при публично разкриване на прогонен предател. Зачитат се предходни кръгли маси и гласове след известно вербуване.", points: -1.69, experimental: false, source: frySource },
  { id: "breakfast", name: "Последна група с предател", condition: "Еднократно за двойка участници при публично разкриване на прогонен предател. Зачита се отбелязана последна група с известен реален ред, след известно вербуване.", points: -1.73, experimental: true, source: frySource },
];

export function baseline(): Model {
  return { firstVote: false, allowBroadcastBreakfast: false,
    rules: Object.fromEntries(rules.map(({ id, points }) => [id, { enabled: true, points }])) as Model["rules"] };
}

export function newSeason(title: string): Season {
  return { id: crypto.randomUUID(), title, initialTraitors: 3, model: baseline(), participants: [], episodes: [],
    privateRoles: [], hypothesis: { enabled: false, required: [], excluded: [], breakfastLimit: false } };
}
