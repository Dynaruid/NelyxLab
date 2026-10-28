// SPDX-License-Identifier: BSD-3-Clause
/** An explicit package is a chosen snapshot. Default run follows installed SDK
 * bytes, retaining the last package's engine, compiler and execution mode. */
export async function prepareWindowsRun({app,directory,hermesMode},{packageFor,readInputs,build,onRebuild=()=>{}}){
  let verified=packageFor(app,directory);
  if(directory){
    if(hermesMode!==undefined&&hermesMode!==(verified.manifest.hermesExecutionMode??'bytecode'))throw Error('Explicit Windows package has a different Hermes execution mode');
    return verified;
  }
  const manifest=verified.manifest,current=readInputs(app),mode=hermesMode??manifest.hermesExecutionMode??'bytecode';
  if(manifest.sdkInputsSha256===current&&mode===(manifest.hermesExecutionMode??'bytecode'))return verified;
  const options={app,configuration:manifest.configuration,engine:manifest.cohort.engine,hermesMode:mode,
    ...(manifest.cohort.engine==='hermes'?{hermesProfile:manifest.hermesCompilerProfile??'debug'}:{}),
    ...(manifest.cohort.engine==='jsc'?{jscMode:manifest.jscExecutionMode}:{})};
  onRebuild();await build(options);
  verified=packageFor(app);
  if(verified.manifest.sdkInputsSha256!==readInputs(app))throw Error('Windows rebuild did not capture the current installed SDK');
  return verified;
}
