// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
const nelyx=path.resolve(import.meta.dirname,'..'),target=path.join(nelyx,'sdk/tooling/cli/upstream');
for(const relative of ['react-native-linux.json','overlays/react-native-linux','patches/react-native-linux-package-layout.patch','patches/react-native-linux-core-runtime.patch']){
  const file=path.join(target,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.cpSync(path.join(nelyx,'upstream',relative),file,{recursive:true});
}
