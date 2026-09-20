import "server-only";

export function isDeveloperEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const allowed = (process.env.DEVELOPER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLocaleLowerCase())
    .filter(Boolean);

  return allowed.includes(email.toLocaleLowerCase());
}
