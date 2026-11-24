// SPDX-License-Identifier: BSD-3-Clause
import { Padding, Text } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { AppBar } from '@nelyx/material/app-bar';
import { Scaffold } from '@nelyx/material/scaffold';
import { TextButton } from '@nelyx/material/text-button';
import { deviceServicesFor } from '@nelyx/sdk/devices';
import type { DeviceSubscription } from '@nelyx/sdk/devices';

type Action = (signal: AbortSignal) => unknown | Promise<unknown>;

export class DeviceServicesScreen extends StatefulWidget {
  override createState(): State<DeviceServicesScreen> {
    return new DeviceServicesScreenState();
  }
}

class DeviceServicesScreenState extends State<DeviceServicesScreen> {
  private status = 'Select an action';
  private request: AbortController | null = null;
  private live = new Set<DeviceSubscription>();

  private result(value: unknown): void {
    if (!this.mounted) return;
    const text = typeof value === 'string' ? value : JSON.stringify(value) ?? 'Done';
    this.setState(() => { this.status = text; });
  }

  private run(action: Action): void {
    if (this.request) return;
    const request = new AbortController();
    this.request = request;
    this.result('Waiting for device');
    const job = async () => {
      try {
        const value = await action(request.signal);
        if (!request.signal.aborted) this.result(value);
      } catch (error) {
        if (!request.signal.aborted) this.result(String(error));
      } finally {
        if (this.request === request) this.request = null;
      }
    };
    void job();
  }

  private async retain(subscription: DeviceSubscription, signal: AbortSignal): Promise<void> {
    if (this.mounted && !signal.aborted) this.live.add(subscription);
    else await subscription.dispose();
  }

  private async stop(): Promise<void> {
    this.request?.abort();
    this.request = null;
    const sessions = [...this.live];
    this.live.clear();
    await Promise.all(sessions.map((session) => session.dispose()));
  }

  override dispose(): void {
    void this.stop().catch(() => {});
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const devices = deviceServicesFor(context.services);
    const { location, notifications, files, openUrl, deepLinks, store, camera, barcode, nfc,
      biometrics, credentials, battery, sensors, bluetooth, share } = devices ?? {};
    const button = (label: string, action?: Action) => new TextButton({
      child: new Text(label),
      onPressed: action ? () => this.run(action) : null,
    });
    const stop = new TextButton({
      child: new Text('Stop device updates'),
      onPressed: () => { void this.stop().then(() => this.result('Device updates stopped'), (error) => this.result(String(error))); },
    });
    return new Scaffold({
      appBar: new AppBar({ title: new Text('Device services') }),
      body: new ListView({
        padding: EdgeInsets.all(16),
        children: [
          new Semantics({ identifier: 'device-result', liveRegion: true, child: new Text(this.status) }),
          stop,
          button('Get location', location && (() => location.current({ timeout: 10_000 }))),
          button('Watch location', location && (async (signal) => {
            await this.retain(await location.watch((value) => this.result(value), (error) => this.result(String(error))), signal);
            return 'Watching location';
          })),
          button('Show notification', notifications && (async () => {
            if (await notifications.permission() !== 'granted' && await notifications.requestPermission() !== 'granted')
              return 'Notification permission was denied';
            await notifications.show({ title: 'Nelyx Demo', body: 'Device notification' });
            return 'Notification requested';
          })),
          button('Pick a file', files && (async (signal) => {
            const [file] = await files.pick({}, signal);
            return file ? file.name + ' · ' + (await file.read()).byteLength + ' bytes' : 'File picker cancelled';
          })),
          button('Open project site', openUrl && (() => openUrl('https://github.com/Dynaruid/NelyxLab'))),
          button('Get initial link', deepLinks && (() => deepLinks.current())),
          button('Watch links', deepLinks && (async (signal) => {
            await this.retain(await deepLinks.watch((urls) => this.result(urls)), signal);
            return 'Watching links';
          })),
          button('Save setting', store && (async () => {
            await store.set('demo-setting', { value: 'Nelyx' });
            return 'Setting saved';
          })),
          button('Read setting', store && (async () => (await store.get('demo-setting')) ?? 'No setting saved')),
          button('Start camera', camera && (async (signal) => {
            const session = await camera.open({ facingMode: 'environment' });
            await this.retain(session, signal);
            const track = session.stream.getVideoTracks()[0];
            return track ? 'Camera active · ' + track.readyState : 'Camera has no video track';
          })),
          button('Scan barcode', barcode && ((signal) => barcode.scan(undefined, signal))),
          button('Read NFC text', nfc && ((signal) => nfc.read(signal))),
          button('Write sample NFC text', nfc && (() => nfc.write({ text: 'Nelyx Demo' }))),
          button('Authenticate', biometrics && (() => biometrics.authenticate('Verify the Nelyx Demo user'))),
          new Text(credentials ? 'WebAuthn available with a server challenge' : 'WebAuthn unavailable'),
          button('Get battery', battery && (() => battery.current())),
          button('Watch device orientation', sensors && (async (signal) => {
            await this.retain(await sensors.watch('orientation', (value) => this.result(value)), signal);
            return 'Watching orientation';
          })),
          button('Read Bluetooth battery level', bluetooth && (async () => {
            const connection = await bluetooth.connect('battery_service');
            try { return { device: connection.name, level: (await connection.read('battery_level'))[0] }; }
            finally { await connection.dispose(); }
          })),
          button('Share text', share && (() => share({ title: 'Nelyx Demo', text: 'Nelyx device services' }))),
          new Padding(EdgeInsets.only({ bottom: 16 }), new Text('Unavailable actions are disabled.')),
        ],
      }),
    });
  }
}
