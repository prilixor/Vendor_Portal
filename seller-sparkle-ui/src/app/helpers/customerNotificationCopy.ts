/**
 * Customers only ever deal with BlinksMed, but notification titles and bodies are
 * written by the backend and stored, so historic rows still name the vendor.
 * Rewriting on read keeps existing notifications compliant without a migration.
 */
const PHRASE_REPLACEMENTS: readonly [RegExp, string][] = [
  [/\bawaiting vendor acceptance\b/gi, "awaiting confirmation"],
  [/\bpending vendor acceptance\b/gi, "awaiting confirmation"],
  [/\baccepted by a nearby vendor\b/gi, "confirmed"],
  [
    /\bOne vendor cancelled this item\.\s*We are notifying nearby vendors\.?/gi,
    "This item is being reassigned to keep your delivery on track.",
  ],
];

export function customerNotificationCopy(text: string | null | undefined): string {
  let out = text ?? "";
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // Safety net for any wording the phrase map above does not cover yet.
  return out.replace(/\bvendors?\b/gi, "BlinksMed");
}
