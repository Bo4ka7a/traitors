"use client";
import { useState } from "react";
import { Plus, Users, Pencil, Trash2, LockKeyhole } from "lucide-react";
import { episodesThrough, publicFacts, statusAt } from "../lib/model";
import { roleNames, statusNames, type Episode, type Participant, type PublicFact, type Exit, type RolePeriod, type Season } from "../lib/types";
import { Avatar, Empty, Field, Heading, Panel, PersonSelect, RoleSelect, type SaveSeason } from "./ui";

export function EpisodePicker({ season, number, change }: { season: Season; number: number; change: (n: number) => void }) {
  return <select aria-label="Избран епизод" value={number || ""} onChange={e => change(Number(e.target.value))}>
    {!season.episodes.length && <option value="">Няма епизоди</option>}
    {episodesThrough(season).reverse().map(e => <option key={e.id} value={e.number}>Епизод {e.number}</option>)}
  </select>;
}
export type EditEpisode = (episode: Episode) => Promise<boolean>;

export function EpisodeOutcomes({ season, episode, edit }: { season: Season; episode: Episode; edit: EditEpisode }) {
  return (
      <div className="two">
        <Panel title="Убийства и напускания">
          {episode.exits.map(x => <ExitForm key={JSON.stringify(x)} value={x} season={season} episode={episode}
            submit={row => edit({ ...episode, exits: episode.exits.map(old => old.id === row.id ? row : old) })}
            remove={() => edit({ ...episode, exits: episode.exits.filter(old => old.id !== x.id) })}/>)}
          <ExitForm key={"new-exit-" + episode.id} season={season} episode={episode} submit={row => edit({ ...episode, exits: [...episode.exits,row] })}/>
        </Panel>
        <Panel title="Публични разкрития и вербуване">
          <p className="muted">Епизодът на наблюдение е текущият. Посочете за кой епизод важи ролята.</p>
          {episode.facts.map(x => <FactForm key={JSON.stringify(x)} value={x} people={season.participants} number={episode.number}
            submit={row => edit({ ...episode, facts: episode.facts.map(old => old.id === row.id ? row : old) })}
            remove={() => edit({ ...episode, facts: episode.facts.filter(old => old.id !== x.id) })}/>)}
          <FactForm key={"new-fact-" + episode.id} people={season.participants} number={episode.number}
            submit={row => edit({ ...episode, facts: [...episode.facts,row] })}/>
        </Panel>
      </div>
  );
}

export function EpisodeDetails({ episode, save }: { episode: Episode; save: EditEpisode }) {
  const [draft, set] = useState(episode);
  return <form className="stack" onSubmit={e => { e.preventDefault(); void save({ ...episode, date: draft.date, notes: draft.notes, events: draft.events }); }}>
    <Field label="Дата на излъчване"><input type="date" value={draft.date} onChange={e => set({ ...draft, date: e.target.value })}/></Field>
    <Field label="Бележки"><textarea value={draft.notes} maxLength={8000} onChange={e => set({ ...draft, notes: e.target.value })}/></Field>
    <Field label="Допълнителни събития"><textarea value={draft.events} maxLength={8000} onChange={e => set({ ...draft, events: e.target.value })}/></Field>
    <div><button type="submit">Запази подробностите</button></div>
  </form>;
}

function ExitForm({ value, season, episode, submit, remove }: { value?: Exit; season: Season; episode: Episode; submit: (x: Exit) => Promise<boolean>; remove?: () => Promise<boolean> }) {
  const [draft, set] = useState<Exit>(value ?? { id: "", player: "", method: "murdered", timing: "before", role: null, notes: "" });
  const people = season.participants.filter(p => p.joined <= episode.number && (p.id === value?.player || statusAt(season, p.id, episode.number).status === "active"));
  return <form className="record stack" onSubmit={async e => {
    e.preventDefault(); if (!draft.player) return;
    if (await submit({ ...draft, id: draft.id || crypto.randomUUID() }) && !value) set({ id: "", player: "", method: "murdered", timing: "before", role: null, notes: "" });
  }}>
    <div className="fields"><PersonSelect people={people} label="Напуснал участник" value={draft.player} change={player => set({ ...draft, player })}/>
      <select aria-label="Метод на напускане" value={draft.method} onChange={e => set({ ...draft, method: e.target.value as Exit["method"] })}><option value="murdered">Убит</option><option value="left">Напуснал</option></select>
      <select aria-label="Момент на напускане" value={draft.timing} onChange={e => set({ ...draft, timing: e.target.value as Exit["timing"] })}><option value="before">Преди кръглите маси</option><option value="after">След кръглите маси</option></select>
      <RoleSelect value={draft.role ?? ""} change={role => set({ ...draft, role: role || null })}/></div>

    <div className="toolbar"><button type="submit" disabled={!draft.player}>{value ? "Запази" : "Добави напускане"}</button>{remove && <button type="button" onClick={remove}>Премахни</button>}</div>
  </form>;
}
function FactForm({ value, people, number, submit, remove }: { value?: PublicFact; people: Participant[]; number: number; submit: (x: PublicFact) => Promise<boolean>; remove?: () => Promise<boolean> }) {
  const initial: Omit<PublicFact, "role"> & { role: PublicFact["role"] | "" } =
    { id: "", player: "", role: "", kind: "confirmation", from: number };
  const [draft, set] = useState(value ?? initial);
  return <form className="record stack" onSubmit={async e => {
    e.preventDefault(); if (!draft.player || !draft.role) return;
    if (await submit({ ...draft, role: draft.role, id: draft.id || crypto.randomUUID() }) && !value) set(initial);
  }}>
    <div className="fields"><PersonSelect people={people.filter(p => p.joined <= number)} label="Участник с публична роля" value={draft.player} change={player => set({ ...draft, player, from: Math.max(draft.from, people.find(p => p.id === player)?.joined ?? 1) })}/>
      <select aria-label="Вид на публичния факт" value={draft.kind} onChange={e => set({ ...draft, kind: e.target.value as PublicFact["kind"], role: e.target.value === "recruitment" ? "traitor" : value?.role ?? "" })}>
        <option value="confirmation">Потвърждение</option><option value="recruitment">Вербуване</option></select>
      {draft.kind !== "recruitment" && <RoleSelect value={draft.role} change={role => set({ ...draft, role })}/>}
      <Field label="Роля от епизод"><select value={draft.from} onChange={e => set({ ...draft, from: Number(e.target.value) })}>
        {Array.from({ length: number }, (_, i) => <option key={i+1} value={i+1} disabled={i+1 < (people.find(p => p.id === draft.player)?.joined ?? 1)}>Епизод {i+1}</option>)}
      </select></Field>
    </div>
    <div className="toolbar"><button type="submit" disabled={!draft.player || !draft.role}>{value ? "Запази" : "Добави публичен факт"}</button>{remove && <button type="button" onClick={remove}>Премахни</button>}</div>
  </form>;
}

export function Participants({ season, save, open, number }: { season: Season; save: SaveSeason; open: (id: string) => void; number: number }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const facts = publicFacts(season, number);
  function remove(id: string) {
    if (!window.confirm("Да премахна ли участника? Записаните събития трябва първо да бъдат редактирани, ако го включват.")) return;
    void save({ ...season, participants: season.participants.filter(p => p.id !== id), privateRoles: season.privateRoles.filter(r => r.player !== id),
      hypothesis: { ...season.hypothesis, required: season.hypothesis.required.filter(x => x !== id), excluded: season.hypothesis.excluded.filter(x => x !== id) } });
  }
  const selected = season.participants.find(p => p.id === editing);
  return <>
    <Heading title="Участници" description="Състав, публични роли и история по епизоди." action={<button className="primary" onClick={() => setEditing("")}><Plus size={18}/> Добави участник</button>}/>
    {editing !== null && <Panel title={selected ? "Редакция на участник" : "Нов участник"}><ParticipantForm key={editing} value={selected} close={() => setEditing(null)} submit={async p => {
      const participants = selected ? season.participants.map(old => old.id === p.id ? p : old) : [...season.participants,p];
      if (await save({ ...season, participants })) setEditing(null);
    }}/></Panel>}
    <Panel title="Регистър" tag={String(season.participants.length)}>
      {!season.participants.length ? <Empty icon={Users} title="Съставът е празен" detail="Добавете имената на участниците, за да започнете."/> :
        <div className="table-wrap"><table><thead><tr><th>Участник</th><th>Статус</th><th>Публична роля</th><th>Отпадане</th><th>Действия</th></tr></thead>
        <tbody>{season.participants.map(p => {
          const status = statusAt(season, p.id, number);
          const fact = facts.filter(f => f.player === p.id).sort((a,b) => b.from-a.from || b.observed-a.observed)[0];
          return <tr key={p.id}><td><button className="person" onClick={() => open(p.id)}><Avatar person={p}/>{p.name}</button></td>
            <td><span className="tag">{p.joined > number ? "Още не участва" : statusNames[status.status]}</span></td><td>{fact ? roleNames[fact.role] : "—"}</td>
            <td>{status.episode ? "Еп. " + status.episode : "—"}</td><td><div className="toolbar">
              <button className="icon-button" aria-label={"Редактирай " + p.name} onClick={() => setEditing(p.id)}><Pencil size={16}/></button>
              <button className="icon-button" aria-label={"Премахни " + p.name} onClick={() => remove(p.id)}><Trash2 size={16}/></button>
            </div></td></tr>;
        })}</tbody></table></div>}
    </Panel>
    <Panel title="Разкриване на ролите"><div className="toolbar"><button onClick={() => setReveal(!reveal)}><LockKeyhole size={16}/>{reveal ? "Скрий тайните роли" : "Покажи тайните роли"}</button><span className="muted">Ролите тук се използват за проверка на модела.</span></div>
      {reveal && <div className="stack">{season.privateRoles.map(r => <RoleForm key={JSON.stringify(r)} people={season.participants} value={r}
        submit={row => save({ ...season, privateRoles: season.privateRoles.map(old => old.id === row.id ? row : old) })}
        remove={() => save({ ...season, privateRoles: season.privateRoles.filter(old => old.id !== r.id) })}/>)}
        <RoleForm people={season.participants} submit={row => save({ ...season, privateRoles: [...season.privateRoles,row] })}/></div>}
    </Panel>
  </>;
}
function ParticipantForm({ value, close, submit }: { value?: Participant; close: () => void; submit: (p: Participant) => Promise<void> }) {
  const [draft, set] = useState<Participant>(value ?? { id: "", name: "", photo: "", joined: 1 });
  return <form className="stack" onSubmit={e => { e.preventDefault(); void submit({ ...draft, id: draft.id || crypto.randomUUID() }); }}>
    <div className="fields">
      <Field label="Име"><input required value={draft.name} maxLength={120} onChange={e => set({ ...draft, name: e.target.value })}/></Field>
      <Field label="Снимка (URL по избор)"><input type="url" value={draft.photo} maxLength={1000} onChange={e => set({ ...draft, photo: e.target.value })}/></Field>
      <Field label="Участва от епизод"><input type="number" required min={1} max={999} value={draft.joined || ""} onChange={e => set({ ...draft, joined: Number(e.target.value) })}/></Field>
    </div>
    <div className="toolbar"><button className="primary" type="submit">Запази участника</button><button type="button" onClick={close}>Отказ</button></div>
  </form>;
}
function RoleForm({ value, people, submit, remove }: { value?: RolePeriod; people: Participant[]; submit: (r: RolePeriod) => Promise<boolean>; remove?: () => Promise<boolean> }) {
  const initial: RolePeriod = { id: "", player: "", role: "faithful", from: 1 };
  const [draft, set] = useState(value ?? initial);
  return <form className="record toolbar" onSubmit={async e => {
    e.preventDefault(); if (!draft.player || !draft.role) return;
    if (await submit({ ...draft, role: draft.role, id: draft.id || crypto.randomUUID() }) && !value) set(initial);
  }}>
    <PersonSelect people={people} value={draft.player} change={player => set({ ...draft, player })} label="Участник с тайна роля"/>
    <RoleSelect value={draft.role} label="Действителна роля" change={role => { if (role) set({ ...draft, role }); }}/>
    <Field label="Роля от епизод"><input type="number" required min={1} max={999} value={draft.from || ""} onChange={e => set({ ...draft, from: Number(e.target.value) })}/></Field>
    <button type="submit" disabled={!draft.player}>{value ? "Запази" : "Добави период"}</button>{remove && <button type="button" onClick={remove}>Премахни</button>}
  </form>;
}
