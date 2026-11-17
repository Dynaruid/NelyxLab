// SPDX-License-Identifier: BSD-3-Clause
import { main as createDemo } from './index.ts';

export { applicationName } from './index.ts';

/** Interactive candidate entry; the ordinary Demo keeps its legacy default. */
export function main(): ReturnType<typeof createDemo> {
  return createDemo(undefined, { calendarPreparation: true });
}
