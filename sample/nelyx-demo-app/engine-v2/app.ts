// SPDX-License-Identifier: BSD-3-Clause
import { defineApp } from '@nelyx/sdk/app';
import { DemoApplication } from '../src/demo-application.ts';

export default defineApp({
  async fontCatalog(context) {
    return {
      fonts: await Promise.all(
        [
          ['NelyxSample', 'sample-font'],
          ['MaterialIcons', 'nelyx-material-icons'],
        ].map(async ([family, key]) => ({ family: family!, bytes: await context.asset(key!) })),
      ),
    };
  },
  build: () => new DemoApplication('안녕하세요, Nelyx!'),
});
