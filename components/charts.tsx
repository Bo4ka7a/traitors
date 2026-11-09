"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Participant } from "../lib/types";
import type { forecasts } from "../lib/model";
const colors = ["#d4ad68", "#dc778e", "#80bdb0", "#968ceb", "#df9f72", "#69b7d9", "#b7bd78", "#c17cd0"];
const tooltip = { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)" };

export function ScoreChart({ history, people }: { history: ReturnType<typeof forecasts>; people: Participant[] }) {
  const data = history.map(h => ({ episode: "Еп. " + h.number,
    ...Object.fromEntries(h.ranking.map(p => [p.id, p.score])) }));
  return <div className="chart" role="img" aria-label="Графика на резултатите по епизоди"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <LineChart data={data} margin={{ left: -20, right: 16, top: 8, bottom: 0 }}>
      <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4"/>
      <XAxis dataKey="episode" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false}/>
      <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false}/>
      <Tooltip contentStyle={tooltip}/><Legend wrapperStyle={{ fontSize: 12 }}/>
      {people.map((p, i) => <Line key={p.id} type="linear" dataKey={p.id} name={p.name} stroke={colors[i % colors.length]}
        strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}/>)}
    </LineChart>
  </ResponsiveContainer></div>;
}
export function VoteChart({ data }: { data: { name: string; votes: number }[] }) {
  return <div className="chart short" role="img" aria-label="Графика на получените гласове"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <BarChart data={data} margin={{ left: -24, right: 8, top: 8 }}>
      <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 4"/>
      <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }}/>
      <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }}/>
      <Tooltip contentStyle={tooltip}/><Bar dataKey="votes" name="Гласове" fill="#ad5c71" radius={[5,5,0,0]} isAnimationActive={false}/>
    </BarChart>
  </ResponsiveContainer></div>;
}
