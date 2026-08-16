import { cache } from "react";
import { createClient } from "./get-query-client";

// インスタンスを複数クライアント間で使いまわさないためにcasheをつける
export const getServerQueryClient = cache(createClient);
