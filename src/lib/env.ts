function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const serverEnv = {
  get SUPABASE_URL() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get APP_PASSWORD_HASH() {
    return required("APP_PASSWORD_HASH");
  },
  get AUTH_SECRET() {
    return required("AUTH_SECRET");
  },
};
