import assert from "node:assert/strict";
import test from "node:test";
import { addBtvCast } from "../lib/cast";
import { freshEpisode } from "../lib/model";
import { newSeason } from "../lib/rules";
import { validateSeason } from "../lib/validation";

test("the official season cast is complete and is saved without changing existing references", () => {
  const season = newSeason("България · Сезон 1");
  season.participants = [{ id: "existing", name: "Крис от „Молец“", photo: "", joined: 1 }];
  season.episodes = [{ ...freshEpisode(1), exits: [{ id: "exit", player: "existing", method: "left", timing: "after", role: null, notes: "" }] }];
  const seeded = validateSeason(addBtvCast(season));
  assert.equal(seeded.title, "България · Сезон 2");
  assert.equal(seeded.participants.length, 25);
  assert.equal(seeded.participants.find(p => p.id === "existing")?.name, "Крис от „Молец“");
  assert.ok(seeded.participants.some(p => p.name === "Георги Братоев"));
  assert.ok(seeded.participants.some(p => p.name === "Валентин Братоев"));
  assert.deepEqual(seeded.episodes, season.episodes);
  assert.equal(addBtvCast(seeded), seeded);
  assert.equal(seeded.privateRoles.length, 0);
});
