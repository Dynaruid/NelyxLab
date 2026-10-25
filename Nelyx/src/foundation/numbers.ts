import { invariant } from "./errors.ts";
export function finite(value: number, name: string): number {
  invariant(Number.isFinite(value), "invalid-number", `${name} must be finite`); return value;
}
export function generation(value: number): number {
  if(!(Number.isSafeInteger(value) && value > 0))invariant(false,"invalid-generation","generation must be a positive safe integer"); return value;
}
