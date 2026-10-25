/** Bounds-checked reads at CanvasKit/typed-array and matrix boundaries. */
export function arrayItem<Value>(values:{readonly [index:number]:Value},index:number):Value {
  const value=values[index];
  if(value===undefined)throw new RangeError('Skia array index is outside its native buffer');
  return value;
}
