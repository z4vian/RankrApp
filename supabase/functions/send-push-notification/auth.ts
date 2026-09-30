/** Dedicated server credential; intentionally independent of client JWT auth. */
export async function authorizePush(secret: string | undefined, supplied: string): Promise<200 | 401 | 503> {
  if (!secret || secret.length < 32) return 503;
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(secret), digest(supplied)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference ? 401 : 200;
}
