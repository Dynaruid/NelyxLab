// SPDX-License-Identifier: BSD-3-Clause
import type { CategoryId, ComponentDemo } from './catalog.ts';

export const cupertinoDemos: readonly ComponentDemo[] = [
  { id: 'buttons', category: 'actions', title: 'Cupertino buttons', status: 'ready' },
  { id: 'segmented', category: 'actions', title: 'Segmented controls', status: 'planned' },
  { id: 'context-menu', category: 'actions', title: 'Context menu', status: 'planned' },
  { id: 'activity', category: 'communication', title: 'Activity indicators', status: 'ready' },
  { id: 'lists', category: 'containment', title: 'Lists and sections', status: 'ready' },
  { id: 'dialog', category: 'containment', title: 'Alert dialog', status: 'basic' },
  { id: 'action-sheet', category: 'containment', title: 'Action sheet', status: 'planned' },
  { id: 'sheet', category: 'containment', title: 'Sheet', status: 'planned' },
  { id: 'refresh', category: 'containment', title: 'Sliver refresh', status: 'planned' },
  {
    id: 'navigation',
    category: 'navigation',
    title: 'Page scaffold and navigation bar',
    status: 'basic',
  },
  { id: 'tabs', category: 'navigation', title: 'Tabs and nested navigation', status: 'planned' },
  { id: 'switches', category: 'selection', title: 'Switches', status: 'ready' },
  { id: 'checkboxes', category: 'selection', title: 'Checkboxes', status: 'ready' },
  { id: 'radios', category: 'selection', title: 'Radio buttons', status: 'ready' },
  { id: 'sliders', category: 'selection', title: 'Sliders', status: 'ready' },
  { id: 'picker', category: 'selection', title: 'Wheel picker', status: 'planned' },
  { id: 'date-picker', category: 'selection', title: 'Date and time pickers', status: 'planned' },
  { id: 'text-field', category: 'text', title: 'Text field', status: 'basic' },
  { id: 'search', category: 'text', title: 'Search field', status: 'planned' },
  { id: 'form', category: 'text', title: 'Form rows and sections', status: 'planned' },
];

export function visibleCupertinoDemos(
  category: CategoryId | 'all',
  includePlanned: boolean,
): readonly ComponentDemo[] {
  return cupertinoDemos.filter(
    (demo) =>
      (category === 'all' || demo.category === category) &&
      (includePlanned || demo.status !== 'planned'),
  );
}
