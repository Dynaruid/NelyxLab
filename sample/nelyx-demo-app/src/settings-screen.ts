// SPDX-License-Identifier: BSD-3-Clause
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Align, ConstrainedBox, Text } from '@nelyx/core/framework/widgets/basic';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { AppBar } from '@nelyx/material/app-bar';
import { DropdownMenu, DropdownMenuEntry } from '@nelyx/material/dropdown-menu';
import { InputDecoration } from '@nelyx/material/input-decoration';
import { Scaffold } from '@nelyx/material/scaffold';
import type {
  WebApplication,
  WebRenderMode,
  WebRenderPath,
} from '@nelyx/sdk/frontend/dom/application';
import { column } from './layout.ts';

export interface DemoRenderSettings {
  readonly mode: WebRenderMode;
  readonly application: ValueListenable<Pick<WebApplication, 'rendering'> | undefined>;
  readonly showOnStartup: boolean;
  readonly selectMode: (mode: 'direct' | 'auto') => void;
}

const pathLabels: Record<WebRenderPath, string> = {
  direct: 'Direct',
  'worker-shared': 'Worker (shared memory)',
  'worker-transfer': 'Worker (transferable buffers)',
};

export function settingsScreen(settings: DemoRenderSettings): Widget {
  const { mode, application, selectMode } = settings;
  const entries = [
    new DropdownMenuEntry<WebRenderMode>({ value: 'direct', label: pathLabels.direct }),
    new DropdownMenuEntry<WebRenderMode>({ value: 'auto', label: 'Worker (automatic)' }),
  ];
  // Keep a route forced through the URL visible as the current selection.
  if (mode === 'worker-shared' || mode === 'worker-transfer')
    entries.push(new DropdownMenuEntry({ value: mode, label: pathLabels[mode], enabled: false }));
  const dropdown = new DropdownMenu({
    selectOnly: true,
    expandedInsets: EdgeInsets.zero,
    decorationBuilder: () => new InputDecoration({ labelText: 'Render path' }),
    initialSelection: mode,
    dropdownMenuEntries: entries,
    onSelected(value) {
      if (value === 'direct' || value === 'auto') selectMode(value);
    },
  });
  const pathStatus = new ListenableBuilder(application, (context) => {
    // Worker recovery updates the renderer generation on the same view.
    context.services.readMetrics('rendererGeneration');
    const path = application.value?.rendering.path;
    let status = 'Starting renderer…';
    if (path === 'direct' && mode !== 'direct')
      status = 'Worker unavailable. Using direct rendering.';
    else if (path) status = `Active renderer · ${pathLabels[path]}`;
    return new Semantics({ container: true, liveRegion: true, child: new Text(status) });
  });
  return new Scaffold({
    appBar: new AppBar({ title: new Text('Settings'), automaticallyImplyLeading: false }),
    body: new SafeArea({
      top: false,
      bottom: false,
      child: new ListView({
        padding: EdgeInsets.all(24),
        children: [
          new Align(
            new ConstrainedBox(
              new Semantics({
                container: true,
                explicitChildNodes: true,
                child: column(dropdown, pathStatus),
              }),
              new BoxConstraints(0, 420),
            ),
            { alignment: Alignment.topLeft },
          ),
        ],
      }),
    }),
  });
}
