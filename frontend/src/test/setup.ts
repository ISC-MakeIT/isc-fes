import { vi } from "vitest";

const createMockFont = () => ({
  className: "mock-font",
  variable: "mock-font-variable",
  style: {
    fontFamily: "mock-font",
  },
});

vi.mock("next/font/google", () => ({
  DotGothic16: createMockFont,
  Geist: createMockFont,
  Geist_Mono: createMockFont,
}));
