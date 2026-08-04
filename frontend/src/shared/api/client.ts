import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { API_BASE_URL } from "../config/env";

export const client = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: "include",
});
