// SPDX-License-Identifier: BSD-3-Clause
/** The direct Windows compiler and VM always come from this one release. */
export const windowsNativeHermesPin = Object.freeze({
  version: '260318099.0.7',
  tag: 'hermes-v260318099.0.7',
  revision: 'b464dba92ad87bcfb77fae381a49a2394d9836d9',
  sourceUrl:
    'https://codeload.github.com/meta/hermes/tar.gz/b464dba92ad87bcfb77fae381a49a2394d9836d9',
  sourceSha256: '57cc6880783cdcd2ca25db49be5332671ca7d358c22ebfe08ff354ff131ed6d6',
  bytecodeVersion: 99,
  jsi: 'hermes-iruntime',
  jsiHeaderSha256: 'db2f1ee9291340f3d05b11abdcdc3d12ac84c239e58599d4ef2ac06dbaa14d92',
  heap: 'HEAP_HV_64',
  crt: 'MD',
  compilerClassSpill: 'hermes.upstream-class-spill/5423909e212d9464ebf70633a02a61b9e43963df',
  classes: 'native-upstream-v1',
  icu: Object.freeze({
    version: '79.1',
    archive: 'icu-source.zip',
    url: 'https://github.com/unicode-org/icu/releases/download/release-79.1/icu4c-79.1-Win64-MSVC2026.zip',
    archiveSha256: 'c4ae1cbadb4187007f76f8b1bcf3a10deb699395ab3c74df01362bfdfa0f1ac2',
    includeSha256: 'f93cf226e20c043752a763110c679140ba32a1e1b2c7bc42167b0f9624bcce7a',
    files: Object.freeze([
      {
        path: 'LICENSE',
        sha256: '2eb5ef4da31e542030455e2d149feca8d8f1217e69ef98ea7e379067043b79ab',
      },
      {
        path: 'bin64/icudt79.dll',
        sha256: 'cc0deac833891bb1e52e5d8c24707e9a904d61ab7342542b8c951924bf4d64c8',
      },
      {
        path: 'bin64/icuin79.dll',
        sha256: '1c8a2a9f165b8d41c28c7f9dce13e6660278bf7a9b69b396f33fed3d14236cd4',
      },
      {
        path: 'bin64/icuuc79.dll',
        sha256: '5898b5127216ffd9d6d7178ee85d1727f9e27fc9c328d7a8ce5c19edb1723cea',
      },
      {
        path: 'lib64/icudt.lib',
        sha256: '6204213b1fe2f0315ba12b009236b7f32dd6ba32ec1ffcfe7353621c833c1230',
      },
      {
        path: 'lib64/icuin.lib',
        sha256: 'b789ee437df049ac2ea54b9369474912b638d7ad9fd999ac2d4aba07213e8642',
      },
      {
        path: 'lib64/icuuc.lib',
        sha256: '64ff10ba3a413e04d0032a9b44903c1f7f173e708c77d0a3caafbb1021620ade',
      },
    ]),
  }),
});
