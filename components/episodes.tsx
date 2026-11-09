"use client";
import { useState } from "react";
import { CalendarDays, Check, Coffee, Gavel, Plus, UserMinus } from "lucide-react";
import { freshEpisode } from "../lib/model";
import type { Episode, Season } from "../lib/types";
import { Breakfasts, Voting } from "./events";
import { EpisodeDetails, EpisodeOutcomes, type EditEpisode } from "./records";
import { Empty, Heading, Panel } from "./ui";

const sections = [
  { key: "outcomes", title: "Отпадане и роли", icon: UserMinus },
  { key: "breakfast", title: "Закуска", icon: Coffee },
  { key: "votes", title: "Кръгла маса", icon: Gavel },
] as const;

export function Episodes({ season, selected, setNumber, edit }: {
  season: Season; selected: number; setNumber: (n: number) => void; edit: EditEpisode;
}) {
  const latest = Math.max(0, ...season.episodes.map(e => e.number));
  const number = selected || latest || 1;
  const episode = season.episodes.find(e => e.number === number);
  const slots = Array.from({ length: Math.min(999, Math.max(12, latest + 1, number)) }, (_, index) => index + 1);
  const [section, setSection] = useState<(typeof sections)[number]["key"]>("outcomes");


  function choose(n: number) {
    setNumber(n);
    setSection("outcomes");
  }
  return <>
    <Heading title="Епизоди" description="Избери епизод и отбележи събитията, които участват в изчисленията."/>
    <Panel title="Избери епизод" tag={season.episodes.length + " записани"}>
      <div className="episode-grid">{slots.map(n => {
        const exists = season.episodes.some(e => e.number === n);
        return <button className={n === number ? "selected" : ""} key={n} aria-pressed={n === number}
          aria-label={"Епизод " + n + (exists ? ", записан" : ", нов")} onClick={() => choose(n)}>
          <span>{n}</span>{exists ? <Check size={13}/> : <Plus size={13}/>}
        </button>;
      })}</div>
    </Panel>
    {!episode ? <Panel title={"Епизод " + number}>
      <Empty icon={CalendarDays} title="Епизодът още няма запис" detail="Започни го, когато имаш информация за въвеждане.">
        <button className="primary" onClick={() => edit(freshEpisode(number))}><Plus size={16}/> Започни епизода</button>
      </Empty>
    </Panel> : <>
      <div className="episode-section stack">
        <div className="split"><h2>Епизод {number}</h2>{episode.date && <span className="muted">{episode.date}</span>}</div>
        <div className="toolbar" aria-label="Събития в епизода">
          {sections.map(s => <button className={section === s.key ? "selected" : ""} key={s.key}
            aria-pressed={section === s.key} onClick={() => setSection(s.key)}>
            <s.icon size={16}/>{s.title}
            <span className="muted">{s.key === "votes" ? episode.tables.length : s.key === "breakfast" ? episode.breakfasts.length : episode.exits.length + episode.facts.length}</span>
          </button>)}
        </div>
      </div>
      {section === "outcomes" && <EpisodeOutcomes key={episode.id} season={season} episode={episode} edit={edit}/>}
      {section === "breakfast" && <Breakfasts key={episode.id} season={season} episode={episode} edit={edit}/>}
      {section === "votes" && <Voting key={episode.id} season={season} episode={episode} edit={edit}/>}
      <details className="panel"><summary>Дата и бележки (по избор)</summary>
        <EpisodeDetails key={JSON.stringify([episode.id,episode.date,episode.notes,episode.events])} episode={episode} save={edit}/>
      </details>
    </>}
  </>;
}
