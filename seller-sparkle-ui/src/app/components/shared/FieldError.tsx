/** Inline validation message under a form field. */
export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1 leading-snug">{message}</p>;
}
