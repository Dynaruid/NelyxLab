// SPDX-License-Identifier: BSD-3-Clause
import './style.css';
import { startLazyFrontend } from '@nelyx/vite/client';
startLazyFrontend(() => import('./app-surface.tsx').then(({ App }) => App));
