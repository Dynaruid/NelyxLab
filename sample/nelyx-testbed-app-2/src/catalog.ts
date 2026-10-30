// SPDX-License-Identifier: BSD-3-Clause
// Section order follows DorotiTestbedApp's Flutter-derived Components gallery.
export const categories = [
  { id: 'actions', title: 'Actions', description: '누르고, 선택하고, 실행하기' },
  { id: 'communication', title: 'Communication', description: '상태와 진행 상황 전달하기' },
  { id: 'containment', title: 'Containment', description: '콘텐츠를 묶고 구분하기' },
  { id: 'navigation', title: 'Navigation', description: '화면과 목적지 이동하기' },
  { id: 'selection', title: 'Selection', description: '값과 옵션 선택하기' },
  { id: 'text', title: 'Text inputs', description: '텍스트 입력하고 편집하기' },
  { id: 'images', title: 'Image demo', description: '앱에 포함된 이미지 표시하기' },
] as const;
export type CategoryId = (typeof categories)[number]['id'];
export interface ComponentDemo {
  readonly id: string;
  readonly category: CategoryId;
  readonly title: string;
  readonly status: 'ready' | 'basic' | 'planned';
}
export const demos: readonly ComponentDemo[] = [
  { id: 'buttons', category: 'actions', title: 'Common buttons', status: 'ready' },
  { id: 'fab', category: 'actions', title: 'Floating action buttons', status: 'planned' },
  { id: 'icon-buttons', category: 'actions', title: 'Icon buttons', status: 'ready' },
  { id: 'segmented', category: 'actions', title: 'Segmented buttons', status: 'planned' },
  { id: 'badges', category: 'communication', title: 'Badges', status: 'ready' },
  { id: 'progress', category: 'communication', title: 'Progress indicators', status: 'ready' },
  { id: 'snackbar', category: 'communication', title: 'Snackbar', status: 'planned' },
  { id: 'bottom-sheet', category: 'containment', title: 'Bottom sheet', status: 'planned' },
  { id: 'cards', category: 'containment', title: 'Cards', status: 'ready' },
  { id: 'carousel', category: 'containment', title: 'Carousel', status: 'planned' },
  { id: 'dialog', category: 'containment', title: 'Dialog', status: 'basic' },
  { id: 'dividers', category: 'containment', title: 'Dividers', status: 'ready' },
  { id: 'bottom-app-bar', category: 'navigation', title: 'Bottom app bar', status: 'planned' },
  { id: 'navigation-bar', category: 'navigation', title: 'Navigation bar', status: 'planned' },
  {
    id: 'navigation-drawer',
    category: 'navigation',
    title: 'Navigation drawer',
    status: 'planned',
  },
  { id: 'navigation-rail', category: 'navigation', title: 'Navigation rail', status: 'planned' },
  { id: 'tabs', category: 'navigation', title: 'Tabs', status: 'planned' },
  { id: 'search', category: 'navigation', title: 'Search', status: 'planned' },
  { id: 'top-app-bars', category: 'navigation', title: 'Top app bars', status: 'planned' },
  { id: 'checkboxes', category: 'selection', title: 'Checkboxes', status: 'ready' },
  { id: 'chips', category: 'selection', title: 'Chips', status: 'ready' },
  { id: 'date-picker', category: 'selection', title: 'Date picker', status: 'planned' },
  { id: 'time-picker', category: 'selection', title: 'Time picker', status: 'planned' },
  { id: 'menus', category: 'selection', title: 'Menus', status: 'planned' },
  { id: 'radios', category: 'selection', title: 'Radio buttons', status: 'ready' },
  { id: 'sliders', category: 'selection', title: 'Sliders', status: 'ready' },
  { id: 'switches', category: 'selection', title: 'Switches', status: 'ready' },
  { id: 'text-fields', category: 'text', title: 'Text fields', status: 'basic' },
  { id: 'image', category: 'images', title: 'Image demo', status: 'ready' },
];
export function visibleDemos(
  category: CategoryId | 'all',
  includePlanned: boolean,
): readonly ComponentDemo[] {
  return demos.filter(
    (demo) =>
      (category === 'all' || demo.category === category) &&
      (includePlanned || demo.status !== 'planned'),
  );
}
