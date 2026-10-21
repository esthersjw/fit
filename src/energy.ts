import type { AppData, Card, Category, Intensity } from './types'

/** Approximate MET values (2024 Adult Compendium: aerobic dance 5–8.8, cardio kickboxing 6–9.8), by type × intensity. */
const MET: Record<Category, Record<Intensity, number>> = {
  aerobic: { 1: 5.5, 2: 7.3, 3: 8.8 },
  boxing: { 1: 6, 2: 7.8, 3: 9.8 },
  strength: { 1: 3.5, 2: 5, 3: 6 },
  pilates: { 1: 3, 2: 4, 3: 5 },
  stretch: { 1: 2.3, 2: 2.3, 3: 2.3 },
  mind: { 1: 1.3, 2: 1.3, 3: 1.3 },
  walk: { 1: 4, 2: 5.3, 3: 6.5 },
}

export const DEFAULT_KG = 60

/** Latest logged weight, or a default when nothing's been logged yet. */
export function bodyWeight(data: AppData): { kg: number; logged: boolean } {
  const last = Object.keys(data.weights).sort().at(-1)
  return last ? { kg: data.weights[last], logged: true } : { kg: DEFAULT_KG, logged: false }
}

/** kcal ≈ MET × kg × hours — a rough estimate (±20%), not a target. */
export const kcal = (card: Card, kg: number) => Math.round(MET[card.category][card.intensity] * kg * (card.minutes / 60))
