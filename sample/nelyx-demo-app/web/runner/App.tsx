// SPDX-License-Identifier: BSD-3-Clause
import { describeError } from '@nelyx/core/foundation/errors';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
import type { WebSkiaLibrary } from '@nelyx/skia-web/library';
import { useMemo, useState } from 'react';
import type { WebApplication } from '@nelyx/sdk/platforms/web/application';
import { getWebDeployment } from '@nelyx/sdk/platforms/web/environment';
import { ApplicationSurface } from '@nelyx/sdk/platforms/web/surface';
import { main } from 'virtual:nelyx-app';
import { applicationOptions } from './configuration.ts';

declare global {
  interface Window {
    nelyxDemoFrameProbe?: (
      read: () => {
        frames: ReturnType<FrameDiagnostics['drain']>;
        sections?: FrameworkRoot['buildOwner']['preparationStats'];
        dormant?: NonNullable<FrameworkRoot['buildOwner']['maybeDormantChildren']>['debugStats'];
        pictures?: WebSkiaLibrary['debugRasterizationStats'];
      },
    ) => void;
  }
}

function attachFrameProbe(application: WebApplication): void {
  if (!window.nelyxDemoFrameProbe) return;
  const view = application.view,
    diagnostics = new FrameDiagnostics(performance, 16384),
    text = application.text as WebSkiaLibrary;
  view.frameDiagnostics = diagnostics;
  window.nelyxDemoFrameProbe(() => {
    const owner = view.controller instanceof FrameworkRoot ? view.controller.buildOwner : undefined;
    return {
      frames: diagnostics.drain(),
      ...(owner ? { sections: owner.preparationStats } : {}),
      ...(owner?.maybeDormantChildren ? { dormant: owner.maybeDormantChildren.debugStats } : {}),
      pictures: text.debugRasterizationStats,
    };
  });
}

export function App() {
  const shared = useMemo(() => main(), []);
  const options = useMemo(
    () => ({
      ...applicationOptions(),
      // The gallery clears and redraws the whole canvas on every submitted frame.
      preserveDrawingBuffer: false,
      ...(getWebDeployment().os === 'android' ? { maxRasterScale: 2 } : {}),
    }),
    [],
  );
  const definition = useMemo(
    () => ({
      ...shared.definition,
      // AssetImage resolves the bundled WebP through ImageService on demand.
      assets: shared.definition.assets ?? options.manifest.filter(({ kind }) => kind === 'font'),
    }),
    [shared.definition, options.manifest],
  );
  const [error, setError] = useState('');
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <ApplicationSurface
        definition={definition}
        options={options}
        onReady={attachFrameProbe}
        style={{ flex: 1, width: '100%', height: '100%' }}
        onError={(error) => {
          const message = describeError(error);
          console.error(message, error);
          setError(message);
        }}
      />
    </>
  );
}
