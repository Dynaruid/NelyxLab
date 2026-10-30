/** Structural value boundary; using it does not install a worklet runtime. */
export interface SharedValue<Value = unknown> {
  value: Value;
}
