// SPDX-License-Identifier: BSD-3-Clause
// Pre-sharing numeric program construction, retained only as a test oracle.
const unsupportedQuery = [
  { kind: 'assert', values: [0] },
  { kind: 'result', values: [0] },
];
const program = (children, layout) => ({
  children,
  layout,
  minWidth: unsupportedQuery,
  maxWidth: unsupportedQuery,
  minHeight: unsupportedQuery,
  maxHeight: unsupportedQuery,
});
export function referenceGridPrograms(
  policy,
  count,
  rtl,
  { input, expression, immutableSceneData },
) {
  const { columns, rows, maximumRowExtent } = policy;
  const rowCount = Math.ceil(count / columns);
  const extent = expression('min', maximumRowExtent, expression('divide', input.maxHeight, rows));
  const height = expression('multiply', extent, rowCount);
  const viewport = program(1, [
    { kind: 'assert', values: [expression('finite', input.maxWidth)] },
    { kind: 'assert', values: [expression('finite', input.maxHeight)] },
    {
      kind: 'layout',
      child: 0,
      target: 0,
      values: [input.maxWidth, input.maxWidth, height, height],
    },
    { kind: 'position', child: 0, values: [0, 0] },
    { kind: 'size', values: [input.maxWidth, input.maxHeight] },
  ]);
  const width = expression('divide', input.maxWidth, columns);
  const tileHeight = rowCount ? expression('divide', input.maxHeight, rowCount) : 0;
  const layout = [];
  for (let index = 0; index < count; ++index) {
    const column = rtl ? columns - 1 - (index % columns) : index % columns;
    layout.push(
      { kind: 'layout', child: index, target: 0, values: [width, width, tileHeight, tileHeight] },
      {
        kind: 'position',
        child: index,
        values: [
          expression('multiply', width, column),
          expression('multiply', tileHeight, Math.floor(index / columns)),
        ],
      },
    );
  }
  layout.push({ kind: 'size', values: [input.maxWidth, input.maxHeight] });
  return immutableSceneData({ viewport, tiles: program(count, layout) });
}
