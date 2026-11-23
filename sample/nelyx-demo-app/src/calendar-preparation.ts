// SPDX-License-Identifier: BSD-3-Clause
import './style.css';
import { createElement } from 'react';
import { startFrontend } from '@nelyx/vite/client';
import { App } from './app-surface.tsx';
import { main as createDemo } from './app.ts';

export { applicationName } from './app.ts';

/** Interactive candidate entry; the ordinary Demo keeps its legacy default. */
export function main(): ReturnType<typeof createDemo> {
  return createDemo(undefined, { calendarPreparation: true });
}

startFrontend((props) => createElement(App, { ...props, create: main }));
