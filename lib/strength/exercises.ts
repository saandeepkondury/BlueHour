/**
 * Runner strength + core, sourced only from WorkoutX. Two lift days and one
 * abs day: posterior chain, single-leg control, calves, anti-collapse, then
 * loaded trunk work so abs show once body fat comes down.
 *
 * Patterns follow common half-marathon templates (lower A / upper-stability B)
 * and runner core research: anti-extension, anti-rotation, anti-lateral flexion,
 * then progressive hanging + rollout + crunch loading.
 */

export type Pattern =
  | "mobility"
  | "squat"
  | "hinge"
  | "single-leg"
  | "push"
  | "pull"
  | "carry"
  | "core"
  | "calf";

export interface Exercise {
  id: string;
  /** WorkoutX catalog id — every programmed move must have one. */
  wxId: string;
  name: string;
  prescription: string;
  cue: string;
  pattern: Pattern;
}

export interface Block {
  name: string;
  exercises: Exercise[];
}

export type Focus = "full" | "core" | "mobility";
export type StrengthVariant = "a" | "b";

function ex(
  id: string,
  wxId: string,
  name: string,
  prescription: string,
  cue: string,
  pattern: Pattern,
): Exercise {
  return { id, wxId, name, prescription, cue, pattern };
}

const WARMUP: Exercise[] = [
  ex(
    "warm-glute-bridge",
    "3013",
    "Low glute bridge on floor",
    "12 reps",
    "Ribs down, squeeze at the top for a count. Wakes up what running lets go quiet.",
    "mobility",
  ),
  ex(
    "warm-quad-stretch",
    "0613",
    "Lying side quads stretch",
    "30 sec each side",
    "Gentle pull, hips stacked. Opens the hip flexors Austin's hills tighten.",
    "mobility",
  ),
  ex(
    "warm-calf-raise",
    "1373",
    "Bodyweight standing calf raise",
    "10 slow reps",
    "Full range, pause at the bottom. Ankle prep without a wall drill.",
    "calf",
  ),
];

/** Compound library used by both A/B days. Heaviest work first. */
const STRENGTH_BY_LEVEL: Record<number, Exercise[]> = {
  1: [
    ex(
      "sq-goblet",
      "1760",
      "Dumbbell goblet squat",
      "3 × 10",
      "Chest tall, elbows inside the knees. Smooth reps, not a grind.",
      "squat",
    ),
    ex(
      "hi-hip-hinge",
      "1459",
      "Dumbbell Romanian deadlift",
      "3 × 10",
      "Hips back, dumbbells brush the thighs. Hamstrings talk, low back stays quiet.",
      "hinge",
    ),
    ex(
      "sl-step-up",
      "0431",
      "Dumbbell step-up",
      "3 × 8 each leg",
      "Drive through the standing leg, lower slowly. This is the hill-repeat muscle.",
      "single-leg",
    ),
    ex(
      "pu-pushup",
      "0493",
      "Incline push-up",
      "3 × 8",
      "Hands on a bench if the floor sag. Body in one line, elbows at 45°.",
      "push",
    ),
    ex(
      "pl-row",
      "0293",
      "Dumbbell bent over row",
      "3 × 10",
      "Pull to the hip, no torso swing. Balances everything running does to posture.",
      "pull",
    ),
    ex(
      "ca-calf-raise",
      "0417",
      "Dumbbell standing calf raise",
      "2 × 15",
      "Full range, pause at the top. Calves and Achilles take the load when mileage climbs.",
      "calf",
    ),
  ],
  2: [
    ex(
      "sq-front-squat",
      "0042",
      "Barbell front squat",
      "4 × 8",
      "Elbows high, brace before you descend. Goblet if the rack is busy.",
      "squat",
    ),
    ex(
      "sl-split-squat",
      "0410",
      "Dumbbell single-leg split squat",
      "3 × 8 each leg",
      "Rear foot up, front shin vertical. The hardest useful single-leg move here.",
      "single-leg",
    ),
    ex(
      "sl-rear-lunge",
      "0381",
      "Dumbbell rear lunge",
      "3 × 8 each leg",
      "Step back quietly, front heel owns the floor. Hips stay square.",
      "single-leg",
    ),
    ex(
      "pu-incline-press",
      "0314",
      "Dumbbell incline bench press",
      "3 × 10",
      "Shoulder blades set, press in an arc. Upper-body strength keeps late-race form together.",
      "push",
    ),
    ex(
      "pl-pulldown",
      "2330",
      "Cable lat pulldown",
      "3 × 10",
      "Lead with the elbows, no leaning back. Pair it with the press every session.",
      "pull",
    ),
    ex(
      "cr-farmer",
      "2133",
      "Farmers walk",
      "3 × 40 sec",
      "Heavy dumbbells, walk tall, no lean. Anti-collapse is what abs do when you run.",
      "carry",
    ),
  ],
  3: [
    ex(
      "sq-back-squat",
      "0043",
      "Barbell full squat",
      "4 × 6",
      "Heavy but never grinding — you are a runner who lifts, not a lifter who runs.",
      "squat",
    ),
    ex(
      "hi-trap-deadlift",
      "0811",
      "Trap bar deadlift",
      "4 × 5",
      "Stand up with the floor, not the back. Stop the set the moment the shape changes.",
      "hinge",
    ),
    ex(
      "sl-walking-lunge",
      "1460",
      "Walking lunge",
      "3 × 10 each leg",
      "Long strides, quiet landings. Hold dumbbells once bodyweight is easy.",
      "single-leg",
    ),
    ex(
      "pu-overhead-press",
      "0426",
      "Dumbbell standing overhead press",
      "3 × 8",
      "Glutes squeezed, ribs stacked. Standing makes the core pay too.",
      "push",
    ),
    ex(
      "pl-pullup",
      "0651",
      "Neutral-grip pull-up",
      "3 × 5",
      "Full hang to chin over bar. Band or machine assist is fine — range matters more.",
      "pull",
    ),
    ex(
      "ca-eccentric-calf",
      "0409",
      "Dumbbell single-leg calf raise",
      "3 × 8 each leg",
      "Slow on the way down. The best tendon insurance in the catalog.",
      "calf",
    ),
  ],
};

/**
 * Abs day: stability first, then hanging + wheel + loaded crunch so the wall
 * actually hypertrophies. No bird-dog / dragon-flag / Copenhagen short-lever —
 * those are not in WorkoutX; close catalog cousins replace them.
 */
const CORE_BY_LEVEL: Record<number, Exercise[]> = {
  1: [
    ex(
      "core-dead-bug",
      "0276",
      "Dead bug",
      "3 × 8 each side",
      "Low back pinned to the floor. If it arches, shorten the reach.",
      "core",
    ),
    ex(
      "core-plank",
      // WorkoutX Front Plank (5202) metadata is fine; its watermarked GIF 503s.
      // Client falls back to 2135 for the demo loop — keep this id for cues/copy.
      "5202",
      "Front plank",
      "3 × 30 sec",
      "Tuck the pelvis, squeeze the glutes, push the floor away. Quality over minutes.",
      "core",
    ),
    ex(
      "core-side-plank",
      "0705",
      "Side bridge",
      "2 × 20 sec each side",
      "Shoulders and hips stacked. Hip stability that saves knees at mile 10.",
      "core",
    ),
    ex(
      "core-heel-touch",
      "0006",
      "Alternate heel touchers",
      "2 × 12 each side",
      "Shoulder blades off the floor, reach side to side. Slow, not a sit-up race.",
      "core",
    ),
  ],
  2: [
    ex(
      "core-dead-bug-reach",
      "0276",
      "Dead bug",
      "3 × 10 each side, slow",
      "Five seconds out, five back. Breathe out on the reach.",
      "core",
    ),
    ex(
      "core-weighted-plank",
      "2135",
      "Weighted front plank",
      "3 × 20 sec",
      "Plate on the mid-back. Shape first — dump the plate if the hips sag.",
      "core",
    ),
    ex(
      "core-shoulder-taps",
      "3239",
      "Kneeling plank shoulder tap",
      "3 × 20 taps",
      "Hips do not rotate. Widen the knees to make it honest.",
      "core",
    ),
    ex(
      "core-pallof",
      "0979",
      "Band horizontal Pallof press",
      "3 × 10 each side",
      "Resist the twist, press straight out. Anti-rotation is the invisible half of abs.",
      "core",
    ),
    ex(
      "core-crunch",
      "0267",
      "Crunch, hands overhead",
      "3 × 12",
      "Curl the ribs toward the hips. Arms stay by the ears so you cannot yank the neck.",
      "core",
    ),
  ],
  3: [
    ex(
      "core-hanging-knee",
      "0011",
      "Assisted hanging knee raise",
      "3 × 10",
      "No swing. Curl the pelvis at the top instead of just lifting the knees.",
      "core",
    ),
    ex(
      "core-ab-wheel",
      "0857",
      "Wheel rollout",
      "3 × 8",
      "Ribs down, roll only as far as the low back stays flat. Half range is honest.",
      "core",
    ),
    ex(
      "core-copenhagen",
      "1775",
      "Side plank hip adduction",
      "2 × 15 sec each side",
      "Top-leg adductor plank. Groin insurance — the catalog stand-in for Copenhagen.",
      "core",
    ),
    ex(
      "core-cable-crunch",
      "0175",
      "Cable kneeling crunch",
      "3 × 12",
      "Spine flexes, hips stay put. This is the abs move worth adding load to.",
      "core",
    ),
    ex(
      "core-plank-long",
      "5202",
      "Front plank",
      "3 × 45 sec",
      "Same shape as level 1, longer. Dump the set at the first sag.",
      "core",
    ),
  ],
  4: [
    ex(
      "core-hanging-leg",
      "0475",
      "Hanging straight-leg raise",
      "4 × 8",
      "Straight legs, slow on the way down. Nothing swings.",
      "core",
    ),
    ex(
      "core-ab-wheel-full",
      "0857",
      "Wheel rollout",
      "3 × 8",
      "Hips and shoulders travel together. Stop at the first sagging rep.",
      "core",
    ),
    ex(
      "core-cable-crunch-heavy",
      "0212",
      "Cable seated crunch",
      "4 × 8",
      "Heavy enough that 10 would be a struggle. Abs are muscles; train them like it.",
      "core",
    ),
    ex(
      "core-copenhagen-long",
      "1775",
      "Side plank hip adduction",
      "3 × 20 sec each side",
      "Longer lever if you can keep the hips high. Obliques plus adductors.",
      "core",
    ),
    ex(
      "core-weighted-plank-heavy",
      "2135",
      "Weighted front plank",
      "3 × 25 sec",
      "Heavier plate than level 2. Shape never changes.",
      "core",
    ),
  ],
};

const MOBILITY: Exercise[] = [
  ex(
    "mob-quad-stretch",
    "0613",
    "Lying side quads stretch",
    "2 × 45 sec each",
    "Slow breath, no bouncing. Taper weeks are for feeling loose.",
    "mobility",
  ),
  ex(
    "mob-lateral-stretch",
    "0794",
    "Standing lateral stretch",
    "2 × 30 sec each side",
    "Reach long over the ear. Side body, not a side crunch.",
    "mobility",
  ),
  ex(
    "mob-dead-bug",
    "0276",
    "Dead bug",
    "2 × 8 each side",
    "Just enough to keep the brace pattern awake.",
    "core",
  ),
];

export function coreLevelFor(week: number, totalWeeks: number, absGoal: boolean): number {
  const share = week / Math.max(1, totalWeeks);
  if (!absGoal) return share > 0.4 ? 2 : 1;
  if (share < 0.18) return 1;
  if (share < 0.45) return 2;
  if (share < 0.8) return 3;
  return 4;
}

export function strengthLevelFor(week: number, totalWeeks: number): number {
  const share = week / Math.max(1, totalWeeks);
  if (share < 0.25) return 1;
  if (share < 0.65) return 2;
  return 3;
}

const STRENGTH_A_BY_LEVEL: Record<number, Exercise[]> = {
  1: [
    STRENGTH_BY_LEVEL[1][0],
    STRENGTH_BY_LEVEL[1][1],
    STRENGTH_BY_LEVEL[1][2],
    ex(
      "sl-glute-bridge",
      "3645",
      "Single-leg bridge with outstretched leg",
      "3 × 10 each side",
      "Ribs down, pause at the top. The hip that keeps you stacked at mile 11.",
      "single-leg",
    ),
    STRENGTH_BY_LEVEL[1][5],
    ex(
      "core-side-plank-a",
      "0705",
      "Side bridge",
      "3 × 30 sec each side",
      "Shoulders stacked, hips high. Anti-collapse for the late miles.",
      "core",
    ),
  ],
  2: [
    STRENGTH_BY_LEVEL[2][0],
    STRENGTH_BY_LEVEL[2][1],
    STRENGTH_BY_LEVEL[2][2],
    STRENGTH_BY_LEVEL[2][5],
    STRENGTH_BY_LEVEL[1][5],
    ex(
      "core-copenhagen-a",
      "1775",
      "Side plank hip adduction",
      "2 × 20 sec each side",
      "Adductor + oblique. Stop if the top hip sags.",
      "core",
    ),
  ],
  3: [
    STRENGTH_BY_LEVEL[3][0],
    STRENGTH_BY_LEVEL[3][1],
    STRENGTH_BY_LEVEL[3][2],
    STRENGTH_BY_LEVEL[3][5],
    ex(
      "core-copenhagen-a3",
      "1775",
      "Side plank hip adduction",
      "3 × 20 sec each side",
      "Longer holds. Groin and waist together.",
      "core",
    ),
  ],
};

const STRENGTH_B_BY_LEVEL: Record<number, Exercise[]> = {
  1: [
    STRENGTH_BY_LEVEL[1][3],
    STRENGTH_BY_LEVEL[1][4],
    ex(
      "sl-rear-lunge-b",
      "0381",
      "Dumbbell rear lunge",
      "3 × 8 each leg",
      "Light load, hips square. Balance is the work — not a heavy squat day.",
      "single-leg",
    ),
    ex(
      "lat-hip-abduction",
      "0710",
      "Side hip abduction",
      "3 × 12 each side",
      "Lying side-lying raise. Catalog stand-in for a lateral band walk.",
      "single-leg",
    ),
    ex(
      "core-dead-bug-b",
      "0276",
      "Dead bug",
      "3 × 6 each side, slow",
      "Low back pinned. If it arches, shorten the reach.",
      "core",
    ),
    STRENGTH_BY_LEVEL[2][5],
  ],
  2: [
    STRENGTH_BY_LEVEL[2][3],
    STRENGTH_BY_LEVEL[2][4],
    STRENGTH_BY_LEVEL[2][1],
    ex(
      "lat-hip-abduction-2",
      "0710",
      "Side hip abduction",
      "3 × 15 each side",
      "Ankle weight if 12 was easy. No rolling the hips back.",
      "single-leg",
    ),
    STRENGTH_BY_LEVEL[2][5],
  ],
  3: [
    STRENGTH_BY_LEVEL[3][3],
    STRENGTH_BY_LEVEL[3][4],
    STRENGTH_BY_LEVEL[2][1],
    STRENGTH_BY_LEVEL[2][5],
    ex(
      "cr-farmer-heavy",
      "2133",
      "Farmers walk",
      "3 × 45 sec",
      "Heavier than Strength A. Brace automatic, no lean, no rush.",
      "carry",
    ),
  ],
};

const ABS_B_FINISHER: Exercise[] = [
  ex(
    "abs-b-side",
    "0705",
    "Side bridge",
    "30 sec each side",
    "Quick finisher. Quality over time.",
    "core",
  ),
  ex(
    "abs-b-heel",
    "0006",
    "Alternate heel touchers",
    "12 slow reps each side",
    "Curl the ribs, do not yank the neck.",
    "core",
  ),
  ex(
    "abs-b-hip",
    "0710",
    "Side hip abduction",
    "12 each side",
    "Hip-stability closer before the long-run day.",
    "single-leg",
  ),
  ex(
    "abs-b-carry",
    "2133",
    "Farmers walk",
    "30 sec",
    "One more anti-lean walk if the main lifts skipped it.",
    "carry",
  ),
];

/** Peak and taper weeks trim volume rather than dropping strength entirely. */
export function blocksFor(
  focus: Focus,
  level: number,
  coreLevel: number,
  deload: boolean,
  variant: StrengthVariant = "a",
): Block[] {
  if (focus === "mobility") {
    return [{ name: "Loosen up", exercises: MOBILITY }];
  }

  const core = CORE_BY_LEVEL[Math.min(4, Math.max(1, coreLevel))];

  if (focus === "core") {
    return [
      { name: "Warm-up", exercises: WARMUP.slice(0, 2) },
      { name: `Abs A — level ${coreLevel}`, exercises: deload ? core.slice(0, 3) : core },
    ];
  }

  if (variant === "b") {
    const lifts = STRENGTH_B_BY_LEVEL[Math.min(3, Math.max(1, level))];
    return [
      { name: "Warm-up", exercises: WARMUP.slice(0, 2) },
      { name: "Strength B — upper, hips, anti-collapse", exercises: deload ? lifts.slice(0, 4) : lifts },
      { name: "Abs B finisher", exercises: deload ? ABS_B_FINISHER.slice(0, 2) : ABS_B_FINISHER },
    ];
  }

  const lifts = STRENGTH_A_BY_LEVEL[Math.min(3, Math.max(1, level))];
  return [
    { name: "Warm-up", exercises: WARMUP },
    { name: "Strength A — lower + posterior", exercises: deload ? lifts.slice(0, 4) : lifts },
  ];
}

export function allCatalogExercises(): Exercise[] {
  const seen = new Map<string, Exercise>();
  const add = (list: Exercise[]) => {
    for (const exercise of list) seen.set(exercise.id, exercise);
  };
  add(WARMUP);
  add(MOBILITY);
  add(ABS_B_FINISHER);
  for (const level of Object.values(STRENGTH_BY_LEVEL)) add(level);
  for (const level of Object.values(CORE_BY_LEVEL)) add(level);
  for (const level of Object.values(STRENGTH_A_BY_LEVEL)) add(level);
  for (const level of Object.values(STRENGTH_B_BY_LEVEL)) add(level);
  return [...seen.values()];
}

export function exerciseById(id: string): Exercise | undefined {
  return allCatalogExercises().find((exercise) => exercise.id === id);
}

export function parseBlocks(json: string): Block[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Block[]) : [];
  } catch {
    return [];
  }
}

export function exerciseCount(blocks: Block[]): number {
  return blocks.reduce((sum, block) => sum + block.exercises.length, 0);
}
