import { createDefaultPreset } from "ts-jest";

const defaultPreset = createDefaultPreset();

/** @type {import("jest").Config} **/
export default {
  testEnvironment: "node",
  transform: {
    ...defaultPreset.transform,
  },
};