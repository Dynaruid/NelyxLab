// SPDX-License-Identifier: BSD-3-Clause
import { defineOriginalEngineV2App } from '@nelyx/sdk/engine-v2-original';
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Column, Padding, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { FilledButton } from '@nelyx/material/filled-button';
import { Switch } from '@nelyx/material/switch';
import { Theme } from '@nelyx/material/theme';
import { ThemeData } from '@nelyx/material/theme-data';
import { InkRipple } from '@nelyx/material/ink-ripple';
import { CupertinoButton } from '@nelyx/cupertino/button';
import { CupertinoSwitch } from '@nelyx/cupertino/switch';
import { CupertinoTheme, CupertinoThemeData } from '@nelyx/cupertino/theme';
import { TextField } from '@nelyx/material/text-field';
import { CupertinoTextField } from '@nelyx/cupertino/text-field';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';

class OriginalAndroidScene extends StatefulWidget {
  createState() {
    return new OriginalAndroidState();
  }
}
class OriginalAndroidState extends TickerProviderStateMixin<OriginalAndroidScene> {
  material = 0;
  cupertino = 0;
  enabled = false;
  message = new TextEditingController('Original 한글');
  password = new TextEditingController('secret');
  fade!: AnimationController;
  override initState() {
    super.initState();
    this.fade = new AnimationController({ vsync: this, value: 1, duration: 180 });
    this.fade.addListener(() => {
      if (this.mounted) this.setState(() => {});
    });
  }
  build() {
    return new Directionality(
      'ltr',
      new Theme(
        new ThemeData({ splashFactory: InkRipple.splashFactory }),
        new CupertinoTheme(
          new CupertinoThemeData(),
          new Padding(
            { left: 20, top: 24, right: 0, bottom: 0 },
            new Column(
              [
                new Text('Nelyx Original Widgets', { fontSize: 24, color: 0xff172033 }),
                new SizedBox(undefined, 20),
                new FilledButton({
                  child: new Text('Material ' + this.material),
                  onPressed: () => {
                    this.setState(() => {
                      this.material++;
                    });
                    void this.fade.animateTo(0.4, { duration: 180 });
                  },
                }),
                new SizedBox(undefined, 16),
                CupertinoButton.filled({
                  child: new Text('Cupertino ' + this.cupertino),
                  onPressed: () =>
                    this.setState(() => {
                      this.cupertino++;
                    }),
                }),
                new SizedBox(undefined, 16),
                new Switch({
                  value: this.enabled,
                  onChanged: (value) =>
                    this.setState(() => {
                      this.enabled = value;
                    }),
                  semanticLabel: 'Enable feature',
                }),
                new CupertinoSwitch({
                  value: false,
                  onChanged: () => {},
                  semanticLabel: 'Keep disabled',
                }),
                new SizedBox(undefined, 16),
                new Opacity(
                  new SizedBox(
                    300,
                    192,
                    new Column(
                      [
                        new SizedBox(
                          300,
                          64,
                          new TextField({
                            id: 'Message',
                            controller: this.message,
                            decoration: null,
                            onChanged: (value) => {
                              if (value === 'refuse')
                                this.message.replace('accepted', { anchor: 8, focus: 8 });
                            },
                          }),
                        ),
                        new SizedBox(
                          300,
                          64,
                          new CupertinoTextField({
                            id: 'Password',
                            controller: this.password,
                            obscureText: true,
                          }),
                        ),
                        new FilledButton({
                          child: new Text('Reset editor'),
                          onPressed: () =>
                            this.message.replace('reset 한글', { anchor: 8, focus: 8 }),
                        }),
                      ],
                      { mainAxisSize: 'min' },
                    ),
                  ),
                  { opacity: 1 },
                ),
                new Opacity(
                  new Text('TypeScript AnimationController', { fontSize: 20, color: 0xff172033 }),
                  { opacity: this.fade.value },
                ),
                new Text('Opacity ' + this.fade.value.toFixed(2), {
                  fontSize: 18,
                  color: 0xff172033,
                }),
              ],
              { mainAxisSize: 'min', crossAxisAlignment: 'start', textDirection: 'ltr' },
            ),
          ),
        ),
      ),
    );
  }
  override dispose() {
    this.fade.dispose();
    this.message.dispose();
    this.password.dispose();
    super.dispose();
  }
}
export default defineOriginalEngineV2App({ build: () => new OriginalAndroidScene() });
