"use client";
import { useState } from "react";
import { Download, FileUp, Moon, Sun, Trash2 } from "lucide-react";
import { baseline, rules } from "../lib/rules";
import { backup, parseBackup } from "../lib/validation";
import type { Change } from "../lib/storage";
import type { Season } from "../lib/types";
import { Field, Heading, Panel, PickPeople, type SaveSeason } from "./ui";

export function Settings({ season, seasons, save, commit, select, light, theme, fail }: {
  season: Season; seasons: Season[]; save: SaveSeason; commit: (changes: Change[]) => Promise<boolean>;
  select: (id: string) => void; light: boolean; theme: () => void; fail: (s: string) => void;
}) {
  const [imported,setImported] = useState<Season[]>([]);
  const [reset,setReset] = useState("");
  function download() {
    const url = URL.createObjectURL(new Blob([backup(seasons.length ? seasons : [season])], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "traitors-analytics-" + new Date().toISOString().slice(0,10) + ".json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  return <>
    <Heading title="Настройки" description="Сезони, правила за точкуване, експерименти и резервни копия."
      action={<button onClick={theme}>{light ? <Moon size={17}/> : <Sun size={17}/>} {light ? "Тъмна тема" : "Светла тема"}</button>}/>
    <div className="two">
      <Panel title="Сезон">
        <div className="stack">
          <SettingsField key={season.id + season.title} label="Име на избрания сезон" value={season.title} save={title => save({ ...season,title })}/>
          <SettingsField key={season.id + season.initialTraitors} label="Начален брой предатели" type="number" min={0} max={100} value={String(season.initialTraitors)}
            save={value => save({ ...season, initialTraitors: Number(value) })}/>

        </div>
      </Panel>
      <Panel title="Режим на точкуване">
        <div className="stack">
          <Field label="Първи глас за прогонен предател"><select value={season.model.firstVote ? "first" : "standard"}
            onChange={e => save({ ...season, model: { ...season.model, firstVote: e.target.value === "first" } })}>
            <option value="standard">Стандартен (+0,33 по подразбиране)</option><option value="first">Отделна стойност за първи глас (+0,40)</option></select></Field>
          <label className="check"><input type="checkbox" checked={season.model.allowBroadcastBreakfast}
            onChange={e => save({ ...season, model: { ...season.model, allowBroadcastBreakfast: e.target.checked } })}/> Зачитай и телевизионния ред на закуска</label>
          <p className="muted">Смяната на режима преизчислява историята със същите публични факти към всеки епизод.</p>
          <div><button onClick={() => save({ ...season, model: baseline() })}>Възстанови базовия модел</button></div>
        </div>
      </Panel>
    </div>
    <Panel title="Правила за точкуване">
      <div className="stack">{rules.map(r => <div className="rule" key={r.id}>
        <div className="stack"><div className="toolbar"><b>{r.name}</b><span className="tag">{r.id}</span><span className="tag">{r.experimental ? "Експериментално" : "По модела на Fry"}</span></div>
          <p className="muted">{r.condition}</p><a href={r.source} target="_blank" rel="noreferrer">Първоизточник ↗</a></div>
        <div className="toolbar">
          <SettingsField key={String(season.model.rules[r.id].points)} label="Точки" type="number" min={-100} max={100} step="0.000001" value={String(season.model.rules[r.id].points)}
            save={points => save({ ...season, model: { ...season.model, rules: { ...season.model.rules, [r.id]: { ...season.model.rules[r.id], points: Number(points) } } } })}/>
          <label className="check"><input type="checkbox" checked={season.model.rules[r.id].enabled} onChange={e => save({
            ...season, model: { ...season.model, rules: { ...season.model.rules, [r.id]: { ...season.model.rules[r.id], enabled: e.target.checked } } },
          })}/> Активно</label>
        </div>
      </div>)}</div>
    </Panel>
    <Panel title="Експериментални хипотези">
      <div className="stack">
        <label className="check"><input type="checkbox" checked={season.hypothesis.enabled}
          onChange={e => save({ ...season, hypothesis: { ...season.hypothesis, enabled: e.target.checked } })}/> Покажи отделния сценарий</label>
        <label className="check"><input type="checkbox" checked={season.hypothesis.breakfastLimit}
          onChange={e => save({ ...season, hypothesis: { ...season.hypothesis, breakfastLimit: e.target.checked } })}/> Най-много един предател в последната потвърдена последна група</label>
        <strong>Предполагаеми начални предатели</strong>
        <PickPeople people={season.participants.filter(p => p.joined === 1)} values={season.hypothesis.required}
          change={required => save({ ...season, hypothesis: { ...season.hypothesis, required } })}/>
        <strong>Изключени като начални предатели</strong>
        <PickPeople people={season.participants.filter(p => p.joined === 1)} values={season.hypothesis.excluded}
          change={excluded => save({ ...season, hypothesis: { ...season.hypothesis, excluded } })}/>
      </div>
    </Panel>
    <Panel title="Резервни копия" tag="JSON · v1">
      <p className="muted">Архивът включва всички сезони и въведените тайни роли. Възстановяването създава отделни копия с нови идентификатори.</p>
      <div className="toolbar">
        <button onClick={download}><Download size={17}/> Експорт на всички сезони</button>
        <label className="upload"><FileUp size={17}/> Преглед на архив<input type="file" accept=".json,application/json" onChange={async e => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          setImported([]);
          if (!file) return;
          try {
            if (file.size > 20_000_000) throw new Error("Резервното копие е твърде голямо.");
            setImported(parseBackup(await file.text())); fail("");
          } catch (e) { fail("Невалиден архив. " + (e as Error).message); }
        }}/></label>
      </div>
      {!!imported.length && <div className="inset stack">
        <b>За възстановяване · {imported.length} сезона</b>
        <p>{imported.map(s => s.title).join(", ")}</p>
        <div className="toolbar"><button className="primary" onClick={async () => {
          const changes = imported.map(s => ({ after: { ...s, id: crypto.randomUUID(), title: s.title.slice(0,108) + " (копие)" } }));
          if (await commit(changes)) { select(changes[0].after.id); setImported([]); }
        }}>Възстанови като нови сезони</button><button onClick={() => setImported([])}>Отказ</button></div>
      </div>}
    </Panel>
    {!!seasons.length && <Panel title="Изчистване на данните">
      <p className="muted">За да изтриете всички сезони в това хранилище, напишете ИЗТРИЙ и потвърдете.</p>
      <div className="toolbar"><input value={reset} aria-label="Потвърждение за изтриване" placeholder="ИЗТРИЙ" onChange={e => setReset(e.target.value)}/>
        <button className="danger-button" disabled={reset !== "ИЗТРИЙ"} onClick={async () => {
          if (window.confirm("Да изтрия ли всички сезони и техните записи?") && await commit(seasons.map(before => ({ before })))) setReset("");
        }}><Trash2 size={17}/> Изтрий всички сезони</button></div>
    </Panel>}
  </>;
}
function SettingsField({ label, value, type = "text", min, max, step, save }: {
  label: string; value: string; type?: "text" | "number"; min?: number; max?: number; step?: string; save: (value: string) => Promise<boolean>;
}) {
  const [draft,set] = useState(value);
  return <Field label={label}><input type={type} required maxLength={120} min={min} max={max} step={step} value={draft}
    onChange={e => set(e.target.value)} onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
    onBlur={async e => { if (draft !== value && (!e.currentTarget.validity.valid || !(await save(draft)))) set(value); }}/></Field>;
}
