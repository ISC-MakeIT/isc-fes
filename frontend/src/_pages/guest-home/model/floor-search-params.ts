import { parseAsNumberLiteral } from "nuqs";
import { defaultFloor, floorLevels } from "./types";

export const floorParser = parseAsNumberLiteral(floorLevels)
  .withDefault(defaultFloor)
  .withOptions({
    history: "replace",
    clearOnDefault: false,
  });
