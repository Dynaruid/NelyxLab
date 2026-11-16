// Inlined only when NELYX_NATIVE_GC_STATS=1; excluded from FPS acceptance.
// No collection is forced. Hermes' pause counter excludes pre-GC mutex waits.
export function heapProfileSnapshot(profileHost: {
  heapInfo(): { heap: Record<string, number>; gcStatsEnabled: boolean; gc?: string };
}) {
  const result = profileHost.heapInfo();
  if (!result.gcStatsEnabled || typeof result.gc !== 'string')
    throw Error('Native GC statistics were not enabled');
  // printAllCollectedStats emits a collector dump, then this named JSON section.
  // Parsing the whole report would interpret the leading "GC stats:" as JSON.
  const marker = 'GC stats:\n',
    start = result.gc.lastIndexOf(marker);
  if (start < 0) throw Error('Native GC report has no statistics marker');
  const parsed: unknown = JSON.parse(result.gc.slice(start + marker.length));
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('general' in parsed) ||
    !parsed.general ||
    typeof parsed.general !== 'object'
  )
    throw Error('Native GC statistics have no general section');
  const general: Record<string, number> = {};
  for (const key of [
    'numCollections',
    'totalTime',
    'totalCPUTime',
    'totalGCTime',
    'maxGCPause',
    'totalGCCPUTime',
    'maxGCCPUPause',
    'finalHeapSize',
    'peakAllocatedBytes',
    'peakLiveAfterGC',
    'totalAllocatedBytes',
  ]) {
    const value: unknown = Reflect.get(parsed.general, key);
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw Error('Native GC statistic is invalid: ' + key);
    general[key] = value;
  }
  return { heap: result.heap, general };
}
