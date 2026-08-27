function errorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: string }).code ?? "");
}

export function isUnverifiedEmailError(error: unknown): boolean {
  const code = errorCode(error);
  const message = error instanceof Error ? error.message : "";
  return code === "EMAIL_NOT_VERIFIED" || message.includes("EMAIL_NOT_VERIFIED");
}
