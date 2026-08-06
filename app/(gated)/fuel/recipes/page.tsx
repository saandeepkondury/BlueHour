import { RecipeBrowser } from "@/components/RecipeBrowser";
import { startOfWeek, todayISO } from "@/lib/date";
import { buildBrowseCatalog } from "@/lib/nutrition/grocery";
import {
  candidatesFor,
  MEAL_SLOTS,
  parseAllergies,
  type Diet,
  type Slot,
} from "@/lib/nutrition/recipes";
import { getPantryHaveKeys, getProfile } from "@/lib/store";

export const dynamic = "force-dynamic";

const ALL_SLOTS: Slot[] = [
  ...MEAL_SLOTS,
  "fuel_pre",
  "fuel_during",
  "fuel_post",
];

export default async function FuelRecipesPage() {
  const today = todayISO();
  const weekStart = startOfWeek(today);
  const [profile, pantry] = await Promise.all([getProfile(), getPantryHaveKeys()]);
  const diet = profile.dietPref as Diet;
  const allergies = parseAllergies(profile.allergies);
  const allowedIds = new Set(
    ALL_SLOTS.flatMap((s) => candidatesFor(s, diet, allergies)).map((r) => r.id),
  );
  const catalog = buildBrowseCatalog(pantry, (recipe) => allowedIds.has(recipe.id));

  return (
    <RecipeBrowser
      weekStart={weekStart}
      today={today}
      catalog={catalog}
      hasPantry={pantry.size > 0}
    />
  );
}
