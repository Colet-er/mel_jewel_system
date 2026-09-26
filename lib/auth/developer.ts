import "server-only";

const DEFAULT_DEVELOPER_EMAILS = [
  "diannatolentino03@gmail.com",
  "asiadeveloper@gmail.com",
];

export function isDeveloperEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const rawEnv = [
    process.env.DEVELOPER_EMAILS,
    process.env.DEVELOPER_EMAIL,
    process.env.NEXT_PUBLIC_DEVELOPER_EMAILS,
  ]
    .filter(Boolean)
    .join(",");

  const parsedEnvEmails = rawEnv
    .split(/[,;\s]+/)
    .map((val) => val.trim().replace(/^['"]|['"]$/g, "").toLocaleLowerCase())
    .filter(Boolean);

  const allowed = new Set([
    ...DEFAULT_DEVELOPER_EMAILS.map((e) => e.toLocaleLowerCase()),
    ...parsedEnvEmails,
  ]);

  return allowed.has(email.trim().toLocaleLowerCase());
}
