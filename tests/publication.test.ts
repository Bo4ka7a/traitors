import assert from "node:assert/strict";
import test from "node:test";
import { freshEpisode } from "../lib/model";
import { makePublication, publicationSchema } from "../lib/publication";
import { newSeason } from "../lib/rules";

test("public projection contains only the selected episodes, standings and public display fields", () => {
  const season = newSeason("Сезон");
  season.participants = [
    { id: "a", name: "Участник A", photo: "https://example.test/private-photo", joined: 1 },
    { id: "b", name: "Бъдещ участник", photo: "", joined: 2 },
  ];
  season.episodes = [
    { ...freshEpisode(1), notes: "Частна бележка", events: "Чернова", date: "2026-11-09" },
    freshEpisode(2),
  ];
  season.privateRoles = [{ id: "role-a", player: "a", from: 1, role: "traitor" }];
  const result = makePublication(season, 1);
  assert.deepEqual(result, {
    version: 1,
    title: "Сезон",
    through: 1,
    episodes: [{ number: 1, date: "2026-11-09" }],
    participants: [{ name: "Участник A", status: "active", score: 0 }],
  });
  assert.throws(() => makePublication(season, 3));
  assert.equal(publicationSchema.safeParse({ ...result, privateRoles: season.privateRoles }).success, false);
});
