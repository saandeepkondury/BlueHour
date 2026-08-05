export type Slot =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "fuel_pre"
  | "fuel_during"
  | "fuel_post";

export type Diet = "vegan" | "vegetarian" | "omnivore";

export type Allergen = "dairy" | "gluten" | "nuts" | "egg" | "soy" | "fish" | "shellfish";

export type Aisle = "produce" | "protein" | "dairy" | "pantry" | "frozen" | "bakery" | "fuel";

export interface Ingredient {
  item: string;
  qty: number;
  unit: string;
  aisle: Aisle;
}

export interface Recipe {
  id: string;
  name: string;
  slot: Slot;
  diet: Diet;
  allergens: Allergen[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  minutes: number;
  note: string;
  steps: string[];
  ingredients: Ingredient[];
}

export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  fuel_pre: "Pre-run fuel",
  fuel_during: "On the run",
  fuel_post: "Recovery",
};

export const MEAL_SLOTS: Slot[] = ["breakfast", "lunch", "dinner", "snack"];

export const RECIPES: Recipe[] = [
  // ---------- breakfast ----------
  {
    id: "austin-breakfast-tacos",
    name: "Austin breakfast tacos",
    slot: "breakfast",
    diet: "omnivore",
    allergens: ["egg", "dairy", "gluten"],
    calories: 520,
    protein: 30,
    carbs: 48,
    fat: 22,
    minutes: 12,
    note: "The correct Austin breakfast. Scramble soft, salsa generously.",
    steps: [
      "Scramble the eggs low and slow with a splash of milk.",
      "Warm the tortillas directly on the burner until they blister.",
      "Fill with eggs, cheese, black beans, and salsa.",
    ],
    ingredients: [
      { item: "Eggs", qty: 3, unit: "ea", aisle: "protein" },
      { item: "Flour tortillas", qty: 2, unit: "ea", aisle: "bakery" },
      { item: "Shredded cheddar", qty: 0.25, unit: "cup", aisle: "dairy" },
      { item: "Black beans", qty: 0.33, unit: "cup", aisle: "pantry" },
      { item: "Salsa", qty: 2, unit: "tbsp", aisle: "pantry" },
    ],
  },
  {
    id: "oatmeal-pb-banana",
    name: "Oatmeal, peanut butter, banana",
    slot: "breakfast",
    diet: "vegan",
    allergens: ["nuts", "gluten"],
    calories: 480,
    protein: 15,
    carbs: 72,
    fat: 15,
    minutes: 8,
    note: "Cheap, boring, works. The default pre-long-run breakfast.",
    steps: [
      "Simmer oats in water or soy milk for 5 minutes.",
      "Stir in peanut butter and cinnamon.",
      "Top with sliced banana and a drizzle of maple syrup.",
    ],
    ingredients: [
      { item: "Rolled oats", qty: 0.75, unit: "cup", aisle: "pantry" },
      { item: "Peanut butter", qty: 1.5, unit: "tbsp", aisle: "pantry" },
      { item: "Banana", qty: 1, unit: "ea", aisle: "produce" },
      { item: "Maple syrup", qty: 1, unit: "tsp", aisle: "pantry" },
    ],
  },
  {
    id: "yogurt-berries-granola",
    name: "Greek yogurt, berries, granola",
    slot: "breakfast",
    diet: "vegetarian",
    allergens: ["dairy", "gluten", "nuts"],
    calories: 430,
    protein: 27,
    carbs: 52,
    fat: 11,
    minutes: 4,
    note: "No cooking, high protein, good on a rest day.",
    steps: ["Spoon yogurt into a bowl.", "Top with berries, granola, and honey."],
    ingredients: [
      { item: "Greek yogurt (plain, 2%)", qty: 1, unit: "cup", aisle: "dairy" },
      { item: "Mixed berries", qty: 0.75, unit: "cup", aisle: "produce" },
      { item: "Granola", qty: 0.33, unit: "cup", aisle: "pantry" },
      { item: "Honey", qty: 1, unit: "tsp", aisle: "pantry" },
    ],
  },
  {
    id: "migas-bowl",
    name: "Migas bowl",
    slot: "breakfast",
    diet: "vegetarian",
    allergens: ["egg", "dairy", "gluten"],
    calories: 500,
    protein: 24,
    carbs: 46,
    fat: 24,
    minutes: 15,
    note: "Crispy tortilla strips folded into eggs. Weekend energy.",
    steps: [
      "Fry torn corn tortillas in a little oil until crisp.",
      "Add beaten eggs, onion, and jalapeno; scramble.",
      "Finish with cheese and avocado.",
    ],
    ingredients: [
      { item: "Eggs", qty: 3, unit: "ea", aisle: "protein" },
      { item: "Corn tortillas", qty: 2, unit: "ea", aisle: "bakery" },
      { item: "Cotija or cheddar", qty: 0.25, unit: "cup", aisle: "dairy" },
      { item: "Avocado", qty: 0.5, unit: "ea", aisle: "produce" },
      { item: "Jalapeno", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },
  {
    id: "tofu-scramble-toast",
    name: "Tofu scramble on sourdough",
    slot: "breakfast",
    diet: "vegan",
    allergens: ["soy", "gluten"],
    calories: 450,
    protein: 26,
    carbs: 44,
    fat: 18,
    minutes: 14,
    note: "Turmeric and nutritional yeast do the heavy lifting.",
    steps: [
      "Crumble firm tofu into a hot pan with olive oil.",
      "Season with turmeric, nutritional yeast, salt, and black pepper.",
      "Add spinach at the end; serve on toasted sourdough.",
    ],
    ingredients: [
      { item: "Firm tofu", qty: 200, unit: "g", aisle: "protein" },
      { item: "Sourdough bread", qty: 2, unit: "slice", aisle: "bakery" },
      { item: "Spinach", qty: 2, unit: "cup", aisle: "produce" },
      { item: "Nutritional yeast", qty: 1, unit: "tbsp", aisle: "pantry" },
    ],
  },
  {
    id: "protein-smoothie",
    name: "Banana-berry protein smoothie",
    slot: "breakfast",
    diet: "vegetarian",
    allergens: ["dairy"],
    calories: 410,
    protein: 34,
    carbs: 52,
    fat: 7,
    minutes: 3,
    note: "For mornings when chewing feels like too much.",
    steps: ["Blend everything with ice until smooth."],
    ingredients: [
      { item: "Whey protein powder", qty: 1, unit: "scoop", aisle: "pantry" },
      { item: "Banana", qty: 1, unit: "ea", aisle: "produce" },
      { item: "Frozen berries", qty: 1, unit: "cup", aisle: "frozen" },
      { item: "Milk", qty: 1, unit: "cup", aisle: "dairy" },
    ],
  },
  {
    id: "cottage-cheese-toast",
    name: "Cottage cheese toast with egg",
    slot: "breakfast",
    diet: "vegetarian",
    allergens: ["dairy", "gluten", "egg"],
    calories: 440,
    protein: 34,
    carbs: 40,
    fat: 15,
    minutes: 10,
    note: "Highest protein-per-minute breakfast on the list.",
    steps: [
      "Toast the bread and spread cottage cheese thickly.",
      "Fry an egg and slide it on top.",
      "Crack black pepper and add tomato slices.",
    ],
    ingredients: [
      { item: "Cottage cheese", qty: 0.75, unit: "cup", aisle: "dairy" },
      { item: "Whole grain bread", qty: 2, unit: "slice", aisle: "bakery" },
      { item: "Eggs", qty: 1, unit: "ea", aisle: "protein" },
      { item: "Tomato", qty: 0.5, unit: "ea", aisle: "produce" },
    ],
  },

  // ---------- lunch ----------
  {
    id: "chicken-rice-bowl",
    name: "Chicken and rice bowl",
    slot: "lunch",
    diet: "omnivore",
    allergens: [],
    calories: 620,
    protein: 46,
    carbs: 70,
    fat: 16,
    minutes: 20,
    note: "Batch the chicken and rice on Sunday; this becomes a 4-minute lunch.",
    steps: [
      "Season and sear chicken breast, then slice.",
      "Pile over rice with roasted vegetables.",
      "Finish with olive oil, lemon, and salt.",
    ],
    ingredients: [
      { item: "Chicken breast", qty: 170, unit: "g", aisle: "protein" },
      { item: "Jasmine rice (dry)", qty: 0.75, unit: "cup", aisle: "pantry" },
      { item: "Bell pepper", qty: 1, unit: "ea", aisle: "produce" },
      { item: "Broccoli", qty: 1.5, unit: "cup", aisle: "produce" },
      { item: "Olive oil", qty: 1, unit: "tbsp", aisle: "pantry" },
    ],
  },
  {
    id: "turkey-avocado-sandwich",
    name: "Turkey avocado sandwich",
    slot: "lunch",
    diet: "omnivore",
    allergens: ["gluten"],
    calories: 560,
    protein: 38,
    carbs: 52,
    fat: 22,
    minutes: 7,
    note: "Assembly, not cooking.",
    steps: [
      "Layer turkey, avocado, tomato, and greens on whole grain bread.",
      "Mustard, not mayo, if you want the fat lower.",
    ],
    ingredients: [
      { item: "Sliced turkey breast", qty: 140, unit: "g", aisle: "protein" },
      { item: "Whole grain bread", qty: 2, unit: "slice", aisle: "bakery" },
      { item: "Avocado", qty: 0.5, unit: "ea", aisle: "produce" },
      { item: "Mixed greens", qty: 1, unit: "cup", aisle: "produce" },
    ],
  },
  {
    id: "salmon-quinoa-bowl",
    name: "Salmon quinoa bowl",
    slot: "lunch",
    diet: "omnivore",
    allergens: ["fish"],
    calories: 620,
    protein: 41,
    carbs: 56,
    fat: 24,
    minutes: 22,
    note: "Omega-3s on a heavy training week.",
    steps: [
      "Roast salmon at 425F for 12 minutes.",
      "Toss quinoa with cucumber, lemon, and olive oil.",
      "Flake the salmon over the top.",
    ],
    ingredients: [
      { item: "Salmon fillet", qty: 170, unit: "g", aisle: "protein" },
      { item: "Quinoa (dry)", qty: 0.5, unit: "cup", aisle: "pantry" },
      { item: "Cucumber", qty: 1, unit: "ea", aisle: "produce" },
      { item: "Lemon", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },
  {
    id: "chickpea-feta-pita",
    name: "Chickpea and feta salad with pita",
    slot: "lunch",
    diet: "vegetarian",
    allergens: ["dairy", "gluten"],
    calories: 550,
    protein: 23,
    carbs: 64,
    fat: 22,
    minutes: 10,
    note: "No stove required. Good on a hot Austin afternoon.",
    steps: [
      "Toss chickpeas, cucumber, tomato, and red onion.",
      "Crumble feta over, dress with olive oil and lemon.",
      "Scoop with warm pita.",
    ],
    ingredients: [
      { item: "Chickpeas (canned)", qty: 1, unit: "can", aisle: "pantry" },
      { item: "Feta", qty: 60, unit: "g", aisle: "dairy" },
      { item: "Cucumber", qty: 1, unit: "ea", aisle: "produce" },
      { item: "Pita bread", qty: 1, unit: "ea", aisle: "bakery" },
      { item: "Red onion", qty: 0.25, unit: "ea", aisle: "produce" },
    ],
  },
  {
    id: "black-bean-sweet-potato",
    name: "Black bean and sweet potato bowl",
    slot: "lunch",
    diet: "vegan",
    allergens: [],
    calories: 540,
    protein: 20,
    carbs: 84,
    fat: 13,
    minutes: 30,
    note: "Carb-dense — line this up the day before a long run.",
    steps: [
      "Roast cubed sweet potato at 425F for 25 minutes.",
      "Warm black beans with cumin and lime.",
      "Build over rice with avocado and salsa.",
    ],
    ingredients: [
      { item: "Sweet potato", qty: 1, unit: "ea", aisle: "produce" },
      { item: "Black beans (canned)", qty: 1, unit: "can", aisle: "pantry" },
      { item: "Brown rice (dry)", qty: 0.5, unit: "cup", aisle: "pantry" },
      { item: "Avocado", qty: 0.5, unit: "ea", aisle: "produce" },
      { item: "Lime", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },
  {
    id: "lentil-soup-sourdough",
    name: "Lentil soup with sourdough",
    slot: "lunch",
    diet: "vegan",
    allergens: ["gluten"],
    calories: 490,
    protein: 25,
    carbs: 72,
    fat: 9,
    minutes: 35,
    note: "Makes four servings. Freeze the rest.",
    steps: [
      "Sweat onion, carrot, and celery in olive oil.",
      "Add lentils, tomatoes, and stock; simmer 25 minutes.",
      "Season hard with salt, pepper, and vinegar.",
    ],
    ingredients: [
      { item: "Brown lentils (dry)", qty: 1, unit: "cup", aisle: "pantry" },
      { item: "Diced tomatoes", qty: 1, unit: "can", aisle: "pantry" },
      { item: "Carrots", qty: 2, unit: "ea", aisle: "produce" },
      { item: "Onion", qty: 1, unit: "ea", aisle: "produce" },
      { item: "Sourdough bread", qty: 2, unit: "slice", aisle: "bakery" },
    ],
  },
  {
    id: "tuna-white-bean-salad",
    name: "Tuna and white bean salad",
    slot: "lunch",
    diet: "omnivore",
    allergens: ["fish"],
    calories: 470,
    protein: 39,
    carbs: 42,
    fat: 16,
    minutes: 8,
    note: "Pantry lunch when the fridge is empty.",
    steps: [
      "Drain tuna and white beans into a bowl.",
      "Add olive oil, lemon, parsley, and red onion.",
      "Eat over greens or with crackers.",
    ],
    ingredients: [
      { item: "Canned tuna", qty: 2, unit: "can", aisle: "pantry" },
      { item: "Cannellini beans", qty: 1, unit: "can", aisle: "pantry" },
      { item: "Parsley", qty: 0.25, unit: "cup", aisle: "produce" },
      { item: "Lemon", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },

  // ---------- dinner ----------
  {
    id: "chicken-fajita-bowl",
    name: "Chicken fajita bowl",
    slot: "dinner",
    diet: "omnivore",
    allergens: [],
    calories: 680,
    protein: 48,
    carbs: 66,
    fat: 22,
    minutes: 25,
    note: "Cast iron, high heat, char the peppers.",
    steps: [
      "Sear sliced chicken with fajita seasoning.",
      "Blister peppers and onions in the same pan.",
      "Serve over rice with salsa and a spoon of sour cream.",
    ],
    ingredients: [
      { item: "Chicken thighs", qty: 200, unit: "g", aisle: "protein" },
      { item: "Bell peppers", qty: 2, unit: "ea", aisle: "produce" },
      { item: "Onion", qty: 1, unit: "ea", aisle: "produce" },
      { item: "Jasmine rice (dry)", qty: 0.75, unit: "cup", aisle: "pantry" },
      { item: "Salsa", qty: 0.25, unit: "cup", aisle: "pantry" },
    ],
  },
  {
    id: "spaghetti-turkey-sauce",
    name: "Spaghetti with turkey meat sauce",
    slot: "dinner",
    diet: "omnivore",
    allergens: ["gluten"],
    calories: 720,
    protein: 45,
    carbs: 90,
    fat: 20,
    minutes: 30,
    note: "The classic night-before-a-long-run dinner.",
    steps: [
      "Brown ground turkey with garlic and oregano.",
      "Add marinara and simmer 15 minutes.",
      "Toss with spaghetti and finish with parmesan.",
    ],
    ingredients: [
      { item: "Ground turkey", qty: 200, unit: "g", aisle: "protein" },
      { item: "Spaghetti", qty: 115, unit: "g", aisle: "pantry" },
      { item: "Marinara sauce", qty: 1.5, unit: "cup", aisle: "pantry" },
      { item: "Parmesan", qty: 2, unit: "tbsp", aisle: "dairy" },
      { item: "Garlic", qty: 3, unit: "clove", aisle: "produce" },
    ],
  },
  {
    id: "salmon-sweet-potato-greens",
    name: "Salmon, sweet potato, greens",
    slot: "dinner",
    diet: "omnivore",
    allergens: ["fish"],
    calories: 650,
    protein: 43,
    carbs: 55,
    fat: 26,
    minutes: 30,
    note: "One sheet pan, one bowl to wash.",
    steps: [
      "Roast sweet potato wedges 25 minutes at 425F.",
      "Add salmon to the pan for the last 12 minutes.",
      "Wilt kale in olive oil with garlic.",
    ],
    ingredients: [
      { item: "Salmon fillet", qty: 170, unit: "g", aisle: "protein" },
      { item: "Sweet potato", qty: 1, unit: "ea", aisle: "produce" },
      { item: "Kale", qty: 3, unit: "cup", aisle: "produce" },
      { item: "Garlic", qty: 2, unit: "clove", aisle: "produce" },
    ],
  },
  {
    id: "shrimp-tacos",
    name: "Shrimp tacos with slaw",
    slot: "dinner",
    diet: "omnivore",
    allergens: ["shellfish", "gluten"],
    calories: 600,
    protein: 40,
    carbs: 62,
    fat: 19,
    minutes: 20,
    note: "Fast, light, and it still feels like a treat.",
    steps: [
      "Toss shrimp with chili powder and sear 3 minutes.",
      "Mix cabbage with lime and a little yogurt.",
      "Build tacos, hit with hot sauce.",
    ],
    ingredients: [
      { item: "Shrimp", qty: 200, unit: "g", aisle: "protein" },
      { item: "Corn tortillas", qty: 3, unit: "ea", aisle: "bakery" },
      { item: "Cabbage slaw mix", qty: 2, unit: "cup", aisle: "produce" },
      { item: "Lime", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },
  {
    id: "tofu-stir-fry-rice",
    name: "Tofu stir-fry with rice",
    slot: "dinner",
    diet: "vegan",
    allergens: ["soy"],
    calories: 620,
    protein: 29,
    carbs: 84,
    fat: 18,
    minutes: 22,
    note: "Press the tofu or it will steam instead of brown.",
    steps: [
      "Press and cube tofu; sear until golden.",
      "Stir-fry vegetables hot and fast.",
      "Add soy, garlic, ginger; serve over rice.",
    ],
    ingredients: [
      { item: "Firm tofu", qty: 250, unit: "g", aisle: "protein" },
      { item: "Jasmine rice (dry)", qty: 0.75, unit: "cup", aisle: "pantry" },
      { item: "Stir-fry vegetables", qty: 3, unit: "cup", aisle: "produce" },
      { item: "Soy sauce", qty: 2, unit: "tbsp", aisle: "pantry" },
      { item: "Ginger", qty: 1, unit: "tbsp", aisle: "produce" },
    ],
  },
  {
    id: "veggie-chili-cornbread",
    name: "Veggie chili with cornbread",
    slot: "dinner",
    diet: "vegetarian",
    allergens: ["gluten", "dairy"],
    calories: 640,
    protein: 27,
    carbs: 92,
    fat: 18,
    minutes: 40,
    note: "Cooks a big batch. Better on day two.",
    steps: [
      "Sweat onion, pepper, and garlic.",
      "Add beans, tomatoes, chili powder, cumin; simmer 25 minutes.",
      "Serve with cornbread and a spoon of yogurt.",
    ],
    ingredients: [
      { item: "Kidney beans (canned)", qty: 1, unit: "can", aisle: "pantry" },
      { item: "Black beans (canned)", qty: 1, unit: "can", aisle: "pantry" },
      { item: "Crushed tomatoes", qty: 1, unit: "can", aisle: "pantry" },
      { item: "Cornbread mix", qty: 1, unit: "box", aisle: "pantry" },
      { item: "Bell pepper", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },
  {
    id: "ravioli-marinara",
    name: "Cheese ravioli with marinara and salad",
    slot: "dinner",
    diet: "vegetarian",
    allergens: ["dairy", "gluten", "egg"],
    calories: 640,
    protein: 27,
    carbs: 88,
    fat: 20,
    minutes: 15,
    note: "Ten-minute carb load when the week has beaten you.",
    steps: [
      "Boil ravioli 4 minutes.",
      "Warm marinara with olive oil and basil.",
      "Serve with a dressed green salad.",
    ],
    ingredients: [
      { item: "Cheese ravioli", qty: 250, unit: "g", aisle: "frozen" },
      { item: "Marinara sauce", qty: 1.5, unit: "cup", aisle: "pantry" },
      { item: "Mixed greens", qty: 2, unit: "cup", aisle: "produce" },
      { item: "Parmesan", qty: 2, unit: "tbsp", aisle: "dairy" },
    ],
  },
  {
    id: "chicken-potatoes-broccoli",
    name: "Roast chicken thighs, potatoes, broccoli",
    slot: "dinner",
    diet: "omnivore",
    allergens: [],
    calories: 660,
    protein: 46,
    carbs: 58,
    fat: 25,
    minutes: 45,
    note: "Roast extra chicken for tomorrow's lunch bowl.",
    steps: [
      "Toss potatoes in oil and salt; roast at 425F for 20 minutes.",
      "Add chicken thighs, roast 25 minutes more.",
      "Steam broccoli and dress with lemon.",
    ],
    ingredients: [
      { item: "Chicken thighs", qty: 250, unit: "g", aisle: "protein" },
      { item: "Baby potatoes", qty: 400, unit: "g", aisle: "produce" },
      { item: "Broccoli", qty: 2, unit: "cup", aisle: "produce" },
      { item: "Lemon", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },

  // ---------- snacks ----------
  {
    id: "banana-pb",
    name: "Banana with peanut butter",
    slot: "snack",
    diet: "vegan",
    allergens: ["nuts"],
    calories: 270,
    protein: 8,
    carbs: 34,
    fat: 12,
    minutes: 1,
    note: "The default.",
    steps: ["Slice banana, add peanut butter."],
    ingredients: [
      { item: "Banana", qty: 1, unit: "ea", aisle: "produce" },
      { item: "Peanut butter", qty: 1.5, unit: "tbsp", aisle: "pantry" },
    ],
  },
  {
    id: "yogurt-honey",
    name: "Greek yogurt with honey",
    slot: "snack",
    diet: "vegetarian",
    allergens: ["dairy"],
    calories: 230,
    protein: 21,
    carbs: 28,
    fat: 3,
    minutes: 1,
    note: "Cheapest way to close a protein gap.",
    steps: ["Spoon yogurt, drizzle honey."],
    ingredients: [
      { item: "Greek yogurt (plain, 2%)", qty: 0.75, unit: "cup", aisle: "dairy" },
      { item: "Honey", qty: 1, unit: "tbsp", aisle: "pantry" },
    ],
  },
  {
    id: "trail-mix",
    name: "Trail mix",
    slot: "snack",
    diet: "vegan",
    allergens: ["nuts"],
    calories: 300,
    protein: 9,
    carbs: 28,
    fat: 18,
    minutes: 1,
    note: "Portion it out or the bag disappears.",
    steps: ["Measure a small handful. Actually measure it."],
    ingredients: [
      { item: "Trail mix", qty: 0.33, unit: "cup", aisle: "pantry" },
    ],
  },
  {
    id: "hummus-pita-carrots",
    name: "Hummus, pita, carrots",
    slot: "snack",
    diet: "vegan",
    allergens: ["gluten"],
    calories: 280,
    protein: 9,
    carbs: 38,
    fat: 10,
    minutes: 3,
    note: "Salty and carby, good after an afternoon run.",
    steps: ["Cut pita, scoop hummus, crunch carrots."],
    ingredients: [
      { item: "Hummus", qty: 0.33, unit: "cup", aisle: "pantry" },
      { item: "Pita bread", qty: 1, unit: "ea", aisle: "bakery" },
      { item: "Carrots", qty: 2, unit: "ea", aisle: "produce" },
    ],
  },
  {
    id: "rice-cakes-almond-butter",
    name: "Rice cakes with almond butter",
    slot: "snack",
    diet: "vegan",
    allergens: ["nuts"],
    calories: 260,
    protein: 7,
    carbs: 34,
    fat: 12,
    minutes: 2,
    note: "Sits light before an evening run.",
    steps: ["Spread almond butter on rice cakes; add banana coins."],
    ingredients: [
      { item: "Rice cakes", qty: 2, unit: "ea", aisle: "pantry" },
      { item: "Almond butter", qty: 1.5, unit: "tbsp", aisle: "pantry" },
    ],
  },
  {
    id: "jerky-apple",
    name: "Beef jerky and an apple",
    slot: "snack",
    diet: "omnivore",
    allergens: [],
    calories: 240,
    protein: 20,
    carbs: 30,
    fat: 3,
    minutes: 1,
    note: "Protein you can keep in a bag.",
    steps: ["Eat jerky. Eat apple."],
    ingredients: [
      { item: "Beef jerky", qty: 50, unit: "g", aisle: "protein" },
      { item: "Apple", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },

  // ---------- fuel: pre ----------
  {
    id: "toast-honey-banana",
    name: "Toast with honey and banana",
    slot: "fuel_pre",
    diet: "vegan",
    allergens: ["gluten"],
    calories: 300,
    protein: 6,
    carbs: 62,
    fat: 3,
    minutes: 4,
    note: "Low fiber, low fat, easy to digest 60–90 minutes out.",
    steps: ["Toast bread, spread honey, add banana slices.", "Sip water alongside."],
    ingredients: [
      { item: "White or sourdough bread", qty: 2, unit: "slice", aisle: "bakery" },
      { item: "Honey", qty: 1, unit: "tbsp", aisle: "pantry" },
      { item: "Banana", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },
  {
    id: "quick-oats-maple",
    name: "Quick oats with maple",
    slot: "fuel_pre",
    diet: "vegan",
    allergens: ["gluten"],
    calories: 320,
    protein: 8,
    carbs: 60,
    fat: 6,
    minutes: 5,
    note: "Skip the peanut butter on race morning — fat slows things down.",
    steps: ["Microwave oats with water 90 seconds.", "Stir in maple syrup and salt."],
    ingredients: [
      { item: "Quick oats", qty: 0.5, unit: "cup", aisle: "pantry" },
      { item: "Maple syrup", qty: 1, unit: "tbsp", aisle: "pantry" },
    ],
  },
  {
    id: "bagel-jam",
    name: "Bagel with jam",
    slot: "fuel_pre",
    diet: "vegan",
    allergens: ["gluten"],
    calories: 340,
    protein: 10,
    carbs: 68,
    fat: 3,
    minutes: 3,
    note: "The most reliable race-morning breakfast in running.",
    steps: ["Toast half a bagel, spread jam.", "Coffee if that is your normal routine."],
    ingredients: [
      { item: "Bagel", qty: 1, unit: "ea", aisle: "bakery" },
      { item: "Jam", qty: 1, unit: "tbsp", aisle: "pantry" },
    ],
  },

  // ---------- fuel: during ----------
  {
    id: "gel",
    name: "Energy gel",
    slot: "fuel_during",
    diet: "vegan",
    allergens: [],
    calories: 100,
    protein: 0,
    carbs: 25,
    fat: 0,
    minutes: 0,
    note: "Take with a few sips of water, never dry.",
    steps: ["One gel at 45 minutes, then every 25–30 minutes."],
    ingredients: [{ item: "Energy gels", qty: 4, unit: "ea", aisle: "fuel" }],
  },
  {
    id: "chews",
    name: "Energy chews",
    slot: "fuel_during",
    diet: "vegan",
    allergens: [],
    calories: 90,
    protein: 0,
    carbs: 23,
    fat: 0,
    minutes: 0,
    note: "Easier on the stomach than gels for some people. Test in training.",
    steps: ["Three or four chews every 25 minutes."],
    ingredients: [{ item: "Energy chews", qty: 2, unit: "pack", aisle: "fuel" }],
  },
  {
    id: "sports-drink",
    name: "Sports drink",
    slot: "fuel_during",
    diet: "vegan",
    allergens: [],
    calories: 80,
    protein: 0,
    carbs: 21,
    fat: 0,
    minutes: 0,
    note: "Carbs plus sodium in one bottle — useful in Austin humidity.",
    steps: ["Sip every 15 minutes rather than gulping at aid stations."],
    ingredients: [{ item: "Sports drink mix", qty: 1, unit: "serving", aisle: "fuel" }],
  },

  // ---------- fuel: post ----------
  {
    id: "recovery-shake",
    name: "Recovery shake",
    slot: "fuel_post",
    diet: "vegetarian",
    allergens: ["dairy"],
    calories: 330,
    protein: 31,
    carbs: 40,
    fat: 5,
    minutes: 2,
    note: "Fastest way to hit the 30-minute window when you have no appetite.",
    steps: ["Blend protein powder, milk, banana, and ice."],
    ingredients: [
      { item: "Whey protein powder", qty: 1, unit: "scoop", aisle: "pantry" },
      { item: "Milk", qty: 1, unit: "cup", aisle: "dairy" },
      { item: "Banana", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },
  {
    id: "chocolate-milk",
    name: "Chocolate milk",
    slot: "fuel_post",
    diet: "vegetarian",
    allergens: ["dairy"],
    calories: 260,
    protein: 13,
    carbs: 42,
    fat: 5,
    minutes: 1,
    note: "Roughly the right carb-to-protein ratio by accident.",
    steps: ["Drink cold, within an hour of finishing."],
    ingredients: [{ item: "Chocolate milk", qty: 16, unit: "oz", aisle: "dairy" }],
  },
  {
    id: "vegan-recovery-shake",
    name: "Soy recovery shake",
    slot: "fuel_post",
    diet: "vegan",
    allergens: ["soy"],
    calories: 330,
    protein: 26,
    carbs: 46,
    fat: 6,
    minutes: 2,
    note: "Soy protein holds up as well as whey for recovery.",
    steps: ["Blend soy protein, soy milk, banana, and dates."],
    ingredients: [
      { item: "Soy protein powder", qty: 1, unit: "scoop", aisle: "pantry" },
      { item: "Soy milk", qty: 1, unit: "cup", aisle: "dairy" },
      { item: "Banana", qty: 1, unit: "ea", aisle: "produce" },
    ],
  },
  {
    id: "eggs-toast-recovery",
    name: "Eggs and toast",
    slot: "fuel_post",
    diet: "vegetarian",
    allergens: ["egg", "gluten"],
    calories: 420,
    protein: 26,
    carbs: 40,
    fat: 18,
    minutes: 10,
    note: "Real food beats a shake if your stomach is willing.",
    steps: ["Scramble three eggs.", "Toast two slices, salt everything."],
    ingredients: [
      { item: "Eggs", qty: 3, unit: "ea", aisle: "protein" },
      { item: "Whole grain bread", qty: 2, unit: "slice", aisle: "bakery" },
    ],
  },
];

const DIET_RANK: Record<Diet, number> = { vegan: 0, vegetarian: 1, omnivore: 2 };

export function recipeById(id: string | null | undefined): Recipe | undefined {
  if (!id) return undefined;
  return RECIPES.find((recipe) => recipe.id === id);
}

export function parseAllergies(input: string): Allergen[] {
  const text = input.toLowerCase();
  const all: Allergen[] = ["dairy", "gluten", "nuts", "egg", "soy", "fish", "shellfish"];
  const hits = all.filter((allergen) => text.includes(allergen));
  // Common phrasings that do not literally contain the tag.
  if (text.includes("lactose") && !hits.includes("dairy")) hits.push("dairy");
  if (text.includes("peanut") && !hits.includes("nuts")) hits.push("nuts");
  if (text.includes("wheat") && !hits.includes("gluten")) hits.push("gluten");
  if (text.includes("shrimp") && !hits.includes("shellfish")) hits.push("shellfish");
  return hits;
}

export function candidatesFor(slot: Slot, diet: Diet, allergies: Allergen[]): Recipe[] {
  const limit = DIET_RANK[diet];
  const filtered = RECIPES.filter(
    (recipe) =>
      recipe.slot === slot &&
      DIET_RANK[recipe.diet] <= limit &&
      !recipe.allergens.some((allergen) => allergies.includes(allergen)),
  );
  // Never leave a slot empty just because the filters were strict.
  return filtered.length > 0 ? filtered : RECIPES.filter((recipe) => recipe.slot === slot);
}
