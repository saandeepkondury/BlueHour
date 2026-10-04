export function sumMacros(rows: { calories: number; protein: number; carbs: number; fat: number }[]) {
  return rows.reduce(
    (acc, row) => ({
      calories: acc.calories + row.calories,
      protein: acc.protein + row.protein,
      carbs: acc.carbs + row.carbs,
      fat: acc.fat + row.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
