function requireEnv(value: string | undefined) {
  if (!value) throw new Error("envの中身が空です！");
  return value;
}

export const API_BASE_URL = requireEnv(process.env.NEXT_PUBLIC_API_BASE_URL);
