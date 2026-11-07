// SPDX-License-Identifier: BSD-3-Clause
import { defineEngineV2App } from '@nelyx/sdk/engine-v2';
import {
  StatefulWidget,
  State,
  Column,
  Text,
  ScrollView,
  EditingController,
  protocol as p,
} from '@nelyx/core/v2';
import { Theme, ThemeData, FilledButton, TextField } from '@nelyx/material/v2';
import {
  CupertinoTheme,
  CupertinoThemeData,
  CupertinoButton,
  CupertinoSwitch,
} from '@nelyx/cupertino/v2';

class AndroidScene extends StatefulWidget {
  createState() {
    return new AndroidState();
  }
}
class AndroidState extends State {
  material = 0;
  cupertino = 0;
  enabled = false;
  readonly editor = new EditingController('안녕하세요 · Android');
  readonly password = new EditingController('private');
  build() {
    return new Theme(
      new ThemeData(0xff6750a4),
      new CupertinoTheme(
        new CupertinoThemeData(0xff007aff),
        new ScrollView(
          new Column(
            [
              new Text('Nelyx on Android', {
                fontSize: 26,
                semantics: { role: 'text', label: 'Nelyx on Android' },
              }),
              new Text('Material · Cupertino', { fontSize: 17 }),
              new FilledButton(
                'Material ' + this.material,
                () =>
                  this.setState(() => {
                    this.material++;
                  }),
                { properties: { width: 280, height: 48 } },
              ),
              new CupertinoButton(
                'Cupertino ' + this.cupertino,
                () =>
                  this.setState(() => {
                    this.cupertino++;
                  }),
                { properties: { width: 280, height: 48 } },
              ),
              new CupertinoSwitch(
                this.enabled,
                (value) =>
                  this.setState(() => {
                    this.enabled = value;
                  }),
                { semantics: { role: 'switchControl', label: 'Enable feature' } },
              ),
              new CupertinoSwitch(false, () => {}, {
                semantics: { role: 'switchControl', label: 'Keep disabled' },
              }),
              new Text('Text input', { fontSize: 18 }),
              new TextField(this.editor, {
                properties: { width: 300, height: 64 },
                flags: p.editFlags.multiline,
                color: 0xffe9e1f4,
                semantics: { role: 'textField', label: 'Message' },
              }),
              new TextField(this.password, {
                properties: { width: 300, height: 48 },
                flags: p.editFlags.password,
                color: 0xffe9e1f4,
                semantics: { role: 'textField', label: 'Password' },
              }),
              new FilledButton(
                'Reset text',
                () => {
                  void this.editor.refresh().then((value) =>
                    this.editor.edit({
                      revision: value.revision,
                      kind: 'replace',
                      text: '다시 시작',
                      base: 5,
                      extent: 5,
                      policy: 'cancel',
                    }),
                  );
                },
                { properties: { width: 280, height: 48 } },
              ),
              ...Array.from(
                { length: 12 },
                (_, index) =>
                  new Text('Android scroll item ' + (index + 1), {
                    fontSize: 18,
                    properties: { height: 38 },
                    semantics: { role: 'text', label: 'Android scroll item ' + (index + 1) },
                  }),
              ),
            ],
            { layout: { gap: 14, padding: { left: 20, top: 24, right: 20, bottom: 24 } } },
          ),
          { horizontal: { kind: 'expand' }, vertical: { kind: 'expand' } },
        ),
      ),
    );
  }
}
export default defineEngineV2App({ build: () => new AndroidScene() });
