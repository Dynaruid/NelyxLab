// SPDX-License-Identifier: BSD-3-Clause
import { describeError } from '@nelyx/core/foundation/errors';
import { useMemo, useState } from 'react';
import { ApplicationSurface } from '@nelyx/sdk/frontend/dom/surface';
import { main } from './app.ts';
export function App({ options }) {
    const shared = useMemo(() => main(), []);
    const [error, setError] = useState('');
    return (<>
      {error && <p role="alert">{error}</p>}
      <ApplicationSurface definition={shared.definition} options={options} style={{ flex: 1, width: '100%', height: '100%' }} onError={(error) => {
            const message = describeError(error);
            console.error(message, error);
            setError(message);
        }}/>
    </>);
}
