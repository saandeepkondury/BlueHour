/**
 * A checkbox that is really a form submit button, so every toggle works as a
 * plain server action without shipping client JavaScript.
 */
export function CheckButton({
  action,
  checked,
  label,
  fields,
}: {
  action: (formData: FormData) => Promise<void>;
  checked: boolean;
  label: string;
  fields: Record<string, string | number>;
}) {
  return (
    <form action={action} className="check-form">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      <button
        type="submit"
        className="check-box"
        aria-pressed={checked}
        aria-label={checked ? `Undo: ${label}` : `Mark done: ${label}`}
        title={checked ? "Undo" : "Mark done"}
      />
    </form>
  );
}
