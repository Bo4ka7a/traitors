"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Coffee, Gavel, GripVertical, Plus, Trash2 } from "lucide-react";
import { filled, leaders, statusAt, tallies } from "../lib/model";
import type { Ballot, Breakfast, Episode, Participant, Round, Season, Table } from "../lib/types";
import { VoteChart } from "./charts";
import type { EditEpisode } from "./records";
import { Empty, Field, Heading, Panel, PersonSelect, PickPeople, RoleSelect } from "./ui";

type Props = { season: Season; episode: Episode; edit: EditEpisode };
const uid = () => crypto.randomUUID();

export function Voting({ season, episode, edit }: Props) {
  function newRound(tableId?: string, previous?: Round): Round {
    const ids = season.participants.filter(p => p.joined <= episode.number &&
      statusAt(season, p.id, episode.number, tableId ?? "new-table").status === "active").map(p => p.id);
    return { id: uid(), eligible: previous?.eligible ?? ids, candidates: previous?.candidates ?? ids, votes: {}, complete: false, notes: "" };
  }
  function saveTable(value: Table) {
    return edit({ ...episode, tables: episode.tables.some(t => t.id === value.id) ?
      episode.tables.map(t => t.id === value.id ? value : t) : [...episode.tables, value] });
  }
  return <>
    <Heading title="Кръгла маса" description="Записвайте гласовете, отделните турове и потвърденото прогонване."
      action={<button className="primary" onClick={() => saveTable({ id: uid(), rounds: [newRound()], decision: null })}><Plus size={18}/> Добави кръгла маса</button>}/>
    {!episode.tables.length && <Panel title="Гласувания"><Empty icon={Gavel} title="Няма кръгла маса" detail="Добавете запис само ако в епизода е имало кръгла маса."/></Panel>}
    {episode.tables.map((table, i) => {
      const people = season.participants.filter(p => p.joined <= episode.number && statusAt(season, p.id, episode.number, table.id).status === "active");
      return <Panel key={table.id} title={"Кръгла маса " + (i+1)} tag={table.decision ? "Потвърдена" : "Чернова"}>
        <TableEditor table={table} people={people} save={saveTable} addRound={r => newRound(table.id, r)} remove={() => {
          if (window.confirm("Да премахна ли кръглата маса и гласовете в нея?")) void edit({ ...episode, tables: episode.tables.filter(t => t.id !== table.id) });
        }}/>
      </Panel>;
    })}
  </>;
}

function TableEditor({ table, people, save, addRound, remove }: {
  table: Table; people: Participant[]; save: (t: Table) => Promise<boolean>; addRound: (p?: Round) => Round; remove: () => void;
}) {
  const [roundId, setRoundId] = useState(table.decision?.roundId ?? table.rounds[0]?.id);
  const round = table.rounds.find(r => r.id === roundId) ?? table.rounds[0];
  function update(value: Round, clearDecision = false) {
    return save({ ...table, rounds: table.rounds.map(r => r.id === value.id ? value : r),
      decision: clearDecision && table.decision?.roundId === value.id ? null : table.decision });
  }
  return <>
    <div className="toolbar">
      {table.rounds.map((r,i) => <button type="button" key={r.id} className={r.id === round?.id ? "selected" : ""} onClick={() => setRoundId(r.id)}>Тур {i+1}{r.complete ? " ✓" : ""}</button>)}
      <button type="button" onClick={async () => { const next = addRound(round); if (await save({ ...table, rounds: [...table.rounds,next] })) setRoundId(next.id); }}><Plus size={16}/> Нов тур</button>
      <button type="button" className="danger-button" onClick={remove}><Trash2 size={16}/> Премахни масата</button>
    </div>
    {round && <RoundEditor key={round.id} round={round} people={people} save={update}
      remove={table.rounds.length > 1 && (() => {
        if (window.confirm("Да премахна ли този тур?")) void save({ ...table, rounds: table.rounds.filter(r => r.id !== round.id),
          decision: table.decision?.roundId === round.id ? null : table.decision });
      })}/>}
    <Decision key={JSON.stringify([round?.id, round?.complete, table.decision])} table={table} round={round} people={people} save={save}/>
  </>;
}
function RoundEditor({ round, people, save, remove }: {
  round: Round; people: Participant[]; save: (r: Round, clearDecision?: boolean) => Promise<boolean>; remove: false | (() => void);
}) {
  const name = (id: string) => people.find(p => p.id === id)?.name ?? id;
  const counts = tallies(round);
  const candidates = people.filter(p => round.candidates.includes(p.id));
  const suggested = leaders(round);
  const [config, setConfig] = useState(false);
  function setVote(voter: string, value: string) {
    const votes = { ...round.votes };
    if (!value) delete votes[voter];
    else if (value === "_none") votes[voter] = { target: null, revealed: null, cast: null };
    else {
      const used = new Set(Object.values(votes).map(v => v.revealed));
      let next = 1;
      while (used.has(next)) next++;
      votes[voter] = { target: value, revealed: votes[voter]?.revealed ?? next, cast: votes[voter]?.cast ?? null };
    }
    void save({ ...round, votes });
  }
  function voteOrder(voter: string, key: "revealed" | "cast", order: number | null) {
    const votes = { ...round.votes };
    const old = votes[voter][key];
    const swap = Object.keys(votes).find(id => id !== voter && order !== null && votes[id][key] === order);
    if (swap) votes[swap] = { ...votes[swap], [key]: old };
    votes[voter] = { ...votes[voter], [key]: order };
    return save({ ...round, votes });
  }
  return <div className="stack record">
    <div className="toolbar"><span className="tag">{round.complete ? "Завършен тур" : "Тур в процес"}</span>
      <span className="muted">{Object.keys(round.votes).length} / {round.eligible.length} записа</span>
      <button type="button" onClick={() => setConfig(!config)}>Състав и ред на гласуване</button>
      {remove && <button type="button" onClick={remove}>Премахни тура</button>}
    </div>
    {config && <div className="stack inset">
      <strong>Право на глас</strong><PickPeople people={people} values={round.eligible} change={eligible =>
        void save({ ...round, eligible, complete: false, votes: Object.fromEntries(Object.entries(round.votes).filter(([id]) => eligible.includes(id))) }, true)}/>
      <strong>Допустими кандидати</strong><PickPeople people={people} values={round.candidates} change={candidates =>
        void save({ ...round, candidates, complete: false, votes: Object.fromEntries(Object.entries(round.votes).filter(([,v]) => !v.target || candidates.includes(v.target))) }, true)}/>
      <Field label="Правила / бележки за тура"><BlurText key={round.notes} value={round.notes} save={notes => save({ ...round, notes })}/></Field>
    </div>}
    {config && <p className="muted">Редът по телевизията се попълва по реда на въвеждане. Попълни реалния ред, ако е известен.</p>}
    {round.eligible.length ? <div className="table-wrap"><table className={config ? undefined : "simple-vote-table"}>
      <thead><tr><th>Гласуващ</th><th>За кого гласува?</th>{config && <><th>Ред по ТВ</th><th>Реален ред</th></>}</tr></thead>
      <tbody>{round.eligible.map(voter => {
        const vote: Ballot | undefined = round.votes[voter];
        return <tr key={voter}><td>{name(voter)}</td><td><select aria-label={"Глас на " + name(voter)} value={vote ? vote.target ?? "_none" : ""} disabled={round.complete} onChange={e => setVote(voter,e.target.value)}>
          <option value="">Невъведен</option><option value="_none">Не е гласувал(а)</option>
          {candidates.filter(p => p.id !== voter).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></td>{config && (["revealed","cast"] as const).map(key => <td key={key}><OrderField key={String(vote?.[key])} value={vote?.[key] ?? null} disabled={!vote?.target} required={key === "revealed" && !!vote?.target}
          label={(key === "cast" ? "Реален ред на " : "Ред по ТВ на ") + name(voter)} save={value => voteOrder(voter,key,value)}/></td>)}</tr>;
      })}</tbody>
    </table></div> : <p className="muted">Изберете гласуващите от „Състав и ред на гласуване“.</p>}
    <div className="toolbar">
      {round.complete ? <button onClick={() => {
        if (window.confirm("Да отворя ли тура за редакция? Ако е решаващ, прогонването ще трябва да се потвърди отново.")) void save({ ...round, complete: false }, true);
      }}>Отвори за редакция</button> : <button className="primary" disabled={!filled(round)} onClick={() => save({ ...round, complete: true })}>Завърши тура</button>}
      {suggested.length === 1 && <span className="tag">Предложение: {name(suggested[0])}</span>}
      {suggested.length > 1 && <span className="tag">Равенство: {suggested.map(name).join(", ")}</span>}
    </div>
    {!!Object.keys(counts).length && <><div className="toolbar">{Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([id,n]) => <span className="tag" key={id}>{name(id)} · {n}</span>)}</div><VoteChart data={Object.entries(counts).map(([id,votes]) => ({ name: name(id), votes }))}/></>}
  </div>;
}

function Decision({ table, round, people, save }: { table: Table; round?: Round; people: Participant[]; save: (t: Table) => Promise<boolean> }) {
  const suggestion = round ? leaders(round) : [];
  const saved = table.decision;
  const current = saved?.roundId === round?.id ? saved : null;
  const [person, setPerson] = useState(current?.player ?? (suggestion.length === 1 ? suggestion[0] : ""));
  const [role, setRole] = useState<"" | "faithful" | "traitor">(current?.role ?? "");
  const [reason, setReason] = useState(current?.reason ?? "");
  if (!round?.complete) return <p className="muted">Завършете решаващия тур, за да потвърдите прогонването.</p>;
  const custom = suggestion.length !== 1 || suggestion[0] !== person;
  return <form className="record stack" onSubmit={e => {
    e.preventDefault();
    if (person && (!custom || reason.trim())) void save({ ...table, decision: { roundId: round.id, player: person, role: role || null, reason } });
  }}>
    <strong>Прогонване</strong>
    <div className="fields">
      <Field label="Прогонен участник"><PersonSelect people={people} value={person} change={setPerson} label="Прогонен участник"/></Field>
      <Field label="Публично разкрита роля"><RoleSelect value={role} change={setRole}/></Field>
      {custom && <Field label="Основание за решението"><select value={reason} onChange={e => setReason(e.target.value)}>
        <option value="">Избери основание</option>
        <option value="Решение след равенство">Решение след равенство</option>
        <option value="Специално правило">Специално правило</option>
        {current?.reason && !["Решение след равенство","Специално правило"].includes(current.reason) && <option value={current.reason}>{current.reason}</option>}
      </select></Field>}
    </div>
    <div className="toolbar"><button type="submit" className="primary" disabled={!person || (custom && !reason.trim())}>{current ? "Запази прогонването" : "Потвърди прогонването"}</button>
      {saved && <button type="button" onClick={() => save({ ...table, decision: null })}>Отмени потвърждението</button>}</div>
  </form>;
}
function OrderField({ value, label, disabled, required, save }: { value: number | null; label: string; disabled: boolean; required: boolean; save: (n: number | null) => Promise<boolean> }) {
  const [draft, set] = useState(value?.toString() ?? "");
  return <input className="order" type="number" min={1} max={999} step={1} aria-label={label} placeholder="—" value={draft} disabled={disabled} required={required}
    onChange={e => set(e.target.value)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
    onBlur={async e => {
      const next = draft ? Number(draft) : null;
      if (next !== value && (!e.currentTarget.validity.valid || !(await save(next)))) set(value?.toString() ?? "");
    }}/>;
}
function BlurText({ value, save }: { value: string; save: (v: string) => Promise<boolean> }) {
  const [draft, set] = useState(value);
  return <textarea value={draft} maxLength={8000} onChange={e => set(e.target.value)}
    onBlur={async () => { if (draft !== value && !(await save(draft))) set(value); }}/>;
}

export function Breakfasts({ season, episode, edit }: Props) {
  function save(value: Breakfast) {
    return edit({ ...episode!, breakfasts: episode.breakfasts.some(b => b.id === value.id) ?
      episode.breakfasts.map(b => b.id === value.id ? value : b) : [...episode.breakfasts,value] });
  }
  return <>
    <Heading title="Закуска" description="Избери кой е влязъл в последната група и откъде е известен редът."
      action={<button className="primary" onClick={() => save({ id: uid(), groups: [], last: null, order: "unknown", notes: "" })}><Plus size={18}/> Добави закуска</button>}/>
    {!episode.breakfasts.length && <Panel title="Пристигания"><Empty icon={Coffee} title="Няма запис за закуска" detail="Добавете закуска, ако има наблюдение в този епизод."/></Panel>}
    {episode.breakfasts.map((b,i) => <Panel key={b.id} title={"Закуска " + (i+1)}>
      <BreakfastControls value={b} people={season.participants.filter(p => p.joined <= episode.number && statusAt(season, p.id, episode.number-1).status === "active")}
        save={save} remove={() => {
          if (window.confirm("Да премахна ли закуската?")) void edit({ ...episode, breakfasts: episode.breakfasts.filter(x => x.id !== b.id) });
        }}/>
    </Panel>)}
  </>;
}
function BreakfastControls({ value, people, save, remove }: { value: Breakfast; people: Participant[]; save: (b: Breakfast) => Promise<boolean>; remove: () => void }) {
  return <>
    <LastBreakfastGroup key={JSON.stringify([value.last, value.order, value.groups])} value={value} people={people} save={save}/>
    <details className="inset stack"><summary>Всички групи и подробности</summary>
      <BreakfastEditor value={value} people={people} save={save} remove={remove}/>
    </details>
  </>;
}
function LastBreakfastGroup({ value, people, save }: { value: Breakfast; people: Participant[]; save: (b: Breakfast) => Promise<boolean> }) {
  const existing = value.groups.find(g => g.id === value.last);
  const [picked, setPicked] = useState(existing?.people ?? []);
  const [order, setOrder] = useState(value.order);
  return <div className="stack">
    <strong>Последна група</strong>
    <PickPeople people={people} values={picked} change={setPicked}/>
    <Field label="Откъде е известен редът"><select value={order} onChange={e => setOrder(e.target.value as Breakfast["order"])}>
      <option value="unknown">Неизвестен</option><option value="broadcast">Телевизионен монтаж</option><option value="actual">Потвърден реален ред</option>
    </select></Field>
    <p className="muted">По подразбиране само потвърденият реален ред участва в точкуването.</p>
    <div><button className="primary" disabled={!picked.length && !existing} onClick={() => {
      const last = picked.length ? existing?.id ?? uid() : null;
      const groups = value.groups.filter(g => g.id !== existing?.id)
        .map(g => ({ ...g, people: g.people.filter(id => !picked.includes(id)) }));
      if (last) groups.push({ id: last, people: picked });
      void save({ ...value, groups, last, order });
    }}>Запази последната група</button></div>
  </div>;
}

function BreakfastEditor({ value, people, save, remove }: { value: Breakfast; people: Participant[]; save: (b: Breakfast) => Promise<boolean>; remove: () => void }) {
  const placed = value.groups.flatMap(g => g.people);
  const unplaced = people.filter(p => !placed.includes(p.id));
  const name = (id: string) => people.find(p => p.id === id)?.name ?? id;
  function moveGroup(from: number, to: number) {
    if (from < 0 || to < 0 || from === to || to >= value.groups.length) return;
    const groups = [...value.groups];
    groups.splice(to, 0, groups.splice(from, 1)[0]);
    void save({ ...value, groups, last: value.last && groups.at(-1)?.id === value.last ? value.last : null });
  }
  function movePerson(id: string, groupId: string) {
    if (!people.some(p => p.id === id)) return;
    const groups = value.groups.map(g => ({ ...g, people: g.id === groupId ? [...g.people.filter(p => p !== id),id] : g.people.filter(p => p !== id) }));
    void save({ ...value, groups, last: groups.find(g => g.id === value.last)?.people.length ? value.last : null });
  }
  return <div className="stack">
    <div className="fields">
      <Field label="Източник на реда"><select value={value.order} onChange={e => save({ ...value, order: e.target.value as Breakfast["order"] })}>
        <option value="unknown">Неизвестен ред</option><option value="broadcast">Телевизионен монтаж</option><option value="actual">Потвърден реален ред</option></select></Field>
      <Field label="Бележки"><BlurText key={value.notes} value={value.notes} save={notes => save({ ...value, notes })}/></Field>
    </div>
    <p className="muted">Плъзнете участник в група. За подреждане плъзнете дръжката на групата или използвайте стрелките. Последната група се отбелязва отделно.</p>
    <div className="chips" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); movePerson(e.dataTransfer.getData("person"),""); }}>
      <strong>Без група</strong>{unplaced.map(p => <span className="chip" draggable key={p.id} onDragStart={e => e.dataTransfer.setData("person",p.id)}>{p.name}</span>)}
    </div>
    <div className="groups">{value.groups.map((g,i) => <div className="inset stack" key={g.id} onDragOver={e => e.preventDefault()} onDrop={e => {
      e.preventDefault();
      const person = e.dataTransfer.getData("person"), group = e.dataTransfer.getData("group");
      if (person) movePerson(person,g.id);
      else if (group) moveGroup(value.groups.findIndex(x => x.id === group),i);
    }}>
      <div className="toolbar group-title"><span className="grip" draggable onDragStart={e => e.dataTransfer.setData("group",g.id)}><GripVertical size={17}/></span>
        <strong>Група {i+1}</strong>
        <button className="icon-button" aria-label={"Премести група " + (i+1) + " нагоре"} disabled={i === 0} onClick={() => moveGroup(i,i-1)}><ArrowUp size={15}/></button>
        <button className="icon-button" aria-label={"Премести група " + (i+1) + " надолу"} disabled={i === value.groups.length-1} onClick={() => moveGroup(i,i+1)}><ArrowDown size={15}/></button>
        <button className="icon-button" aria-label={"Премахни група " + (i+1)} onClick={() => save({ ...value, groups: value.groups.filter(x => x.id !== g.id), last: value.last === g.id ? null : value.last })}><Trash2 size={15}/></button>
      </div>
      <div className="chips">{g.people.map(id => <span className="chip" draggable key={id} onDragStart={e => e.dataTransfer.setData("person",id)}>{name(id)}
        <button aria-label={"Извади " + name(id) + " от групата"} onClick={() => movePerson(id,"")}>×</button></span>)}</div>
      <PersonSelect people={people.filter(p => !g.people.includes(p.id))} value="" change={id => movePerson(id,g.id)} label={"Добави към група " + (i+1)} placeholder="Добави или премести участник"/>
      <label className="check"><input type="checkbox" checked={value.last === g.id} disabled={!g.people.length || i !== value.groups.length-1}
        onChange={e => save({ ...value, last: e.target.checked ? g.id : null })}/> Последна пристигнала група</label>
    </div>)}</div>
    <div className="toolbar"><button onClick={() => save({ ...value, last: null, groups: [...value.groups,{ id: uid(), people: [] }] })}><Plus size={17}/> Добави група</button>
      <button className="danger-button" onClick={remove}><Trash2 size={17}/> Премахни закуската</button></div>
  </div>;
}
