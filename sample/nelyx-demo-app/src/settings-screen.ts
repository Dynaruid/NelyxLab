// SPDX-License-Identifier: BSD-3-Clause
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Align, ConstrainedBox, Expanded, Row, Text } from '@nelyx/core/framework/widgets/basic';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Color } from '@nelyx/core/ui/color';
import { AppBar } from '@nelyx/material/app-bar';
import { DropdownMenu, DropdownMenuEntry } from '@nelyx/material/dropdown-menu';
import { InputDecoration } from '@nelyx/material/input-decoration';
import { Scaffold } from '@nelyx/material/scaffold';
import { Switch } from '@nelyx/material/switch';
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

export interface DemoWindowAcrylicState {
  readonly enabled: boolean;
  readonly pending: boolean;
  readonly failed: boolean;
}

export interface DemoWindowAcrylic {
  readonly state: ValueListenable<DemoWindowAcrylicState>;
  setEnabled(enabled: boolean): Promise<void>;
}

const pathLabels: Record<WebRenderPath, string> = {
  direct: 'Direct',
  'worker-shared': 'Worker (shared memory)',
  'worker-transfer': 'Worker (transferable buffers)',
};

export function settingsScreen(
  settings: DemoRenderSettings,
  windowAcrylic?: DemoWindowAcrylic,
  focusNode: FocusNode | null = null,
): Widget {
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
  const acrylic = windowAcrylic?.state.value;
  const acrylicControls: Widget[] = [];
  if (windowAcrylic && acrylic) {
    const label = 'Acrylic window';
    const setEnabled = acrylic.pending
      ? null
      : (enabled: boolean) => void windowAcrylic.setEnabled(enabled);
    acrylicControls.push(
      new Row([
        new Expanded(new ExcludeSemantics(new Text(label))),
        new Semantics({
          container: true,
          identifier: 'window-acrylic',
          label,
          button: true,
          checked: acrylic.enabled,
          enabled: !acrylic.pending,
          onFocus: focusNode && (() => focusNode.requestFocus()),
          onTap: setEnabled && (() => setEnabled(!acrylic.enabled)),
          child: new ExcludeSemantics(
            new Switch({ value: acrylic.enabled, onChanged: setEnabled, focusNode }),
          ),
        }),
      ]),
    );
    if (acrylic.failed)
      acrylicControls.push(
        new Semantics({
          liveRegion: true,
          child: new Text('Windows could not change the backdrop.'),
        }),
      );
  }
  return new Scaffold({
    backgroundColor: acrylic?.enabled ? new Color(0) : null,
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
                child: column(dropdown, pathStatus, ...acrylicControls),
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
