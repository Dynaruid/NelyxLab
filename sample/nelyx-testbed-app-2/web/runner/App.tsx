// SPDX-License-Identifier: BSD-3-Clause
import { describeError } from '@nelyx/core/foundation/errors';
import { useMemo, useState } from 'react';
import { ApplicationSurface } from '@nelyx/sdk/platforms/web/surface';
import { main } from 'virtual:nelyx-app';
import { applicationOptions } from './configuration.ts';

export function App() {
  const shared = useMemo(() => main(), []);
  const options = useMemo(() => applicationOptions(), []);
  const [error, setError] = useState('');
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <ApplicationSurface
        definition={shared.definition}
        options={options}
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
