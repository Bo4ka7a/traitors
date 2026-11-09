import type { Participant, Season } from "./types";

export const btvCastSource = "https://www.btv.bg/shows/traitors/uchastnitsi/";
export const btvSeasonTitle = "България · Сезон 2";

const cast = [
  ["zhekova", "Александра Жекова"],
  ["shtereva", "Ваня Щерева"],
  ["v-bratoev", "Валентин Братоев"],
  ["mitsov", "Венци Мицов", "Венцислав Мицов"],
  ["g-bratoev", "Георги Братоев"],
  ["varbanov", "Даниел Върбанов", "Дани Върбанов"],
  ["velkova", "Денислава Велкова"],
  ["konrad", "Емил Конрад"],
  ["markov", "Емил Марков"],
  ["krachunov", "Йордан Крачунов"],
  ["kostova", "Кристина Костова", "Кристин Костова"],
  ["makarov", "Кристиян Макаров", "Крис Макаров", "Крис от Молец", "Крис от „Молец“"],
  ["chakardakova", "Мария Чакърдъкова"],
  ["keremedchiev", "Милен Керемедчиев"],
  ["mihova", "Мила Михова"],
  ["zinoviev", "Михаела Зиновиев"],
  ["karaboycheva", "Нанси Карабойчева"],
  ["shopov", "Наум Шопов"],
  ["bogdanov", "Неделчо Богданов"],
  ["modeva", "Олга Модева"],
  ["genova", "Поли Генова"],
  ["dyankova", "Симона Дянкова-Яначкова", "Симона Дянкова"],
  ["laleva", "Стефани Лалева"],
  ["doychev", "Стоян Дойчев"],
  ["minkova", "Теа Минкова", "Теа Шопова"],
] as const;

function nameKey(name: string) {
  return name.normalize("NFKC").toLocaleLowerCase("bg").replace(/[^\p{L}\p{N}]+/gu, "");
}

export function addBtvCast(season: Season): Season {
  if (season.castPreset === "btv-2026") return season;
  const knownNames = new Set(season.participants.map(p => nameKey(p.name)));
  const usedIds = new Set(season.participants.map(p => p.id));
  const added: Participant[] = [];
  for (const [slug, name, ...aliases] of cast) {
    if ([name, ...aliases].some(alias => knownNames.has(nameKey(alias)))) continue;
    const baseId = "btv-2026-" + slug;
    let id = baseId;
    let suffix = 1;
    while (usedIds.has(id)) id = baseId + "-" + suffix++;
    usedIds.add(id);
    added.push({ id, name, joined: 1, photo: "" });
  }
  return { ...season,
    title: season.title === "България · Сезон 1" ? btvSeasonTitle : season.title,
    participants: [...season.participants, ...added].sort((a,b) => a.name.localeCompare(b.name,"bg")),
    castPreset: "btv-2026",
  };
}
