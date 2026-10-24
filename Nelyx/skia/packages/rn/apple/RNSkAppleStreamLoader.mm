// SPDX-License-Identifier: BSD-3-Clause
#import "RNSkAppleStreamLoader.h"
#import "RNSkUIKit.h"
#include "AppleStreamFile.h"
#import <ImageIO/ImageIO.h>
#include <unordered_map>

using RNSkia::AppleStreamBuffer;
using RNSkia::AppleStreamState;
struct AppleStreamRecord {
  std::shared_ptr<AppleStreamBuffer> buffer;
  std::function<void(sk_sp<SkData>)> completion;
  NSURLSessionDataTask *__strong task = nil;
  bool completed = false;
};
static sk_sp<SkData> streamData(const std::shared_ptr<AppleStreamBuffer> &buffer) {
  if (!buffer->size()) return SkData::MakeEmpty();
  auto *owner = new std::shared_ptr<AppleStreamBuffer>(buffer);
  return SkData::MakeWithProc(buffer->data(), buffer->size(),
      [](const void *, void *context) { delete static_cast<std::shared_ptr<AppleStreamBuffer> *>(context); }, owner);
}
static size_t writePng(void *context, const void *data, size_t count) {
  return static_cast<AppleStreamBuffer *>(context)->append(data, count) ? count : 0;
}

@interface RNSkAppleStreamLoader () <NSURLSessionDataDelegate>
- (std::shared_ptr<AppleStreamRecord>)record:(uint64_t)identifier;
- (uint64_t)identifierForTask:(NSURLSessionTask *)task;
- (void)complete:(uint64_t)identifier success:(BOOL)success;
- (void)retire:(uint64_t)identifier;
- (void)expire;
- (void)readFile:(NSURL *)url identifier:(uint64_t)identifier;
- (void)readNamedImage:(NSString *)name identifier:(uint64_t)identifier;
@end

@implementation RNSkAppleStreamLoader {
  std::shared_ptr<AppleStreamState> _state;
  std::mutex _mutex;
  std::unordered_map<uint64_t, std::shared_ptr<AppleStreamRecord>> _records;
  NSURLSession *_session;
  NSOperationQueue *_delegateQueue;
  NSOperationQueue *_fileQueue;
  dispatch_source_t _deadline;
}
- (instancetype)init {
  if (self = [super init]) {
    _state = std::make_shared<AppleStreamState>();
    _delegateQueue = [NSOperationQueue new]; _delegateQueue.maxConcurrentOperationCount = 1;
    _fileQueue = [NSOperationQueue new]; _fileQueue.maxConcurrentOperationCount = 4;
    NSURLSessionConfiguration *configuration = [NSURLSessionConfiguration ephemeralSessionConfiguration];
    configuration.timeoutIntervalForRequest = 15; configuration.timeoutIntervalForResource = 30;
    configuration.HTTPMaximumConnectionsPerHost = 4; configuration.URLCache = nil;
    configuration.requestCachePolicy = NSURLRequestReloadIgnoringLocalCacheData;
    _session = [NSURLSession sessionWithConfiguration:configuration delegate:self delegateQueue:_delegateQueue];
    _deadline = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0,
        dispatch_queue_create("org.nelyx.apple.stream-deadlines", DISPATCH_QUEUE_SERIAL));
    dispatch_source_set_timer(_deadline, dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC),
        100 * NSEC_PER_MSEC, 10 * NSEC_PER_MSEC);
    __weak RNSkAppleStreamLoader *weakSelf = self;
    dispatch_source_set_event_handler(_deadline, ^{ [weakSelf expire]; });
    dispatch_resume(_deadline);
  }
  return self;
}
- (void)loadURI:(const std::string &)uri limit:(size_t)limit
    completion:(std::function<void(sk_sp<SkData>)>)completion {
  if (!completion) return;
  if (uri.empty() || uri.size() > 8192 || uri.find('\0') != std::string::npos) { completion(nullptr); return; }
  NSString *source = [[NSString alloc] initWithBytes:uri.data() length:uri.size() encoding:NSUTF8StringEncoding];
  NSURL *url = source ? [NSURL URLWithString:source] : nil;
  NSString *scheme = url.scheme.lowercaseString;
  const bool named = url && !scheme.length && !url.pathExtension.length;
  const bool file = url.isFileURL;
  const bool network = [scheme isEqualToString:@"http"] || [scheme isEqualToString:@"https"];
  if (!url || (!named && !file && !network)) { completion(nullptr); return; }
  uint64_t identifier = 0;
  try {
    std::lock_guard lock(_mutex);
    identifier = _state->admit(limit);
    auto record = std::make_shared<AppleStreamRecord>();
    record->buffer = std::make_shared<AppleStreamBuffer>(_state, identifier);
    record->completion = completion;
    if (network) {
      if (!_session) throw std::runtime_error("Apple URL session is closed");
      record->task = [_session dataTaskWithURL:url];
      if (!record->task) throw std::runtime_error("Apple URL task unavailable");
    }
    _records.emplace(identifier, record);
    if (network) [record->task resume];
  } catch (...) {
    if (identifier) { _state->retireJob(identifier); _state->releasePayload(identifier); }
    completion(nullptr); return;
  }
  // Blocks keep only native state alive. Queued work observes cancellation
  // before accessing UIKit/AppKit, a file descriptor or its payload storage.
  if (named) dispatch_async(dispatch_get_main_queue(), ^{ [self readNamedImage:source identifier:identifier]; });
  else if (file) [_fileQueue addOperationWithBlock:^{ @autoreleasepool { [self readFile:url identifier:identifier]; } }];
}
- (std::shared_ptr<AppleStreamRecord>)record:(uint64_t)identifier {
  std::lock_guard lock(_mutex); auto found = _records.find(identifier);
  return found == _records.end() ? nullptr : found->second;
}
- (uint64_t)identifierForTask:(NSURLSessionTask *)task {
  std::lock_guard lock(_mutex);
  for (const auto &[identifier, record] : _records) if (record->task == task) return identifier;
  return 0;
}
- (void)complete:(uint64_t)identifier success:(BOOL)success {
  std::function<void(sk_sp<SkData>)> completion;
  std::shared_ptr<AppleStreamBuffer> buffer;
  {
    std::lock_guard lock(_mutex); auto found = _records.find(identifier);
    if (found == _records.end() || found->second->completed) return;
    auto &record = *found->second; record.completed = true;
    completion = std::move(record.completion); buffer = record.buffer;
  }
  if (!success) _state->cancel(identifier);
  if (completion) {
    sk_sp<SkData> data;
    if (success && _state->valid(identifier)) {
      try { data = streamData(buffer); } catch (...) { _state->cancel(identifier); }
    }
    try { completion(std::move(data)); }
    catch (...) { _state->cancel(identifier); }
  }
}
- (void)retire:(uint64_t)identifier {
  std::shared_ptr<AppleStreamRecord> retired;
  { std::lock_guard lock(_mutex); auto found = _records.find(identifier);
    if (found == _records.end()) return;
    retired = std::move(found->second); _records.erase(found); }
  _state->retireJob(identifier);
}
- (void)expire {
  for (auto identifier : _state->expire()) {
    auto record = [self record:identifier];
    [self complete:identifier success:NO]; if (record) [record->task cancel];
  }
}
- (void)readFile:(NSURL *)url identifier:(uint64_t)identifier {
  auto record = [self record:identifier];
  const bool success = record && RNSkia::readAppleStreamFile(url.fileSystemRepresentation, *_state, identifier, *record->buffer);
  [self complete:identifier success:success]; [self retire:identifier];
}
- (void)readNamedImage:(NSString *)name identifier:(uint64_t)identifier {
  NSCAssert([NSThread isMainThread], @"Named Apple image loading requires the main owner");
  auto record = [self record:identifier]; bool success = false;
  if (record && _state->valid(identifier)) {
#if TARGET_OS_OSX
    NSImage *image = [NSImage imageNamed:name];
    CGImageRef pixels = [image CGImageForProposedRect:nullptr context:nil hints:nil];
#else
    UIImage *image = [UIImage imageNamed:name]; CGImageRef pixels = image.CGImage;
#endif
    if (pixels && CGImageGetWidth(pixels) <= 4096 && CGImageGetHeight(pixels) <= 4096 &&
        CGImageGetWidth(pixels) * CGImageGetHeight(pixels) <= 4 * 1024 * 1024) {
      CGDataConsumerCallbacks callbacks = {writePng, nullptr};
      CGDataConsumerRef consumer = CGDataConsumerCreate(record->buffer.get(), &callbacks);
      CGImageDestinationRef destination = consumer ? CGImageDestinationCreateWithDataConsumer(consumer, CFSTR("public.png"), 1, nullptr) : nullptr;
      if (destination) { CGImageDestinationAddImage(destination, pixels, nullptr); success = CGImageDestinationFinalize(destination); CFRelease(destination); }
      if (consumer) CFRelease(consumer);
    }
  }
  [self complete:identifier success:success]; [self retire:identifier];
}
- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)task
    didReceiveResponse:(NSURLResponse *)response completionHandler:(void (^)(NSURLSessionResponseDisposition))handler {
  (void)session; auto identifier = [self identifierForTask:task];
  bool allowed = identifier && [response isKindOfClass:[NSHTTPURLResponse class]] &&
      ((NSHTTPURLResponse *)response).statusCode >= 200 && ((NSHTTPURLResponse *)response).statusCode < 300 &&
      _state->expectedLength(identifier, response.expectedContentLength);
  handler(allowed ? NSURLSessionResponseAllow : NSURLSessionResponseCancel);
  if (!allowed) [self complete:identifier success:NO];
}
- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)task didReceiveData:(NSData *)data {
  (void)session; auto identifier = [self identifierForTask:task]; auto record = [self record:identifier];
  if (!record || !record->buffer->append(data.bytes, data.length)) {
    [self complete:identifier success:NO]; [task cancel];
  }
}
- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didCompleteWithError:(NSError *)error {
  (void)session; auto identifier = [self identifierForTask:task];
  [self complete:identifier success:error == nil]; [self retire:identifier];
}
- (void)close {
  NSURLSession *session;
  { std::lock_guard lock(_mutex); _state->close();
    for (auto &[identifier, record] : _records) { (void)identifier; record->completion = {}; }
    session = _session; _session = nil;
    if (_deadline) { dispatch_source_cancel(_deadline); _deadline = nil; } }
  // The session retains its delegate until cancellation is confirmed. File
  // and main blocks retire themselves after observing the closed state.
  [session invalidateAndCancel];
}
- (RNSkia::AppleStreamSnapshot)snapshot { return _state->snapshot(); }
- (void)dealloc { if (_deadline) dispatch_source_cancel(_deadline); }
@end
