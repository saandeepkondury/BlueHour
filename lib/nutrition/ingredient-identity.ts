/**
 * Canonical grocery identity — collapses near-duplicate ingredient names
 * (aliases, sizes, prep states, plurals) so the shopping list stays short
 * for current and future recipes.
 */

export interface IngredientIdentity {
  /** Stable merge / pantry key (no unit). */
  key: string;
  /** Display name on the grocery list. */
  label: string;
}

/** Synonym groups → one shopping-list line. First entry is the preferred label. */
const ALIAS_GROUPS: readonly (readonly string[])[] = [
  // Produce
  ["Onion", "shallot", "red onion", "white onion", "yellow onion", "purple onion", "onion (small)"],
  ["Green onion", "spring onion", "spring onions", "scallion", "scallions", "scallion greens"],
  ["Bell pepper", "bell peppers", "bell peppers (mixed)", "capsicum", "capsicum (bell pepper)", "red bell pepper"],
  ["Sprouts", "steamed sprouts", "bean sprouts"],
  ["Cilantro", "coriander", "fresh coriander", "fresh cilantro"],
  ["Tomato", "tomatoes", "cherry tomatoes"],
  ["Potato", "potatoes", "yukon gold potatoes"],
  ["Jalapeño", "jalapeno", "jalapeños", "jalapenos"],
  ["Green chilli", "green chillies", "green chili", "green chilies"],
  ["Garlic", "garlic cloves", "garlic clove"],
  ["Ginger", "fresh ginger"],
  ["Ginger-garlic paste", "ginger-garlic", "garlic paste"],
  ["Corn", "sweet corn", "sweetcorn", "canned sweet corn", "corn (canned)", "corn kernels", "fire-roasted corn"],
  ["Lettuce", "green leaf lettuce"],
  ["Cucumber", "mini cucumber", "cucumbers"],
  ["Lemon", "lemons"],
  ["Lime", "limes"],
  ["Spinach", "baby spinach"],

  // Dairy / cheese
  ["Paneer", "cottage cheese", "low-fat paneer", "high-protein paneer", "high-protein low-fat paneer"],
  [
    "Greek yogurt",
    "0% greek yogurt",
    "nonfat greek yogurt",
    "high-protein greek yogurt",
    "greek yogurt or crema",
  ],
  ["Yogurt", "curd (yogurt)", "thick curd (yogurt)", "plain yogurt", "fat-free yogurt", "low-fat yogurt"],
  ["Mozzarella", "fat-free mozzarella", "low-fat mozzarella"],
  ["Feta", "feta cheese", "low-fat feta", "cotija or feta", "cotija cheese", "queso fresco"],
  ["Cheddar", "fat-free cheddar"],
  ["Cream cheese", "reduced-fat cream cheese"],
  ["Butter", "light butter", "butter or oil"],
  ["Sour cream", "light sour cream"],
  ["Milk", "skim milk"],

  // Protein
  ["Egg", "eggs"],
  ["Chicken breast", "chicken", "boneless chicken"],
  ["Chicken thighs", "chicken thighs (boneless)", "chicken drumsticks/thighs"],
  ["Ground beef", "lean ground beef", "lean ground beef (93/7)", "extra-lean ground beef", "ground beef (80/20)"],
  ["Beef (thin)", "beef (thinly sliced)", "eye of round beef (thin)"],

  // Pantry staples
  [
    "Soya chunks",
    "dry soya chunks",
    "dry soy chunks",
    "dry soya chunks (boiled)",
    "dry soya chunks (raw)",
    "dry soya chunks (soaked)",
  ],
  ["Soy sauce", "dark soy sauce"],
  ["Ketchup", "tomato ketchup", "reduced-sugar ketchup", "low-cal ketchup"],
  ["Mayonnaise", "mayo", "light mayo"],
  ["Flour", "all-purpose flour", "plain flour", "atta", "whole wheat atta"],
  ["Cornstarch", "cornflour", "corn flour"],
  ["Nori", "nori sheet", "nori sheets"],
  ["Olive oil", "oil", "oil or ghee"],
  ["Sesame seeds", "sesame seed"],
  ["Black beans", "black bean"],
  ["Kidney beans", "boiled rajma (kidney beans)", "rajma"],
  ["Chickpeas", "cooked chickpeas"],
  [
    "Rice (uncooked)",
    "basmati rice (dry)",
    "basmati rice (uncooked)",
    "jasmine rice (uncooked)",
    "sushi rice (uncooked)",
    "short-grain rice (uncooked)",
    "sticky rice (uncooked)",
  ],
  [
    "Rice (cooked)",
    "cooked rice",
    "boiled rice",
    "cooked jasmine rice",
    "cooked sticky rice",
    "short-grain rice (cooked)",
    "cooked mexican rice",
  ],
  ["Chipotle peppers", "chipotle peppers in adobo", "chipotle chilli paste"],
  ["Sriracha", "sriracha sauce"],
];

/** Prep / size words that do not change what you buy. */
const STRIP_WORDS = new Set([
  "small",
  "large",
  "medium",
  "mini",
  "fresh",
  "frozen",
  "steamed",
  "boiled",
  "raw",
  "soaked",
  "thin",
  "thinly",
  "sliced",
  "diced",
  "chopped",
  "minced",
  "grated",
  "shredded",
  "crushed",
  "whole",
  "boneless",
  "skinless",
  "mixed",
  "dry",
  "dried",
]);

/** Fat / protein marketing prefixes that still mean the same grocery item. */
const STRIP_PREFIXES = [
  "high-protein low-fat ",
  "high-protein ",
  "reduced-fat ",
  "reduced-sugar ",
  "low-calorie ",
  "low-cal ",
  "fat-free ",
  "nonfat ",
  "0% ",
  "low-fat ",
  "light ",
  "extra-lean ",
  "lean ",
];

const aliasToIdentity = new Map<string, IngredientIdentity>();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function registerAlias(alias: string, identity: IngredientIdentity): void {
  const forms = [
    alias.toLowerCase().trim(),
    stripAlternates(alias.toLowerCase().trim()),
    unfoldParentheticals(alias.toLowerCase().trim()),
    normalizeForLookup(alias),
  ];
  for (const form of forms) {
    const key = form.replace(/\s+/g, " ").trim();
    if (key && !aliasToIdentity.has(key)) aliasToIdentity.set(key, identity);
  }
}

for (const group of ALIAS_GROUPS) {
  const label = group[0]!;
  const identity: IngredientIdentity = { key: slugify(label), label };
  for (const alias of group) registerAlias(alias, identity);
}

/** Keep lookalikes distinct when stripping would otherwise collide. */
registerAlias("sriracha mayonnaise", { key: "sriracha-mayonnaise", label: "Sriracha mayonnaise" });
registerAlias("avocado oil", { key: "avocado-oil", label: "Avocado oil" });
registerAlias("mustard oil", { key: "mustard-oil", label: "Mustard oil" });
registerAlias("sesame oil", { key: "sesame-oil", label: "Sesame oil" });
registerAlias("coriander powder", { key: "coriander-powder", label: "Coriander powder" });
registerAlias("lemon juice", { key: "lemon-juice", label: "Lemon juice" });
registerAlias("lime juice", { key: "lime-juice", label: "Lime juice" });
registerAlias("tomato paste", { key: "tomato-paste", label: "Tomato paste" });
registerAlias("chicken bone broth", { key: "chicken-broth", label: "Chicken broth" });
registerAlias("chicken broth", { key: "chicken-broth", label: "Chicken broth" });
registerAlias("beef bone broth", { key: "beef-broth", label: "Beef broth" });
registerAlias("egg white", { key: "egg-white", label: "Egg white" });
registerAlias("corn tortilla", { key: "corn-tortilla", label: "Corn tortilla" });
registerAlias("green beans", { key: "green-beans", label: "Green beans" });

function unfoldParentheticals(text: string): string {
  return text.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}

/** Take the left side of "A or B" shopping alternatives. */
function stripAlternates(text: string): string {
  const orIdx = text.toLowerCase().indexOf(" or ");
  if (orIdx === -1) return text;
  return text.slice(0, orIdx).trim();
}

function singularizeToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("oes")) return token.slice(0, -2);
  if (token.endsWith("ses") || token.endsWith("xes") || token.endsWith("zes")) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us") && !token.endsWith("is")) {
    return token.slice(0, -1);
  }
  return token;
}

function stripNoiseWords(text: string): string {
  const tokens = text
    .split(/[\s/]+/)
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ""))
    .filter(Boolean)
    .filter((t) => !STRIP_WORDS.has(t.toLowerCase()))
    .map((t) => singularizeToken(t.toLowerCase()));
  return tokens.join(" ").trim();
}

function stripMarketingPrefixes(text: string): string {
  let out = text.toLowerCase().trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of STRIP_PREFIXES) {
      if (out.startsWith(prefix)) {
        out = out.slice(prefix.length).trim();
        changed = true;
      }
    }
  }
  return out;
}

/** Lowercase lookup form used for alias maps. */
export function normalizeForLookup(raw: string): string {
  return stripNoiseWords(
    stripMarketingPrefixes(stripAlternates(unfoldParentheticals(raw.toLowerCase().trim()))),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/**
 * Resolve any recipe ingredient name to a stable grocery identity.
 * Future recipes get the same collapsing via aliases + noise stripping.
 */
export function resolveIngredientIdentity(item: string): IngredientIdentity {
  const raw = item.trim();
  if (!raw) return { key: "unknown", label: "Unknown" };

  const candidates = [
    raw.toLowerCase().trim(),
    stripAlternates(raw.toLowerCase().trim()),
    unfoldParentheticals(raw.toLowerCase().trim()),
    normalizeForLookup(raw),
    stripNoiseWords(stripMarketingPrefixes(raw.toLowerCase().trim())),
  ];

  for (const candidate of candidates) {
    const hit = aliasToIdentity.get(candidate.replace(/\s+/g, " ").trim());
    if (hit) return hit;
  }

  const normalized = normalizeForLookup(raw) || raw.toLowerCase().trim();
  const hit = aliasToIdentity.get(normalized);
  if (hit) return hit;

  return {
    key: slugify(normalized || raw),
    label: titleCase(normalized || raw),
  };
}

/**
 * Map a stored pantry/buy-list key (new canonical, or legacy `name|unit`) to
 * the current identity key.
 */
export function canonicalizeStoredItemKey(storedKey: string): string {
  const namePart = storedKey.includes("|") ? storedKey.slice(0, storedKey.indexOf("|")) : storedKey;
  // Already a slug with no spaces — try as-is first, then treat as a name.
  if (!namePart.includes(" ") && !namePart.includes("(") && aliasToIdentity.has(namePart)) {
    return aliasToIdentity.get(namePart)!.key;
  }
  // Legacy keys were `lowercased name|unit`; slugs are hyphenated.
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(namePart) && !namePart.includes("|")) {
    // May already be a canonical key from a previous write.
    const asName = namePart.replace(/-/g, " ");
    return resolveIngredientIdentity(asName).key;
  }
  return resolveIngredientIdentity(namePart).key;
}

/** Volume units we can fold together when summing grocery qty. */
const VOLUME_TO_TSP: Record<string, number> = {
  tsp: 1,
  teaspoon: 1,
  teaspoons: 1,
  tbsp: 3,
  tablespoon: 3,
  tablespoons: 3,
  cup: 48,
  cups: 48,
  ml: 1 / 4.92892,
  milliliter: 1 / 4.92892,
  milliliters: 1 / 4.92892,
};

const WEIGHT_TO_G: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

const COUNT_UNITS = new Set(["ea", "each", "clove", "cloves", "leaf", "leaves", "slice", "slices", "ear", "ears", "head", "heads", "handful", "handfuls", "packet", "packets"]);

export function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u === "teaspoon" || u === "teaspoons") return "tsp";
  if (u === "tablespoon" || u === "tablespoons") return "tbsp";
  if (u === "cups") return "cup";
  if (u === "grams" || u === "gram") return "g";
  if (u === "each") return "ea";
  if (u === "cloves") return "clove";
  if (u === "slices") return "slice";
  if (u === "leaves") return "leaf";
  if (u === "handfuls") return "handful";
  if (u === "packets") return "packet";
  if (u === "milliliters" || u === "milliliter") return "ml";
  return u;
}

export type QtyBucket = "volume" | "weight" | "count" | "other";

export function qtyBucket(unit: string): QtyBucket {
  const u = normalizeUnit(unit);
  if (u in VOLUME_TO_TSP) return "volume";
  if (u in WEIGHT_TO_G) return "weight";
  if (COUNT_UNITS.has(u)) return "count";
  return "other";
}

/** Fold qty into comparable base units within a bucket; returns display unit + qty. */
export function coerceQty(qty: number, unit: string): { qty: number; unit: string; bucket: QtyBucket } {
  const u = normalizeUnit(unit);
  const bucket = qtyBucket(u);

  if (bucket === "volume") {
    const tsp = qty * (VOLUME_TO_TSP[u] ?? 1);
    if (tsp >= 48 && tsp % 48 < 0.05) return { qty: Math.round((tsp / 48) * 100) / 100, unit: "cup", bucket };
    if (tsp >= 3 && tsp % 3 < 0.05) return { qty: Math.round((tsp / 3) * 100) / 100, unit: "tbsp", bucket };
    return { qty: Math.round(tsp * 100) / 100, unit: "tsp", bucket };
  }

  if (bucket === "weight") {
    const g = qty * (WEIGHT_TO_G[u] ?? 1);
    if (g >= 1000) return { qty: Math.round((g / 1000) * 100) / 100, unit: "kg", bucket };
    return { qty: Math.round(g * 100) / 100, unit: "g", bucket };
  }

  if (bucket === "count") {
    return { qty, unit: normalizeUnit(u), bucket };
  }

  return { qty, unit: u, bucket };
}

/** Convert two quantities in the same bucket into a shared display unit and sum. */
export function addCompatibleQty(
  aQty: number,
  aUnit: string,
  bQty: number,
  bUnit: string,
): { qty: number; unit: string } | null {
  const a = coerceQty(aQty, aUnit);
  const b = coerceQty(bQty, bUnit);
  if (a.bucket !== b.bucket || a.bucket === "other") {
    if (normalizeUnit(aUnit) === normalizeUnit(bUnit)) {
      return { qty: aQty + bQty, unit: normalizeUnit(aUnit) };
    }
    return null;
  }

  if (a.bucket === "volume") {
    const tsp =
      aQty * (VOLUME_TO_TSP[normalizeUnit(aUnit)] ?? 0) + bQty * (VOLUME_TO_TSP[normalizeUnit(bUnit)] ?? 0);
    if (tsp >= 48) return { qty: Math.round((tsp / 48) * 100) / 100, unit: "cup" };
    if (tsp >= 3) return { qty: Math.round((tsp / 3) * 100) / 100, unit: "tbsp" };
    return { qty: Math.round(tsp * 100) / 100, unit: "tsp" };
  }

  if (a.bucket === "weight") {
    const g =
      aQty * (WEIGHT_TO_G[normalizeUnit(aUnit)] ?? 0) + bQty * (WEIGHT_TO_G[normalizeUnit(bUnit)] ?? 0);
    return { qty: Math.round(g * 100) / 100, unit: "g" };
  }

  // count — treat clove/ea/handful as same only when units match after normalize
  if (normalizeUnit(aUnit) === normalizeUnit(bUnit) || (a.unit === "ea" && b.unit === "ea")) {
    return { qty: aQty + bQty, unit: a.unit === "ea" || b.unit === "ea" ? "ea" : a.unit };
  }
  // clove + ea for garlic-like items: sum as ea
  if (
    (a.unit === "clove" || a.unit === "ea") &&
    (b.unit === "clove" || b.unit === "ea")
  ) {
    return { qty: aQty + bQty, unit: "ea" };
  }
  return null;
}
