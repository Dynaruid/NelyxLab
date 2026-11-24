/* tslint:disable */
/* eslint-disable */

export class BrowserDevices {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    can_read_clipboard(): boolean;
    can_write_clipboard(): boolean;
    clipboard_permission(read: boolean): Promise<PermissionStatus> | undefined;
    read_clipboard_text(): Promise<string>;
    write_clipboard_text(text: string): Promise<void>;
}

export class ClipboardPermissionObserver {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
}

export function bind_browser_devices(view: Window): BrowserDevices;

export function browser_geolocation_available(view: Window): boolean;

export function browser_geolocation_clear(view: Window, id: number): void;

export function browser_geolocation_current(view: Window, success: Function, failure: Function, options: any): void;

export function browser_geolocation_watch(view: Window, success: Function, failure: Function, options: any): number;

export function clipboard_permission_state(status: PermissionStatus): string;

export function clipboard_policy(input: string): string;

export function describe(): string;

export function invoke(command: string, input: string): string;

export function observe_clipboard_permission(status: PermissionStatus, changed: Function): ClipboardPermissionObserver;

export function vibrate_browser(view: Window, duration: number): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
