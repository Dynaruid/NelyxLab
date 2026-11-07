// SPDX-License-Identifier: BSD-3-Clause
import { imageFixture, imageDescriptorProbe } from './app-images-probe.mjs';
export function imageAppSource(model) {
  const probe = imageDescriptorProbe
    .toString()
    .replace(
      /png,\s+gif,\s+notify = \(\) => \{\},\s+assetKey = null/,
      'png: Uint8Array, gif: Uint8Array, notify: (phase: string) => void = () => {}, assetKey: string | null = null',
    )
    .replace('(value, message)', '(value: unknown, message: string)')
    .replace(
      '(a, b) => a.length',
      '(a: Uint8Array | null, b: readonly number[]) => a !== null && a.length',
    )
    .replace('(work, part)', '(work: () => unknown, part: string)')
    .replace('let error;', 'let error: unknown;')
    .replace('get targetWidth()', 'get targetWidth(): never')
    .replace('get getTargetSize()', 'get getTargetSize(): never')
    .replace(
      'let descriptor, codec, resized, first, second, clone;',
      'let descriptor: ImageDescriptor | undefined, codec: Codec | undefined, resized: Codec | undefined, first: Image | undefined, second: Image | undefined, clone: Image | undefined;',
    )
    .replace('() => clone.toByteData', '() => clone!.toByteData');
  return `import {ImmutableBuffer} from '@nelyx/core/ui/immutable-buffer';
import {ImageDescriptor} from '@nelyx/core/ui/image-descriptor';
import {instantiateImageCodec,instantiateImageCodecFromBuffer,instantiateImageCodecWithSize} from '@nelyx/core/ui/image-decoder';
import type {Codec} from '@nelyx/core/ui/codec';
import type {Image} from '@nelyx/core/ui/image';
import {${model === 'original-elements' ? 'defineOriginalEngineV2App' : 'defineEngineV2App'} as define} from '@nelyx/sdk/${model === 'original-elements' ? 'engine-v2-original' : 'engine-v2'}';
import {Text} from '@nelyx/core/${model === 'original-elements' ? 'framework/widgets/basic' : 'v2'}';
${probe}
let app:any;
export default define({async build(context){app=context;const result=await imageDescriptorProbe(
new Uint8Array(${JSON.stringify([...Buffer.from(imageFixture.png, 'base64')])}),
new Uint8Array(${JSON.stringify([...Buffer.from(imageFixture.gif, 'base64')])}),undefined,'image.png');
context.notify({kind:'image-result',result});return new Text('Image codecs');},ready(){app.notify({kind:'image-ready'});}});`;
}
