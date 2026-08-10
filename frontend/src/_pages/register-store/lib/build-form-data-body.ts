export function buildFormDataBody(body: object): FormData {
  const fd = new FormData();

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    fd.append(key, value);
  }
  return fd;
}
