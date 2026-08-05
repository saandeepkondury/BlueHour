/**
 * Two jobs, one library: keep a beginner runner's hips and calves durable, and
 * build the abdominal wall that shows once body fat comes down. Core work is
 * progressed in four levels so the same eight movements last 27 weeks.
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

const WARMUP: Exercise[] = [
  {
    id: "warm-hip-flow",
    name: "World's greatest stretch",
    prescription: "4 each side",
    cue: "Lunge, drop the back knee, open the chest to the sky. Unlocks hips before anything heavy.",
    pattern: "mobility",
  },
  {
    id: "warm-glute-bridge",
    name: "Glute bridge",
    prescription: "12 reps",
    cue: "Ribs down, squeeze at the top for a count. Wakes up what running lets go quiet.",
    pattern: "mobility",
  },
  {
    id: "warm-ankle-rock",
    name: "Ankle rocks at the wall",
    prescription: "10 each side",
    cue: "Knee tracks over the toes, heel glued down. Cheap insurance for Austin's hills.",
    pattern: "mobility",
  },
];

/** Compound work, ordered so the heaviest thing happens while you are fresh. */
const STRENGTH_BY_LEVEL: Record<number, Exercise[]> = {
  1: [
    {
      id: "sq-goblet",
      name: "Goblet squat",
      prescription: "3 × 10",
      cue: "Chest tall, knees out, sit between the heels. Weight light enough to be smooth.",
      pattern: "squat",
    },
    {
      id: "hi-hip-hinge",
      name: "Dumbbell Romanian deadlift",
      prescription: "3 × 10",
      cue: "Push the hips back, bar path along the thighs. Hamstrings should talk, not the low back.",
      pattern: "hinge",
    },
    {
      id: "sl-step-up",
      name: "Step-up to a bench",
      prescription: "3 × 8 each leg",
      cue: "Drive through the standing leg, lower slowly. This is the hill-repeat muscle.",
      pattern: "single-leg",
    },
    {
      id: "pu-pushup",
      name: "Push-up (hands elevated if needed)",
      prescription: "3 × 8",
      cue: "Body in one line, elbows at 45°. Elevate the hands rather than sag the hips.",
      pattern: "push",
    },
    {
      id: "pl-row",
      name: "One-arm dumbbell row",
      prescription: "3 × 10 each side",
      cue: "Pull to the hip, no torso twist. Balances everything running does to posture.",
      pattern: "pull",
    },
    {
      id: "ca-calf-raise",
      name: "Straight-leg calf raise",
      prescription: "2 × 15",
      cue: "Full range, pause at the top. Calves and Achilles take the load when mileage climbs.",
      pattern: "calf",
    },
  ],
  2: [
    {
      id: "sq-front-squat",
      name: "Dumbbell front squat",
      prescription: "4 × 8",
      cue: "Elbows high, brace before you descend. Add weight only when all four sets look identical.",
      pattern: "squat",
    },
    {
      id: "hi-single-rdl",
      name: "Single-leg Romanian deadlift",
      prescription: "3 × 8 each leg",
      cue: "Hips square, back leg long. Wobble is the point — it is the ankle learning.",
      pattern: "hinge",
    },
    {
      id: "sl-split-squat",
      name: "Rear-foot elevated split squat",
      prescription: "3 × 8 each leg",
      cue: "Front shin vertical, back knee toward the floor. The hardest thing here and the most useful.",
      pattern: "single-leg",
    },
    {
      id: "pu-incline-press",
      name: "Incline dumbbell press",
      prescription: "3 × 10",
      cue: "Shoulder blades set, press in an arc. Upper body strength keeps late-race form together.",
      pattern: "push",
    },
    {
      id: "pl-pulldown",
      name: "Lat pulldown or band pulldown",
      prescription: "3 × 10",
      cue: "Lead with the elbows, no leaning back. Pair it with the press every session.",
      pattern: "pull",
    },
    {
      id: "cr-suitcase-carry",
      name: "Suitcase carry",
      prescription: "3 × 40 m each side",
      cue: "One heavy weight, walk tall, do not lean. Anti-lean is what abs actually do when you run.",
      pattern: "carry",
    },
  ],
  3: [
    {
      id: "sq-back-squat",
      name: "Barbell back squat (or heavier goblet)",
      prescription: "4 × 6",
      cue: "Heavy but never grinding — you are a runner who lifts, not a lifter who runs.",
      pattern: "squat",
    },
    {
      id: "hi-trap-deadlift",
      name: "Trap-bar deadlift",
      prescription: "4 × 5",
      cue: "Stand up with the floor, not the back. Stop the set the moment the shape changes.",
      pattern: "hinge",
    },
    {
      id: "sl-walking-lunge",
      name: "Weighted walking lunge",
      prescription: "3 × 10 each leg",
      cue: "Long strides, quiet landings. Do these at least 48 hours from the long run.",
      pattern: "single-leg",
    },
    {
      id: "pu-overhead-press",
      name: "Standing overhead press",
      prescription: "3 × 8",
      cue: "Squeeze the glutes so the ribs stay stacked. Standing makes the core pay too.",
      pattern: "push",
    },
    {
      id: "pl-pullup",
      name: "Pull-up or assisted pull-up",
      prescription: "3 × 5",
      cue: "Full hang to chin over bar. Bands or a machine are fine — the range matters more.",
      pattern: "pull",
    },
    {
      id: "ca-eccentric-calf",
      name: "Eccentric single-leg calf raise",
      prescription: "3 × 8 each leg",
      cue: "Up on two, down on one over three seconds. The single best tendon insurance there is.",
      pattern: "calf",
    },
  ],
};

/**
 * Abs get their own progression because the goal is visible ones: heavy-ish,
 * low-rep anti-extension and hip flexion work rather than endless crunches.
 */
const CORE_BY_LEVEL: Record<number, Exercise[]> = {
  1: [
    {
      id: "core-dead-bug",
      name: "Dead bug",
      prescription: "3 × 8 each side",
      cue: "Low back pinned to the floor the whole time. If it arches, shorten the reach.",
      pattern: "core",
    },
    {
      id: "core-plank",
      name: "Front plank",
      prescription: "3 × 30 sec",
      cue: "Tuck the pelvis, squeeze the glutes, push the floor away. Quality over minutes.",
      pattern: "core",
    },
    {
      id: "core-side-plank",
      name: "Side plank",
      prescription: "2 × 20 sec each side",
      cue: "Stack the shoulders and hips. Trains the hip stability that saves knees at mile 10.",
      pattern: "core",
    },
    {
      id: "core-bird-dog",
      name: "Bird dog",
      prescription: "2 × 8 each side",
      cue: "Move slowly, keep the hips level. Balance a glass of water on your low back.",
      pattern: "core",
    },
  ],
  2: [
    {
      id: "core-dead-bug-reach",
      name: "Dead bug with a slow reach",
      prescription: "3 × 10 each side",
      cue: "Five seconds out, five back. Breathe out on the reach.",
      pattern: "core",
    },
    {
      id: "core-hollow-hold",
      name: "Hollow hold",
      prescription: "3 × 20 sec",
      cue: "Low back flat, arms by the ears if you can hold the shape. The base of every abs move.",
      pattern: "core",
    },
    {
      id: "core-shoulder-taps",
      name: "Plank shoulder taps",
      prescription: "3 × 20 taps",
      cue: "Hips do not rotate. Widen the feet to make it honest.",
      pattern: "core",
    },
    {
      id: "core-pallof",
      name: "Pallof press",
      prescription: "3 × 10 each side",
      cue: "Resist the twist, press straight out. Anti-rotation is the invisible half of abs.",
      pattern: "core",
    },
    {
      id: "core-reverse-crunch",
      name: "Reverse crunch",
      prescription: "3 × 12",
      cue: "Curl the pelvis, do not swing the legs. Lower abs, done properly.",
      pattern: "core",
    },
  ],
  3: [
    {
      id: "core-hanging-knee",
      name: "Hanging knee raise",
      prescription: "3 × 10",
      cue: "No swing. Curl the pelvis at the top instead of just lifting the knees.",
      pattern: "core",
    },
    {
      id: "core-hollow-rock",
      name: "Hollow rock",
      prescription: "3 × 20 sec",
      cue: "Rock from the shoulders, shape never changes. Stop when the shape breaks.",
      pattern: "core",
    },
    {
      id: "core-ab-wheel-half",
      name: "Ab wheel rollout to half range",
      prescription: "3 × 8",
      cue: "Ribs down, roll only as far as you can keep the low back flat.",
      pattern: "core",
    },
    {
      id: "core-copenhagen",
      name: "Copenhagen plank (short lever)",
      prescription: "2 × 15 sec each side",
      cue: "Top leg on the bench, bottom knee bent. Groin insurance for higher mileage.",
      pattern: "core",
    },
    {
      id: "core-cable-crunch",
      name: "Cable or band crunch",
      prescription: "3 × 12",
      cue: "Spine flexes, hips stay put. This is the one abs move worth adding load to.",
      pattern: "core",
    },
  ],
  4: [
    {
      id: "core-hanging-leg",
      name: "Hanging leg raise",
      prescription: "4 × 8",
      cue: "Straight legs to the bar if you can, slow on the way down. Nothing swings.",
      pattern: "core",
    },
    {
      id: "core-ab-wheel-full",
      name: "Ab wheel rollout, full",
      prescription: "3 × 8",
      cue: "Hips and shoulders travel together. Stop the set at the first sagging rep.",
      pattern: "core",
    },
    {
      id: "core-dragon-negative",
      name: "Dragon flag negative",
      prescription: "3 × 5",
      cue: "Lower over five seconds, body in one line. Advanced — skip if the back rounds.",
      pattern: "core",
    },
    {
      id: "core-weighted-side-plank",
      name: "Weighted side plank",
      prescription: "3 × 20 sec each side",
      cue: "Plate on the hip. Obliques are what make the waist look narrow.",
      pattern: "core",
    },
    {
      id: "core-cable-crunch-heavy",
      name: "Loaded crunch, 8–10 reps",
      prescription: "4 × 8",
      cue: "Heavy enough that 10 would be a struggle. Abs are muscles; train them like it.",
      pattern: "core",
    },
  ],
};

const MOBILITY: Exercise[] = [
  {
    id: "mob-hip-flow",
    name: "Hip flow",
    prescription: "6 min easy",
    cue: "Lunge, twist, hamstring sweep, repeat. Movement, not stretching for a score.",
    pattern: "mobility",
  },
  {
    id: "mob-calf-wall",
    name: "Calf and Achilles stretch",
    prescription: "2 × 45 sec each",
    cue: "Slow breath, no bouncing. Taper weeks are for feeling loose, not proving anything.",
    pattern: "mobility",
  },
  {
    id: "mob-dead-bug",
    name: "Dead bug, easy tempo",
    prescription: "2 × 8 each side",
    cue: "Just enough to keep the brace pattern awake.",
    pattern: "mobility",
  },
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
    {
      id: "sl-glute-bridge",
      name: "Single-leg glute bridge",
      prescription: "3 × 10 each side",
      cue: "Ribs down, pause at the top. The hip that keeps you stacked at mile 11.",
      pattern: "single-leg",
    },
    STRENGTH_BY_LEVEL[1][5],
    {
      id: "core-side-plank-a",
      name: "Side plank",
      prescription: "3 × 30 sec each side",
      cue: "Shoulders stacked, hips high. Anti-collapse for the late miles.",
      pattern: "core",
    },
  ],
  2: [
    STRENGTH_BY_LEVEL[2][0],
    STRENGTH_BY_LEVEL[2][1],
    STRENGTH_BY_LEVEL[2][2],
    STRENGTH_BY_LEVEL[2][5] ?? STRENGTH_BY_LEVEL[1][5],
    STRENGTH_BY_LEVEL[1][5],
    {
      id: "core-side-plank-a2",
      name: "Side plank with dip",
      prescription: "3 × 8 each side",
      cue: "Small controlled dips. Stop if the top hip sags.",
      pattern: "core",
    },
  ],
  3: [
    STRENGTH_BY_LEVEL[3][0],
    STRENGTH_BY_LEVEL[3][1],
    STRENGTH_BY_LEVEL[3][2],
    STRENGTH_BY_LEVEL[3][5],
    {
      id: "core-side-plank-a3",
      name: "Weighted side plank",
      prescription: "3 × 20 sec each side",
      cue: "Light plate on the hip. Shape first, load second.",
      pattern: "core",
    },
  ],
};

const STRENGTH_B_BY_LEVEL: Record<number, Exercise[]> = {
  1: [
    STRENGTH_BY_LEVEL[1][3],
    STRENGTH_BY_LEVEL[1][4],
    {
      id: "hi-single-rdl-b",
      name: "Single-leg Romanian deadlift",
      prescription: "3 × 8 each leg",
      cue: "Light load, hips square. Balance is the work.",
      pattern: "hinge",
    },
    {
      id: "lat-band-walk",
      name: "Lateral band walk",
      prescription: "3 × 12 each way",
      cue: "Soft knees, band above the knees, no waddle.",
      pattern: "single-leg",
    },
    {
      id: "core-dead-bug-b",
      name: "Dead bug",
      prescription: "3 × 6 each side, slow",
      cue: "Low back pinned. If it arches, shorten the reach.",
      pattern: "core",
    },
    {
      id: "cr-farmer-b",
      name: "Farmer or suitcase carry",
      prescription: "3 × 30–40 sec each side",
      cue: "Walk tall, do not lean. This is what abs do when you run.",
      pattern: "carry",
    },
  ],
  2: [
    STRENGTH_BY_LEVEL[2][3],
    STRENGTH_BY_LEVEL[2][4],
    STRENGTH_BY_LEVEL[2][1],
    {
      id: "lat-band-walk-2",
      name: "Lateral band walk",
      prescription: "3 × 15 each way",
      cue: "Heavier band if 12 was easy. Knees track over mid-foot.",
      pattern: "single-leg",
    },
    STRENGTH_BY_LEVEL[2][5],
  ],
  3: [
    STRENGTH_BY_LEVEL[3][3],
    STRENGTH_BY_LEVEL[3][4],
    STRENGTH_BY_LEVEL[2][1],
    STRENGTH_BY_LEVEL[2][5],
    {
      id: "cr-farmer-b3",
      name: "Heavy suitcase carry",
      prescription: "3 × 40 sec each side",
      cue: "Heavy enough that the brace is automatic. No lean, no rush.",
      pattern: "carry",
    },
  ],
};

const ABS_B_FINISHER: Exercise[] = [
  {
    id: "abs-b-side",
    name: "Side plank",
    prescription: "30 sec each side",
    cue: "Quick finisher. Quality over time.",
    pattern: "core",
  },
  {
    id: "abs-b-heel",
    name: "Heel taps or reverse crunch",
    prescription: "10 slow reps",
    cue: "Curl the pelvis, do not yank the neck.",
    pattern: "core",
  },
  {
    id: "abs-b-squeeze",
    name: "Ball or fist squeeze between knees",
    prescription: "20 sec",
    cue: "Adductor short hold — groin insurance as mileage climbs.",
    pattern: "core",
  },
  {
    id: "abs-b-carry",
    name: "Suitcase carry",
    prescription: "30 sec each side",
    cue: "One more anti-lean walk if the main lifts skipped it.",
    pattern: "carry",
  },
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
