// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { RenderBox, PipelineOwner } from '@nelyx/core/framework/rendering/object';
import { RenderFlex } from '@nelyx/core/framework/rendering/boxes';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { createFlexLayoutService } from '@nelyx/skia-native/flex-layout';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
const timeout = 1_200_000;
class Leaf extends RenderBox {
  constructor(index, events) {
    super();
    this.index = index;
    this.events = events;
  }
  performLayout(constraints) {
    this.events.push([
      this.index,
      constraints.minWidth,
      constraints.maxWidth,
      constraints.minHeight,
      constraints.maxHeight,
    ]);
    return constraints.constrain({
      width: 12.1 + this.index * 3.7,
      height: 9.3 + this.index * 4.9,
    });
  }
  computeDryLayout(constraints) {
    return constraints.constrain({
      width: 12.1 + this.index * 3.7,
      height: 9.3 + this.index * 4.9,
    });
  }
}
test('native Flex capability is required at explicit selection', { timeout }, () => {
  assert.throws(() => createFlexLayoutService({}, () => {}), /capability missing/);
});
test(
  'the actual C++ Flex phases preserve TS child constraints, order and exact numeric geometry',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-native-flex-')),
      source = path.join(directory, 'flex.cpp'),
      executable = path.join(directory, 'flex.exe'),
      env = windowsCompilerEnvironment();
    try {
      fs.writeFileSync(
        source,
        '#include "nelyx_skia/flex_layout.h"\n#include <iostream>\n#include <cstdint>\nint main(){try{uint32_t n=0;std::cin.read(reinterpret_cast<char*>(&n),4);if(n>6160)return 2;std::vector<double> input(n);std::cin.read(reinterpret_cast<char*>(input.data()),n*8);if(!std::cin)return 2;auto out=nelyx::flex_layout::run(input);std::cout.write(reinterpret_cast<const char*>(out.data()),out.size()*8);return 0;}catch(const std::exception& e){std::cerr<<e.what();return 2;}}\n',
      );
      const core = path.resolve(import.meta.dirname, '../../skia/native/core');
      await execute(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/O2',
          '/fp:strict',
          '/EHsc',
          '/MD',
          '/I' + core,
          source,
          path.join(core, 'flex_layout.cpp'),
          '/Fe' + executable,
        ],
        { cwd: directory, env, timeout },
      );
      const run = (packet) => {
        const size = Buffer.alloc(4);
        size.writeUInt32LE(packet.length);
        const result = spawnSync(executable, [], {
          cwd: directory,
          env,
          timeout,
          input: Buffer.concat([
            size,
            Buffer.from(packet.buffer, packet.byteOffset, packet.byteLength),
          ]),
        });
        assert.equal(result.status, 0, result.stderr.toString());
        assert.equal(result.stdout.length % 8, 0);
        return Array.from({ length: result.stdout.length / 8 }, (_, index) =>
          result.stdout.readDoubleLE(index * 8),
        );
      };
      for (let scenario = 0; scenario < 12; scenario++) {
        const horizontal = scenario < 6,
          main = ['start', 'end', 'center', 'spaceBetween', 'spaceAround', 'spaceEvenly'][
            scenario % 6
          ],
          cross = ['start', 'end', 'center', 'stretch'][scenario % 4],
          constraints = new BoxConstraints(25.2, 193.7, 17.5, 151.9);
        const create = (native) => {
          const events = [],
            pipeline = new PipelineOwner(),
            root = new RenderFlex(
              horizontal ? 'horizontal' : 'vertical',
              1.3,
              [],
              scenario % 3 ? 'max' : 'min',
              cross,
              {
                mainAxisAlignment: main,
                textDirection: scenario % 2 ? 'rtl' : 'ltr',
                verticalDirection: scenario % 3 ? 'down' : 'up',
              },
            ),
            children = Array.from({ length: 5 }, (_, index) => new Leaf(index, events));
          root.setChildren(children);
          children[1].parentData.flex = 1;
          children[1].parentData.fit = scenario % 2 ? 'loose' : 'tight';
          children[3].parentData.flex = 3;
          const service = native
            ? createFlexLayoutService(
                {
                  nelyxFlexLayoutVersion: () => 1,
                  nelyxFlexLayout: (bytes) => run(new Float64Array(bytes)),
                },
                () => {},
              )
            : undefined;
          if (service) pipeline.flexLayout = service;
          try {
            pipeline.setRoot(root);
            root.layout(constraints);
            return {
              size: root.size,
              overflow: root.overflow,
              children: children.map((child) => ({ size: child.size, offset: child.layoutOffset })),
              events,
              execution: service?.execution(),
            };
          } finally {
            pipeline.setRoot(undefined);
            root.dispose();
            children.forEach((child) => child.dispose());
            service?.dispose();
            pipeline.dispose();
          }
        };
        const ts = create(false),
          native = create(true);
        assert.deepEqual({ ...native, execution: undefined }, ts, 'Flex scenario ' + scenario);
        assert.equal(native.execution.flexPlans, 1);
        assert.equal(native.execution.flexPlacements, 1);
        assert.equal(native.execution.flexChildren, 10);
        assert.equal(native.execution.tsFallbacks, 0);
      }
      const pipeline = new PipelineOwner(),
        service = createFlexLayoutService(
          {
            nelyxFlexLayoutVersion: () => 1,
            nelyxFlexLayout: () => {
              throw Error('unsupported work reached native');
            },
          },
          () => {},
        );
      pipeline.flexLayout = service;
      const root = new RenderFlex('horizontal', 0, [], 'max', 'baseline', {
          textBaseline: 'alphabetic',
        }),
        child = new Leaf(0, []);
      root.setChildren([child]);
      try {
        pipeline.setRoot(root);
        root.layout(new BoxConstraints(0, 100, 0, 100));
        assert.equal(service.execution().fallbackReasons.baseline, 1);
      } finally {
        pipeline.setRoot(undefined);
        root.dispose();
        child.dispose();
        service.dispose();
        pipeline.dispose();
      }
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true });
    }
  },
);
