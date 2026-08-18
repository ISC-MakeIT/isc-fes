import { cache } from "react";
import { createClient } from "./create-query-client";

// インスタンスを複数クライアント間で使いまわさないためにcasheをつける
export const getServerQueryClient = cache(createClient);
