// SPDX-License-Identifier: BSD-3-Clause
import { describeError } from '@nelyx/core/foundation/errors';
import { useMemo, useState } from 'react';
import { ApplicationSurface } from '@nelyx/sdk/platforms/web/surface';
import { webBackend } from '@nelyx/sdk/platforms/web/application';
import { main } from '../../src/index.ts';
import { applicationOptions } from './configuration.ts';
export function App() {
  const { react } = webBackend(),
    shared = useMemo(() => main(), []),
    options = useMemo(() => applicationOptions(), []),
    [error, setError] = useState('');
  return react.createElement(
    react.Fragment,
    null,
    error ? react.createElement('p', { role: 'alert' }, error) : null,
    react.createElement(ApplicationSurface, {
      definition: shared.definition,
      options,
      style: { flex: 1, width: '100%', height: '100%' },
      onError: (error: unknown) => {
        const message = describeError(error);
        console.error(message, error);
        setError(message);
      },
    }),
  );
}
