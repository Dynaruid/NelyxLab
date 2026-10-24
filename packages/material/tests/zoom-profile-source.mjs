import fs from 'node:fs';import {configureZoomTransitionProfile} from '../dist/internal/route/zoom-profile.js';
import {compareZoomSourceEnvironment} from './zoom-source-compare.mjs';
configureZoomTransitionProfile({forceDisableSnapshotting:true});const original=JSON.parse(fs.readFileSync(new URL('./fixtures/zoom-transitions-source.json',import.meta.url)));console.log(JSON.stringify(await compareZoomSourceEnvironment(original.environments.find(e=>e.name==='profile'))));
