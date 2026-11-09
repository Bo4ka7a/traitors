import { z } from "zod";
import { episodesThrough, forecast, publicInput } from "./model";
import type { Season } from "./types";

const episodeNumber = z.number().int().min(1).max(999);
export const publicationSchema = z.strictObject({
  version: z.literal(1),
  title: z.string().min(1).max(120),
  through: episodeNumber,
  episodes: z.array(z.strictObject({ number: episodeNumber, date: z.union([z.literal(""), z.iso.date()]) })).min(1).max(999),
  participants: z.array(z.strictObject({
    name: z.string().min(1).max(120),
    status: z.enum(["active", "banished", "murdered", "left"]),
    score: z.number(),
  })).max(100),
});
export type Publication = z.infer<typeof publicationSchema>;

export function makePublication(season: Season, through: number): Publication {
  const episodes = episodesThrough(season, through);
  if (episodes.at(-1)?.number !== through) throw new Error("Изберете записан епизод.");
  return publicationSchema.parse({
    version: 1,
    title: season.title,
    through,
    episodes: episodes.map(({ number, date }) => ({ number, date })),
    participants: forecast(publicInput(season), through).map(({ name, status, score }) => ({ name, status, score })),
  });
}
