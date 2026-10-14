import { z } from "zod";
import { nearbySchema } from "./types";

export const STORAGE_KEY = "geobusiness.analyses.v1";
export const savedAnalysisSchema = z.object({
  id: z.string().min(1), name: z.string().trim().min(1).max(80),
  savedAt: z.string().datetime({ offset: true }), result: nearbySchema,
});
export type SavedAnalysis = z.infer<typeof savedAnalysisSchema>;
const envelope = z.object({ version: z.literal(1), analyses: z.array(savedAnalysisSchema).max(10) });
export function readAnalyses(raw: string | null): SavedAnalysis[] {
  if (!raw) return [];
  return envelope.parse(JSON.parse(raw)).analyses;
}
export function writeAnalyses(analyses: SavedAnalysis[]): string {
  return JSON.stringify(envelope.parse({ version: 1, analyses }));
}
export function canCompare(analyses: SavedAnalysis[]): boolean {
  return analyses.length >= 2 && analyses.length <= 3 &&
    analyses.every(a => a.result.radius_m === analyses[0].result.radius_m && a.result.region === analyses[0].result.region);
}
