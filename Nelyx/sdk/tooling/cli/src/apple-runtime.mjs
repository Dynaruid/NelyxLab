// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
const lock = JSON.parse(
  fs.readFileSync(new URL('./apple-runtime-source.json', import.meta.url), 'utf8'),
);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function renderPatchedFiles(originals, target, nativeVersion, teardownHeader) {
  function replaceOnce(source, from, to) {
    assert.equal(source.split(from).length, 2, 'unexpected native hook insertion boundary');
    return source.replace(from, to);
  }
  const instanceMethod = `// SPDX-License-Identifier: BSD-3-Clause (Nelyx addition)
- (void)nelyxKeepRuntimeUntilDestruction
{
  std::lock_guard<std::mutex> lock(_nelyxLeaseMutex);
  _nelyxRuntimeLease = self;
}

- (void)nelyxSettleInvalidation:(NSString *)error
{
  NSCAssert([NSThread isMainThread], @"Nelyx invalidation completion requires main owner");
  NSArray *waiters = [_nelyxInvalidationWaiters copy]; _nelyxInvalidationWaiters = nil;
  for (void (^complete)(NSString *) in waiters) complete(error);
}

- (void)nelyxFailTeardown:(NSString *)error
{
  if (![NSThread isMainThread]) { dispatch_async(dispatch_get_main_queue(), ^{ [self nelyxFailTeardown:error]; }); return; }
  _nelyxTeardown->fail(); [self nelyxKeepRuntimeUntilDestruction];
  NSArray *waiters = [_nelyxShutdownWaiters copy]; _nelyxShutdownWaiters = nil;
  for (void (^complete)(NSString *) in waiters) complete(error);
  [self nelyxSettleInvalidation:error];
  RCTLogError(@"Nelyx teardown unconfirmed; instance and remaining dependencies retained: %@", error);
}

- (void)nelyxWatchTeardownAfter:(int)seconds
{
  __weak RCTInstance *weakOwner = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, seconds * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    RCTInstance *owner = weakOwner;
    if (owner && owner->_nelyxTeardown->checkDeadline()) [owner nelyxFailTeardown:@"RN teardown deadline expired"];
  });
}

- (void)nelyxFinishPrepare:(NSString *)error
{
  if (![NSThread isMainThread]) { dispatch_async(dispatch_get_main_queue(), ^{ [self nelyxFinishPrepare:error]; }); return; }
  if (!_nelyxTeardown->complete(error == nil)) return;
  if (_nelyxTeardown->snapshot().phase != nelyx::AppleRuntimeTeardown::Phase::confirmed) {
    [self nelyxFailTeardown:error ?: @"RN shutdown acknowledgement arrived after its deadline"]; return;
  }
  NSArray *waiters = [_nelyxShutdownWaiters copy]; _nelyxShutdownWaiters = nil;
  for (void (^complete)(NSString *) in waiters) complete(nil);
}

- (void)nelyxPrepareRuntimeShutdown:(void (^)(NSString *))completion
{
  _nelyxTeardown->sealAdmission();
  if (![NSThread isMainThread]) { dispatch_async(dispatch_get_main_queue(), ^{ [self nelyxPrepareRuntimeShutdown:completion]; }); return; }
  const auto request = _nelyxTeardown->request();
  if (request == nelyx::AppleRuntimeTeardown::Request::confirmed) { completion(nil); return; }
  if (request == nelyx::AppleRuntimeTeardown::Request::rejected) { completion(@"RN shutdown failed or waiter capacity exceeded"); return; }
  [self nelyxKeepRuntimeUntilDestruction];
  if (!_nelyxShutdownWaiters) _nelyxShutdownWaiters = [NSMutableArray new];
  [_nelyxShutdownWaiters addObject:[completion copy]];
  if (request == nelyx::AppleRuntimeTeardown::Request::wait) return;
  try { @try {
  Class hook = NSClassFromString(@"RNSkiaModule");
  if ([hook respondsToSelector:@selector(sealNativeAdmissionForRuntime:generation:)]) {
    [(Class<NelyxRuntimeShutdownHook>)hook sealNativeAdmissionForRuntime:_nelyxRuntimeIdentity.load() generation:_nelyxHostGeneration.load()];
  }
  [self nelyxWatchTeardownAfter:25];
  if (!_jsThreadManager) { [self nelyxFailTeardown:@"RN JS scheduler unavailable"]; return; }
  [_jsThreadManager dispatchToJSThread:^{
    try { @try {
    if (!self->_reactInstance || !self->_valid) { [self nelyxFinishPrepare:@"React runtime is unavailable"]; return; }
    self->_reactInstance->getUnbufferedRuntimeExecutor()([self](facebook::jsi::Runtime &runtime) {
      try { @try {
        Class nativeHook = NSClassFromString(@"RNSkiaModule");
        if ([nativeHook respondsToSelector:@selector(prepareRuntime:completion:)]) {
          [(Class<NelyxRuntimeShutdownHook>)nativeHook prepareRuntime:&runtime completion:^(NSString *error) { [self nelyxFinishPrepare:error]; }];
        } else {
          const bool empty = runtime.global().getProperty(runtime,"SkiaApi").isUndefined() && runtime.global().getProperty(runtime,"SkiaViewApi").isUndefined() && runtime.global().getProperty(runtime,"NelyxAppleHost").isUndefined();
          [self nelyxFinishPrepare:empty ? nil : @"Native owners exist without the shutdown hook"];
        }
      } @catch (NSException *exception) { [self nelyxFinishPrepare:exception.reason ?: @"Native shutdown exception"]; }
      } catch (const std::exception &error) { [self nelyxFinishPrepare:[NSString stringWithUTF8String:error.what()]]; } catch (...) { [self nelyxFinishPrepare:@"Native shutdown failed"]; }
    });
    } @catch (NSException *exception) { [self nelyxFinishPrepare:exception.reason ?: @"RN JS scheduler exception"]; }
    } catch (const std::exception &error) { [self nelyxFinishPrepare:[NSString stringWithUTF8String:error.what()]]; } catch (...) { [self nelyxFinishPrepare:@"RN JS scheduler failed"]; }
  }];
  } @catch (NSException *exception) { [self nelyxFinishPrepare:exception.reason ?: @"RN prepare exception"]; }
  } catch (const std::exception &error) { [self nelyxFinishPrepare:[NSString stringWithUTF8String:error.what()]]; } catch (...) { [self nelyxFinishPrepare:@"RN prepare failed"]; }
}

- (void)nelyxInvalidateWithCompletion:(void (^)(NSString *))completion
{
  _nelyxTeardown->sealAdmission();
  if (![NSThread isMainThread]) { dispatch_async(dispatch_get_main_queue(), ^{ [self nelyxInvalidateWithCompletion:completion]; }); return; }
  const auto phase = _nelyxTeardown->snapshot().phase;
  if (phase == nelyx::AppleRuntimeTeardown::Phase::destroyed) { completion(nil); return; }
  if (phase == nelyx::AppleRuntimeTeardown::Phase::failed) { completion(@"RN teardown failed; process restart required"); return; }
  if (_nelyxInvalidationWaiters.count >= 8) { completion(@"RN invalidation waiter capacity exceeded"); return; }
  if (!_nelyxInvalidationWaiters) _nelyxInvalidationWaiters = [NSMutableArray new];
  [_nelyxInvalidationWaiters addObject:[completion copy]];
  if (_nelyxInvalidationPending) return;
  _nelyxInvalidationPending = YES;
  [self nelyxPrepareRuntimeShutdown:^(NSString *error) {
    if (error) { [self nelyxFailTeardown:error]; return; }
    if (!self->_nelyxTeardown->claimDestruction()) { [self nelyxFailTeardown:@"RN destruction claim rejected"]; return; }
    [self nelyxWatchTeardownAfter:5];
    try { @try { [self nelyxInvalidateAfterDrain]; }
    @catch (NSException *exception) { [self nelyxFailTeardown:exception.reason ?: @"RN invalidation exception"]; }
    } catch (const std::exception &failure) { [self nelyxFailTeardown:[NSString stringWithUTF8String:failure.what()]]; } catch (...) { [self nelyxFailTeardown:@"RN invalidation failed"]; }
  }];
}

- (void)invalidate
{
  [self nelyxInvalidateWithCompletion:^(NSString *error) { if (error) RCTLogError(@"Nelyx RN invalidation refused: %@",error); }];
}

- (void)nelyxInvalidateAfterDrain
`;

  let instance = replaceOnce(
    originals['RCTInstance.mm'],
    '@implementation RCTInstance {',
    `@protocol NelyxRuntimeShutdownHook
+ (void)prepareRuntime:(void *)runtime completion:(void (^)(NSString *))completion;
+ (void)sealNativeAdmissionForRuntime:(void *)runtime generation:(uint64_t)generation;
@end

@implementation RCTInstance {`,
  );
  instance = replaceOnce(
    instance,
    '- (void)invalidate\n{',
    instanceMethod +
      '{\n  if (_nelyxTeardown->snapshot().phase != nelyx::AppleRuntimeTeardown::Phase::destroying) { [self nelyxFailTeardown:@"RN destruction bypassed its fence"]; return; }',
  );
  instance = replaceOnce(
    instance,
    '#import "RCTInstance.h"',
    '#import "RCTInstance.h"\n#include <atomic>\n#include "NelyxRuntimeTeardown.h"',
  );
  const registry = `// SPDX-License-Identifier: BSD-3-Clause (Nelyx addition)
// NELYX_RN_TEARDOWN_REGISTRY_BEGIN
static nelyx::AppleRuntimeGuardRegistry &nelyxAppleRuntimeGuards() { static auto *registry=new nelyx::AppleRuntimeGuardRegistry(); return *registry; }
#if defined(_WIN32)
#define NELYX_RN_GUARD_EXPORT __declspec(dllexport)
#else
#define NELYX_RN_GUARD_EXPORT __attribute__((visibility("default"),used))
#endif
extern "C" NELYX_RN_GUARD_EXPORT bool NelyxVerifyAppleRuntimeTeardownGuard(void *runtime,uint64_t generation) { return nelyxAppleRuntimeGuards().verify(runtime,generation); }
#undef NELYX_RN_GUARD_EXPORT
// NELYX_RN_TEARDOWN_REGISTRY_END
`;
  instance = replaceOnce(
    instance,
    '@implementation RCTInstance {',
    registry +
      '\n@implementation RCTInstance {\n  std::shared_ptr<nelyx::AppleRuntimeTeardown> _nelyxTeardown;\n  std::atomic<void *> _nelyxRuntimeIdentity;\n  std::atomic<uint64_t> _nelyxHostGeneration;\n  std::mutex _nelyxLeaseMutex;\n  RCTInstance *_nelyxRuntimeLease;\n  NSMutableArray *_nelyxShutdownWaiters;\n  NSMutableArray *_nelyxInvalidationWaiters;\n  BOOL _nelyxInvalidationPending;',
  );
  instance = replaceOnce(
    instance,
    '  if (self = [super init]) {',
    '  if (self = [super init]) {\n    _nelyxTeardown=std::make_shared<nelyx::AppleRuntimeTeardown>();\n    _nelyxRuntimeIdentity.store(nullptr);_nelyxHostGeneration.store(0);',
  );
  instance = replaceOnce(
    instance,
    '@interface RCTInstance () <RCTTurboModuleManagerDelegate>',
    '@interface RCTInstance () <RCTTurboModuleManagerDelegate>\n- (void)nelyxKeepRuntimeUntilDestruction;\n- (void)nelyxSettleInvalidation:(NSString *)error;\n- (void)nelyxFailTeardown:(NSString *)error;\n- (void)nelyxWatchTeardownAfter:(int)seconds;\n- (void)nelyxFinishPrepare:(NSString *)error;\n- (void)nelyxInvalidateAfterDrain;',
  );
  instance = replaceOnce(
    instance,
    '    // Clean up all the Resources',
    '    if (!self->_nelyxTeardown->beginFinalization()) { [self nelyxFailTeardown:@"RN finalization deadline expired"]; return; }\n    if (self->_nelyxRuntimeIdentity.load() && !nelyxAppleRuntimeGuards().remove(self->_nelyxRuntimeIdentity.load(),self->_nelyxHostGeneration.load())) { [self nelyxFailTeardown:@"RN runtime guard retirement unconfirmed"]; return; }\n    self->_nelyxRuntimeIdentity.store(nullptr);\n    // Clean up all the Resources',
  );
  instance = replaceOnce(
    instance,
    '    self->_jsThreadManager = nil;',
    '    self->_jsThreadManager = nil;\n    if (!self->_nelyxTeardown->finishDestruction()) { [self nelyxFailTeardown:@"RN finalization acknowledgement unconfirmed"]; return; }\n    { std::lock_guard<std::mutex> leaseLock(self->_nelyxLeaseMutex); self->_nelyxRuntimeLease=nil; }\n    dispatch_async(dispatch_get_main_queue(), ^{ [self nelyxSettleInvalidation:nil]; });',
  );
  instance = replaceOnce(
    instance,
    '  [_jsThreadManager dispatchToJSThread:^{\n    /**',
    '  [_jsThreadManager dispatchToJSThread:^{\n    try { @try {\n    /**',
  );
  instance = replaceOnce(
    instance,
    '    dispatch_async(dispatch_get_main_queue(), ^{ [self nelyxSettleInvalidation:nil]; });',
    '    dispatch_async(dispatch_get_main_queue(), ^{ [self nelyxSettleInvalidation:nil]; });\n    } @catch (NSException *exception) { [self nelyxFailTeardown:exception.reason ?: @"RN JS finalization exception"]; }\n    } catch (const std::exception &error) { [self nelyxFailTeardown:[NSString stringWithUTF8String:error.what()]]; } catch (...) { [self nelyxFailTeardown:@"RN JS finalization failed"]; }',
  );

  // Ordinary app dispatch stops immediately; SDK drain uses the unbuffered executor.
  instance = instance
    .replaceAll('if (_valid)', 'if (_valid && _nelyxTeardown->admissionOpen())')
    .replaceAll(
      'strongSelf && strongSelf->_valid',
      'strongSelf && strongSelf->_valid && strongSelf->_nelyxTeardown->admissionOpen()',
    );
  instance = instance.replaceAll(
    'if (!_valid)',
    'if (!_valid || !_nelyxTeardown->admissionOpen())',
  );
  instance = replaceOnce(
    instance,
    '  _reactInstance->getBufferedRuntimeExecutor()([=](jsi::Runtime &runtime) {\n    if (executor)',
    '  if (!_valid || !_nelyxTeardown->admissionOpen()) return;\n  __weak RCTInstance *weakOwner = self;\n  _reactInstance->getBufferedRuntimeExecutor()([=](jsi::Runtime &runtime) {\n    RCTInstance *owner = weakOwner;\n    if (!owner || !owner->_nelyxTeardown->admissionOpen()) return;\n    if (executor)',
  );
  instance = replaceOnce(
    instance,
    '    [weakSelf _handleJSError:error withRuntime:runtime];',
    '    if (error.isFatal) [weakSelf invalidate];\n    [weakSelf _handleJSError:error withRuntime:runtime];',
  );
  const marker = `// SPDX-License-Identifier: BSD-3-Clause (Nelyx addition)
    if (!strongSelf->_nelyxTeardown->admissionOpen()) return;
    [strongSelf nelyxKeepRuntimeUntilDestruction];
    const auto nelyxRuntimeTeardown=strongSelf->_nelyxTeardown;
    static std::atomic<uint64_t> nelyxHostSequence{0};
    const auto nelyxHostGeneration=++nelyxHostSequence;
    if (nelyxHostGeneration>9007199254740991ULL) throw jsi::JSError(runtime,"Apple native host generation exhausted");
    if (!nelyxAppleRuntimeGuards().add(&runtime,nelyxHostGeneration,nelyxRuntimeTeardown)) throw jsi::JSError(runtime,"RN runtime guard registration rejected");
    strongSelf->_nelyxRuntimeIdentity.store(&runtime);strongSelf->_nelyxHostGeneration.store(nelyxHostGeneration);
    jsi::Object nelyxHost(runtime);
    nelyxHost.setProperty(runtime,"abi",1);
    nelyxHost.setProperty(runtime,"shutdownProtocol",3);
    nelyxHost.setProperty(runtime,"platform",jsi::String::createFromAscii(runtime,"${target}"));
    nelyxHost.setProperty(runtime,"nativeReactNativeVersion",jsi::String::createFromAscii(runtime,"${nativeVersion}"));
    nelyxHost.setProperty(runtime,"generation",static_cast<double>(nelyxHostGeneration));
    nelyxHost.setProperty(runtime,"isTeardownRequested",jsi::Function::createFromHostFunction(runtime,jsi::PropNameID::forAscii(runtime,"isTeardownRequested"),0,[nelyxRuntimeTeardown](jsi::Runtime&,const jsi::Value&,const jsi::Value*,size_t)->jsi::Value{return jsi::Value(!nelyxRuntimeTeardown->admissionOpen());}));
    auto nelyxObject=runtime.global().getPropertyAsObject(runtime,"Object");
    nelyxObject.getPropertyAsFunction(runtime,"freeze").call(runtime,nelyxHost);
    jsi::Object nelyxDescriptor(runtime);
    nelyxDescriptor.setProperty(runtime,"value",std::move(nelyxHost));
    nelyxDescriptor.setProperty(runtime,"writable",false);
    nelyxDescriptor.setProperty(runtime,"configurable",false);
    nelyxObject.getPropertyAsFunction(runtime,"defineProperty").call(runtime,runtime.global(),jsi::String::createFromAscii(runtime,"NelyxAppleRuntimeHost"),nelyxDescriptor);
    // NELYX_RN_HOST_MARKER_END
    [strongSelf->_turboModuleManager installJSBindings:runtime];`;
  instance = replaceOnce(
    instance,
    '[strongSelf->_turboModuleManager installJSBindings:runtime];',
    marker,
  );
  const header = replaceOnce(
    originals['RCTInstance.h'],
    '- (void)invalidate;',
    '- (void)nelyxPrepareRuntimeShutdown:(void (^)(NSString *_Nullable error))completion;\n- (void)nelyxInvalidateWithCompletion:(void (^)(NSString *_Nullable error))completion;\n\n- (void)invalidate;',
  );
  const gated = `// SPDX-License-Identifier: BSD-3-Clause (Nelyx addition)
- (void)_reloadWithShouldRestartSurfaces:(BOOL)shouldRestartSurfaces
{
  if (![NSThread isMainThread]) {
    dispatch_async(dispatch_get_main_queue(), ^{ [self _reloadWithShouldRestartSurfaces:shouldRestartSurfaces]; }); return;
  }
  if (_nelyxReloadPending) return;
  if (!_instance) { [self _nelyxReloadAfterDrain:shouldRestartSurfaces]; return; }
  _nelyxReloadPending = YES;
  RCTInstance *previous = _instance;
  __weak RCTHost *weakSelf = self;
  __block BOOL completed = NO;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 35 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
    if (completed) return; completed = YES;
    static NSMutableArray<RCTInstance *> *retainedTimeouts;
    if (!retainedTimeouts) retainedTimeouts = [NSMutableArray new];
    [retainedTimeouts addObject:previous];
    RCTLogError(@"Nelyx runtime shutdown timed out before replacement; previous instance retained");
  });
  [previous nelyxInvalidateWithCompletion:^(NSString *error) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (completed) return; completed = YES;
      RCTHost *host = weakSelf;
      if (error || !host || host->_instance != previous) {
        static NSMutableArray<RCTInstance *> *retained;
        if (!retained) retained = [NSMutableArray new];
        [retained addObject:previous];
        RCTLogError(@"Nelyx runtime replacement denied: %@", error ?: @"host owner changed"); return;
      }
      host->_nelyxReloadPending = NO;
      [host _nelyxReloadAfterDrain:shouldRestartSurfaces];
    });
  }];
}

- (void)_nelyxReloadAfterDrain:(BOOL)shouldRestartSurfaces
{`;
  let host = replaceOnce(
    originals['RCTHost.mm'],
    '  RCTInstance *_instance;',
    '  RCTInstance *_instance;\n  BOOL _nelyxReloadPending;',
  );
  host = replaceOnce(
    host,
    '- (void)_reloadWithShouldRestartSurfaces:(BOOL)shouldRestartSurfaces\n{',
    gated,
  );
  const oldStart = host.match(
    /  if \(_instance\) \{\n    RCTLogWarn\([\s\S]*?\n    \[_instance invalidate\];\n  \}/,
  )?.[0];
  assert.ok(oldStart);
  host = replaceOnce(
    host,
    oldStart,
    '  if (_instance) { [self _reloadWithShouldRestartSurfaces:YES]; return; }',
  );
  return {
    'RCTHost.mm': host,
    'RCTInstance.mm': instance,
    'RCTInstance.h': header,
    'NelyxRuntimeTeardown.h': teardownHeader,
  };
}
function noLinks(file, root) {
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Apple runtime path outside owned root');
  for (let current = file; ; current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error('Apple runtime symlink: ' + current);
    if (current === root) break;
  }
}
export function patchAppleRuntime({ target, runner }) {
  if (!['ios', 'macos'].includes(target)) throw new Error('Apple target must be ios or macos');
  runner = path.resolve(runner);
  if (path.basename(runner) !== 'runner' || path.basename(path.dirname(runner)) !== target)
    throw new Error('Apple target does not match its owning <target>/runner root');
  if (!fs.existsSync(path.join(runner, 'package.json')))
    throw new Error('Independent Apple runner manifest required');
  noLinks(path.join(runner, 'package.json'), runner);
  const load = createRequire(path.join(runner, 'package.json'));
  const { inspectRunnerCohort } = load('@nelyx/metro/runner-config');
  const cohort = inspectRunnerCohort({
    target,
    runnerRoot: runner,
    appRoot: path.resolve(runner, '../..'),
  });
  const pinned = lock.targets[target],
    framework = cohort.reactNativeFacadeRoot;
  assert.equal(
    path.relative(path.join(runner, 'node_modules'), framework).startsWith('..'),
    false,
    'Runner-owned framework required',
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(framework, 'package.json'), 'utf8')).version,
    pinned.version,
    'Pinned native framework version',
  );
  const directory = path.join(framework, 'ReactCommon/react/runtime/platform/ios/ReactCommon');
  const headerFile = path.join(
    path.dirname(load.resolve('@nelyx/sdk/package.json')),
    'native/apple/AppleRuntimeTeardown.h',
  );
  noLinks(headerFile, runner);
  const teardownHeader = fs.readFileSync(headerFile, 'utf8');
  assert.equal(sha(teardownHeader), lock.teardownHeaderSha256, 'Pinned RN teardown header drift');
  const originalsDirectory = path.join(runner, '.nelyx', 'apple-runtime-' + target, 'originals');
  const originals = {},
    current = {};
  for (const name of Object.keys(pinned.files)) {
    const file = path.join(directory, name),
      saved = path.join(originalsDirectory, name);
    noLinks(file, runner);
    noLinks(saved, runner);
    current[name] = fs.readFileSync(file);
    const bytes = fs.existsSync(saved) ? fs.readFileSync(saved) : current[name];
    assert.equal(sha(bytes), pinned.files[name], name + ' pinned original source drift');
    originals[name] = bytes.toString('utf8');
  }
  const extra = 'NelyxRuntimeTeardown.h',
    extraFile = path.join(directory, extra);
  noLinks(extraFile, runner);
  current[extra] = fs.existsSync(extraFile) ? fs.readFileSync(extraFile) : undefined;
  const patched = renderPatchedFiles(originals, target, pinned.version, teardownHeader),
    names = Object.keys(patched);
  for (const name of names)
    assert.equal(
      sha(patched[name]),
      pinned.patchedFiles[name],
      name + ' reviewed protocol3 patch drift',
    );
  const isBase = names.every((name) =>
    pinned.files[name] ? sha(current[name]) === pinned.files[name] : current[name] === undefined,
  );
  const isPatched = names.every(
    (name) => current[name] !== undefined && sha(current[name]) === sha(patched[name]),
  );
  if (!isBase && !isPatched)
    throw new Error('Apple runtime has altered or partially patched source; no files changed');
  if (isBase) {
    fs.mkdirSync(originalsDirectory, { recursive: true });
    for (const name of Object.keys(pinned.files))
      if (!fs.existsSync(path.join(originalsDirectory, name)))
        fs.writeFileSync(path.join(originalsDirectory, name), originals[name], { flag: 'wx' });
    const staged = [],
      changed = [];
    try {
      for (const name of names) {
        const file = path.join(directory, name);
        if (pinned.files[name])
          assert.equal(
            sha(fs.readFileSync(file)),
            pinned.files[name],
            name + ' changed before staging',
          );
        else assert.ok(!fs.existsSync(file), 'New header appeared before staging');
        const temporary = file + '.nelyx-' + randomUUID();
        fs.writeFileSync(temporary, patched[name], { flag: 'wx' });
        staged.push({ name, file, temporary });
      }
      for (const entry of staged) {
        if (pinned.files[entry.name])
          assert.equal(
            sha(fs.readFileSync(entry.file)),
            pinned.files[entry.name],
            entry.name + ' changed before publication',
          );
        else assert.ok(!fs.existsSync(entry.file), 'New header appeared before publication');
        fs.renameSync(entry.temporary, entry.file);
        changed.push(entry);
      }
      for (const name of names)
        assert.equal(sha(fs.readFileSync(path.join(directory, name))), sha(patched[name]));
    } catch (error) {
      const failed = [];
      for (const entry of changed.reverse())
        try {
          assert.equal(
            sha(fs.readFileSync(entry.file)),
            sha(patched[entry.name]),
            'foreign change during rollback',
          );
          if (pinned.files[entry.name]) fs.writeFileSync(entry.file, originals[entry.name]);
          else fs.unlinkSync(entry.file);
        } catch (rollback) {
          failed.push(String(rollback));
        }
      if (failed.length)
        throw new AggregateError(
          [error, ...failed],
          'Apple runtime patch rollback could not be confirmed',
        );
      throw error;
    } finally {
      for (const entry of staged)
        if (fs.existsSync(entry.temporary)) fs.unlinkSync(entry.temporary);
    }
  }
  return {
    result: 'PASS-scoped',
    target,
    package: pinned.package,
    version: pinned.version,
    shutdownProtocol: 3,
    applied: isBase,
    files: names.map((file) => ({
      file,
      baseSha256: pinned.files[file] ?? null,
      sha256: sha(patched[file]),
    })),
    nativeCompileRuntime: 'SKIPPED/notVerified',
  };
}
