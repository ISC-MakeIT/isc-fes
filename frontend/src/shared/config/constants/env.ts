function requireEnv(value: string | undefined) {
  if (!value) throw new Error("envの中身が空です！");
  return value;
}

export function getApiBaseUrl() {
  return requireEnv(process.env.NEXT_PUBLIC_API_BASE_URL);
}
