// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
// Real Chrome EditContext/CDP input is distinct from physical OS IME qualification.
// Uses the current supplied Web build and an installed Chrome. Playwright is
// installed offline for this execution and the complete temporary owner retires.
for(const {fallback,dom} of [{fallback:false,dom:false},{fallback:true,dom:false},{fallback:true,dom:true}])test('current Core/Skia input and Chrome EditContext preserve editing across semantic parent replacement '+(dom?'using nonvisual DOM input':fallback?'without moveBefore':'with moveBefore'),{timeout:1_200_000},async()=>{

var fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path'), http = await import('node:http');
var childProcess = await import('node:child_process'), moduleApi = await import('node:module');
var assert = moduleApi.createRequire(process.cwd() + '/package.json')('node:assert/strict');
assert(fs.existsSync(path.join(process.cwd(),'sample/nelyx-testbed-app-2/.nelyx/web/application.js')),'Build the current testbed Web runner before this test');
var disk=fs.statfsSync(process.cwd());assert(disk.bavail*disk.bsize>=20*1024**3,'At least 20 GiB of free disk is required');
var temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nelyx-w13-browser-'));
var browser, server, context, page;
try {
  var install = childProcess.spawnSync('cmd.exe', ['/d', '/c', 'npm.cmd', 'install', '--prefix', temp, 'playwright@1.64.0', '--offline', '--ignore-scripts', '--no-package-lock', '--no-audit', '--no-fund'], {encoding:'utf8',timeout:1200000,windowsHide:true});
  assert.equal(install.status,0,install.stdout+install.stderr);
  var {chromium} = moduleApi.createRequire(path.join(temp,'package.json'))('playwright');
  var output=path.join(process.cwd(),'sample/nelyx-testbed-app-2/.nelyx/web');
  server=http.createServer((request,response)=>{
    if(request.url==='/favicon.ico'){response.writeHead(204);response.end();return;}
    var file=path.resolve(output,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname));
    if(file===output)file=path.join(output,'index.html');
    if(!file.startsWith(output+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end();return;}
    response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.ttf':'font/ttf','.otf':'font/otf','.webp':'image/webp'})[path.extname(file)]??'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  context=await browser.newContext({viewport:{width:1200,height:900}});page=await context.newPage();var errors=[];
  await page.addInitScript(()=>{window.nelyxCompositionScriptDispatch=[];const dispatch=EventTarget.prototype.dispatchEvent;EventTarget.prototype.dispatchEvent=function(event){if(event.type.startsWith('composition'))window.nelyxCompositionScriptDispatch.push({type:event.type,stack:new Error().stack});return dispatch.call(this,event);};});
  await page.addInitScript(()=>{window.nelyxInputFocus=[];for(const type of ['focusin','focusout'])document.addEventListener(type,event=>{window.nelyxInputFocus.push([type,event.target.tagName,event.target.getAttribute('aria-label'),type==='focusout'?new Error().stack:undefined]);if(window.nelyxInputFocus.length>30)window.nelyxInputFocus.shift();},true);});
  await page.addInitScript(()=>{
    window.nelyxCoreCaretBounds=new WeakMap();if(typeof EditContext!=='function')return;const update=EditContext.prototype.updateSelectionBounds;
    EditContext.prototype.updateSelectionBounds=function(rect){update.call(this,rect);window.nelyxCoreCaretBounds.set(this,{x:rect.x,y:rect.y,width:rect.width,height:rect.height,anchor:this.selectionStart,focus:this.selectionEnd});};
  });
  page.on('pageerror',error=>errors.push(String(error)));var consoleErrors=[];page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  if(dom)await page.addInitScript(()=>Object.defineProperty(globalThis,'EditContext',{configurable:true,value:undefined}));
  if(fallback)await page.addInitScript(()=>Object.defineProperty(Element.prototype,'moveBefore',{configurable:true,writable:true,value:undefined}));
  await page.goto('http://127.0.0.1:'+server.address().port);
  var click=async name=>{var locator=page.getByRole('button',{name,exact:true});await locator.waitFor({state:'visible',timeout:30000});var box=await locator.boundingBox();assert(box);await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(150);};


  const activate=async name=>{await page.getByRole('button',{name,exact:true}).or(page.locator('button[aria-description='+JSON.stringify(name)+']')).first().evaluate(element=>element.click());await page.waitForTimeout(100);};
  if(!fallback&&!dom){
    // Exercise the current supplied list recording with real browser pointer,
    // wheel and viewport changes before returning to the retained gallery.
    await click('ListView');const row=page.getByRole('button',{name:/항목 0001/}).first();await row.waitFor({state:'visible',timeout:10000});
    const initial=await row.boundingBox();assert(initial);await page.mouse.click(initial.x+initial.width/2,initial.y+initial.height/2);await page.waitForTimeout(250);assert.equal(await row.getAttribute('aria-selected'),'true');
    await page.mouse.move(initial.x+initial.width/2,initial.y+initial.height/2);await page.mouse.wheel(0,40);await page.waitForTimeout(250);const partial=await row.boundingBox();assert(partial&&(partial.height<initial.height-10||partial.y<initial.y-10),'Actual browser wheel must move the selected partial row');
    await click('끝으로');await page.getByRole('button',{name:/항목 1000/}).first().waitFor({state:'visible',timeout:10000});await click('처음으로');assert.equal(await row.getAttribute('aria-selected'),'true');
    await page.setViewportSize({width:800,height:700});await page.waitForTimeout(250);assert.equal(await row.getAttribute('aria-selected'),'true');await page.setViewportSize({width:1200,height:900});await page.waitForTimeout(250);
    await activate('갤러리로 돌아가기');await page.getByRole('button',{name:'ListView',exact:true}).waitFor({state:'visible',timeout:10000});
  }
  const value=field=>field.evaluate(element=>element.editContext?.text??element.value);
  const type=async(field,text)=>{await field.focus();await page.waitForTimeout(100);await page.keyboard.press('Control+a');await page.waitForTimeout(100);assert(await field.evaluate(element=>document.activeElement===element),'The OS input connection keeps focus before native insertion');await page.keyboard.insertText(text);await page.waitForTimeout(100);assert.equal(await value(field),text);};
  const scrollDemo=async field=>{
    const read=()=>field.evaluate(element=>({text:element.editContext?.text??element.value,selection:element.editContext?{anchor:element.editContext.selectionStart,focus:element.editContext.selectionEnd}:{anchor:element.selectionStart,focus:element.selectionEnd,direction:element.selectionDirection},caret:element.editContext?window.nelyxCoreCaretBounds.get(element.editContext):null}));
    const before=await read();await click('Scroll to top');const top=await read(),box=await field.boundingBox();
    await click('Scroll to end');const end=await read();
    for(const state of [top,end]){assert.equal(state.text,before.text);assert.deepEqual(state.selection,before.selection);}
    assert(await field.evaluate(element=>document.activeElement===element),'The public scroll controls preserve the actual OS input focus');
    if(!dom)assert(top.caret.y>end.caret.y+10,'The same Core caret moves with the public controller while its selection is unchanged: '+JSON.stringify({top,end}));
    await click('Scroll to top');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,36);await page.waitForTimeout(250);
    const wheel=await read(),wheelBox=await field.boundingBox();assert.equal(wheel.text,before.text);assert.deepEqual(wheel.selection,before.selection);
    assert(Math.abs(wheelBox.y-box.y)<1,'The inner editor consumes the real wheel without moving its outer viewport');
    if(!dom)assert(wheel.caret.y<top.caret.y-10,'The real wheel scrolls the painted Core paragraph');
    await click('Scroll to end');
  };
  const visualBidi=async field=>{
    const previous=await value(field);await type(field,'abc אבג def');await field.press('Home');const element=await field.elementHandle();
    try{
      const caret=async offset=>{if(dom){await page.waitForFunction(({element,offset})=>element.selectionStart===offset&&element.selectionEnd===offset,{element,offset},{timeout:10000});return null;}await page.waitForFunction(({element,offset})=>{const input=element.editContext,rect=window.nelyxCoreCaretBounds.get(input);return input.selectionStart===offset&&input.selectionEnd===offset&&rect?.anchor===offset&&rect?.focus===offset&&rect.height>0;},{element,offset},{timeout:10000});return field.evaluate(element=>window.nelyxCoreCaretBounds.get(element.editContext));};
      let x=(await caret(0))?.x;
      for(const offset of [1,2,3,4,6,5,4,8,9,10,11]){await field.press('ArrowRight');const rect=await caret(offset);if(rect){assert(rect.x>=x,'The actual OS bounds move right through the opposite-direction run');x=rect.x;}}
      for(const offset of [10,9,8,7,5,6,7,3,2,1,0]){await field.press('ArrowLeft');const rect=await caret(offset);if(rect){assert(rect.x<=x,'The actual OS bounds move left through the opposite-direction run');x=rect.x;}}
    }finally{await element.dispose();}
    await type(field,previous);
  };
  const session=await context.newCDPSession(page);
  const compose=async(field,text)=>{await field.focus();await page.keyboard.press('Control+a');await session.send('Input.imeSetComposition',{text,selectionStart:text.length,selectionEnd:text.length});await page.waitForTimeout(100);};
  const commit=async text=>{await session.send('Input.insertText',{text});await page.waitForTimeout(150);};
  await click('Text inputs');await page.waitForTimeout(100);assert.deepEqual(errors,[], 'Entering the Core editor must not report a browser error');
  var field=page.getByRole('textbox',{name:'Write something',exact:true});await field.waitFor({state:'visible',timeout:10000});
  assert.equal(await field.evaluate(element=>element.tagName),dom?'INPUT':'DIV');assert.equal(await field.getAttribute(dom?'data-nelyx-input-carrier':'data-nelyx-edit-context'),'true');assert.equal(await field.textContent(),'');
  const box=await field.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(100);assert(await field.evaluate(element=>document.activeElement===element),'Canvas tap focuses the nonvisual OS input connection');
  await type(field,'e\u0301🇰🇷');assert.equal(await field.getAttribute('aria-valuetext'),'e\u0301🇰🇷');
  const selection=()=>field.evaluate(element=>element.editContext?{anchor:element.editContext.selectionStart,focus:element.editContext.selectionEnd}:element.selectionDirection==='backward'?{anchor:element.selectionEnd,focus:element.selectionStart}:{anchor:element.selectionStart,focus:element.selectionEnd});
  const beforeDisabled=await selection();await click('Disable selection');const disabledBox=await field.boundingBox();await page.mouse.click(disabledBox.x+2,disabledBox.y+disabledBox.height/2);await page.waitForTimeout(100);assert(await field.evaluate(element=>document.activeElement===element));await field.press('Control+a');assert.deepEqual(await selection(),beforeDisabled,'Disabled interactive selection retains the actual OS caret across tap and Ctrl+A');assert.equal(await value(field),'e\u0301🇰🇷');await click('Enable selection');
  await click('Secure input');assert.equal(await field.getAttribute('type'),'password');assert.equal(await field.getAttribute('data-nelyx-input-carrier'),'true');
  await type(field,'e\u0301🇰🇷x');await field.press('Home');await field.press('ArrowRight');
  assert.equal(await field.evaluate(element=>element.selectionStart),2,'Secure input uses Core grapheme navigation');
  await field.press('Delete');await page.waitForTimeout(100);assert.equal(await value(field),'e\u0301x');
  await field.press('Control+z');await page.waitForTimeout(100);assert.equal(await value(field),'e\u0301🇰🇷x');
  assert.equal(await field.evaluate(element=>getComputedStyle(element).opacity),'0');
  await click('Show input');await type(field,'e\u0301🇰🇷');
  await type(field,'one,   two');await field.press('Control+Home');await field.press('Control+ArrowRight');await page.waitForTimeout(100);
  assert.equal(await field.evaluate(element=>element.editContext?.selectionEnd??element.selectionEnd),3,'Core Ctrl-Right uses the first Unicode word end');
  await field.press('Control+Shift+ArrowRight');await page.waitForTimeout(100);
  assert.deepEqual(await field.evaluate(element=>element.editContext?{anchor:element.editContext.selectionStart,focus:element.editContext.selectionEnd}:{anchor:element.selectionStart,focus:element.selectionEnd}),{anchor:3,focus:10},'Core word selection skips punctuation and spaces in the real browser');
  await field.press('Control+Backspace');await page.waitForTimeout(100);assert.equal(await value(field),'one');await field.press('Control+z');await page.waitForTimeout(100);assert.equal(await value(field),'one,   two');
  await field.press('Control+End');await field.press('Control+Backspace');await page.waitForTimeout(100);assert.equal(await value(field),'one,   ');await field.press('Control+z');await page.waitForTimeout(100);assert.equal(await value(field),'one,   two');
  await type(field,'e\u0301🇰🇷');
  await field.evaluate(element=>{element.dataset.w13Editor='stable';(element.editContext??element).addEventListener('compositionstart',event=>{element.dataset.trustedComposition=String(event.isTrusted);});});
  await compose(field,'한'.repeat(21));assert.equal(await value(field),'한'.repeat(21));assert.equal(await field.getAttribute('data-trusted-composition'),'true');
  if(!dom){const characterBounds=await field.evaluate(element=>({start:element.editContext.characterBoundsRangeStart,rects:element.editContext.characterBounds().map(rect=>rect.toJSON()),field:element.getBoundingClientRect().toJSON()}));
  assert.equal(characterBounds.start,0);assert.equal(characterBounds.rects.length,21,'The real browser character-bounds request is answered by the current Core paragraph');
  assert(characterBounds.rects.every(rect=>Number.isFinite(rect.x)&&Number.isFinite(rect.y)&&rect.width>0&&rect.height>0&&rect.x>=characterBounds.field.x-1&&rect.y>=characterBounds.field.y-1));}
  else assert.deepEqual(await field.evaluate(element=>({opacity:getComputedStyle(element).opacity,pointerEvents:getComputedStyle(element).pointerEvents,caret:getComputedStyle(element).caretColor})),{opacity:'0',pointerEvents:'none',caret:'rgba(0, 0, 0, 0)'});
  // Semantic activation changes theme without transferring OS input focus.
  await activate('Dark mode');await page.setViewportSize({width:390,height:498});await page.waitForTimeout(150);
  assert.equal(await field.getAttribute('data-w13-editor'),'stable');assert.equal(await value(field),'한'.repeat(21));assert(await field.evaluate(element=>document.activeElement===element));
  var keyboardBox=await field.boundingBox();assert(keyboardBox.y>=0&&keyboardBox.y+keyboardBox.height<=499);
  await page.setViewportSize({width:1440,height:1200});await commit('한'.repeat(21));assert.equal(await value(field),'한'.repeat(20));assert.equal(await field.getAttribute('aria-valuetext'),'한'.repeat(20));
  if(!fallback&&process.env.NELYX_WEB_PREVIEW)await page.screenshot({path:process.env.NELYX_WEB_PREVIEW,clip:{x:240,y:280,width:1180,height:670}});
  await page.keyboard.press('Shift+ArrowLeft');const directed=await field.evaluate(element=>element.editContext?{anchor:element.editContext.selectionStart,focus:element.editContext.selectionEnd}:element.selectionDirection==='backward'?{anchor:element.selectionEnd,focus:element.selectionStart}:{anchor:element.selectionStart,focus:element.selectionEnd});assert(directed.anchor>directed.focus,'Core directional selection reaches the actual EditContext');await visualBidi(field);
  var name=page.getByRole('textbox',{name:'Name',exact:true}),email=page.getByRole('textbox',{name:'Email',exact:true});
  await click('Save form');assert(await field.evaluate(element=>document.activeElement!==element),'A real outside canvas click releases the Core editor OS focus');await page.locator('[aria-label*="이름을 입력하세요."]').first().waitFor({state:'attached',timeout:10000});
  await type(name,'Ada');await name.press('Enter');await page.waitForTimeout(100);assert(await email.evaluate(element=>document.activeElement===element));
  await type(email,'ada@example.com');await email.press('Enter');await page.waitForTimeout(100);assert(await page.locator('[aria-label*="Saved: Ada · ada@example.com"]').count()>0);
  await click('Reset form');await page.waitForTimeout(100);assert.equal(await value(name),'');assert.equal(await value(email),'');
  var message=page.getByRole('textbox',{name:'Your message',exact:true});await type(message,'First\nSecond');assert.equal((await message.boundingBox()).height,48);
  await message.press('Enter');await page.waitForTimeout(100);assert.equal(await value(message),'First\nSecond\n');assert.equal((await message.boundingBox()).height,72);
  const longMessage='Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';await type(message,longMessage);assert.equal((await message.boundingBox()).height,96);
  await message.press('Control+Enter');await page.waitForTimeout(100);assert(await page.locator('[aria-label*="Message submitted"]').count()>0);
  await scrollDemo(message);
  await message.press('Control+Home');await page.waitForTimeout(100);const selectionBox=await message.boundingBox();
  await page.mouse.move(selectionBox.x+1,selectionBox.y+10);await page.mouse.down();
  await page.mouse.move(selectionBox.x+1,selectionBox.y+40,{steps:3});
  await page.mouse.move(selectionBox.x+70,selectionBox.y+selectionBox.height+20,{steps:3});await page.waitForTimeout(300);
  const held=await message.evaluate(element=>element.editContext?{anchor:element.editContext.selectionStart,focus:element.editContext.selectionEnd}:element.selectionDirection==='backward'?{anchor:element.selectionEnd,focus:element.selectionStart}:{anchor:element.selectionStart,focus:element.selectionEnd});
  assert.equal(held.anchor,0);assert(held.focus>longMessage.indexOf('Line 5'),'Holding the real canvas pointer extends into lines beyond the four-line viewport');
  await page.mouse.up();await message.press('Control+End');await page.waitForTimeout(100);assert.equal(await value(message),longMessage);

  await message.focus();await session.send('Input.imeSetComposition',{text:'한',selectionStart:1,selectionEnd:1});await page.waitForTimeout(100);
  await activate('Use one line');assert.equal((await message.boundingBox()).height,96,'A configuration change waits for actual composition completion');
  await commit('한');assert.equal(await value(message),longMessage+'한');assert.equal((await message.boundingBox()).height,24);
  await message.press('Enter');assert.equal(await value(message),longMessage+'한');
  await click('Clear messages');await click('Actions');await click('Text inputs');assert.equal(await value(page.getByRole('textbox',{name:'Your message',exact:true})),'');
  await click('Cupertino');await click('Text inputs');var cupertino=page.getByRole('textbox',{name:'메시지를 입력하세요',exact:true});await cupertino.waitFor({state:'visible'});
  assert.equal(await cupertino.evaluate(element=>element.tagName),dom?'TEXTAREA':'DIV');await cupertino.evaluate(element=>(element.editContext??element).addEventListener('compositionend',event=>{element.dataset.trustedEnd=String(event.isTrusted);}));await compose(cupertino,'한'.repeat(21));await cupertino.evaluate(element=>{element.dataset.w13FormRow='stable';});
  await activate('Dark mode');await page.setViewportSize({width:390,height:498});await page.waitForTimeout(150);assert.equal(await value(cupertino),'한'.repeat(21));assert.equal(await cupertino.getAttribute('data-w13-form-row'),'stable');assert(await cupertino.evaluate(element=>document.activeElement===element));
  keyboardBox=await cupertino.boundingBox();assert(keyboardBox.y>=0&&keyboardBox.y+keyboardBox.height<=499);
  await page.setViewportSize({width:1440,height:1200});await commit('한'.repeat(21));assert.equal(await value(cupertino),'한'.repeat(20));
  // Clear must also wait for the browser's real composition-end acknowledgement.
  await compose(cupertino,'조합');await activate('Clear Cupertino message');await page.waitForTimeout(250);assert.equal(await value(cupertino),'');if(dom){assert.notEqual(await cupertino.getAttribute('data-trusted-end'),null,'The DOM carrier observes a browser compositionend before replacement');assert.deepEqual(await page.evaluate(()=>window.nelyxCompositionScriptDispatch),[],'Neither app nor test can synthesize the observed composition events');}else assert.equal(await cupertino.getAttribute('data-trusted-end'),'true');await click('Undo Cupertino message');assert.equal(await value(cupertino),'한'.repeat(20));await visualBidi(cupertino);
  const previousCupertino=await value(cupertino);await type(cupertino,'1\n2\n3\n4\n5\n6');await scrollDemo(cupertino);await type(cupertino,previousCupertino);
  await click('Save Cupertino form');await page.waitForTimeout(100);assert(await page.locator('[aria-label*="이름을 입력하세요."]').count()>0);
  var cupertinoName=page.getByRole('textbox',{name:'Cupertino name',exact:true}),cupertinoEmail=page.getByRole('textbox',{name:'Cupertino email',exact:true});
  await type(cupertinoName,'Ada');await cupertinoName.press('Enter');await page.waitForTimeout(100);assert(await cupertinoEmail.evaluate(element=>document.activeElement===element));await type(cupertinoEmail,'ada@example.com');await cupertinoEmail.press('Enter');await page.waitForTimeout(100);assert(await page.locator('[aria-label*="Cupertino saved: Ada · ada@example.com"]').count()>0);
  await click('Reset Cupertino form');await page.waitForTimeout(100);assert.equal(await value(cupertinoName),'');assert.equal(await value(cupertinoEmail),'');
  await click('Material 3');await click('Cupertino');await page.waitForTimeout(100);assert.equal(await value(page.getByRole('textbox',{name:'메시지를 입력하세요',exact:true})),'한'.repeat(20));
  await click('Containment');await click('Open dialog');
  assert.equal(await page.getByRole('button',{name:'Material 3',exact:true}).count(),0,'A Core modal removes underlay actions from the live browser semantics tree');
  await page.keyboard.press('Escape');await page.waitForTimeout(250);
  await click('Open dialog');await click('Close');await page.waitForTimeout(250);
  assert(await page.locator('[aria-label*="Cupertino dialog closed"]').count()>0);
  await click('Material 3');await click('Containment');await click('Open basic dialog');
  assert.equal(await page.getByRole('button',{name:'Cupertino',exact:true}).count(),0);
  await page.keyboard.press('Escape');await page.waitForTimeout(250);
  assert.equal(await page.getByRole('button',{name:'Cupertino',exact:true}).count(),1);
  assert.equal(errors.length,0);
}catch(error){const diagnostic=page?await page.evaluate(()=>({focus:window.nelyxInputFocus,alerts:[...document.querySelectorAll('[role=alert]')].map(node=>node.textContent),fields:[...document.querySelectorAll('input,textarea,[role=textbox]')].map(node=>({tag:node.tagName,label:node.getAttribute('aria-label'),display:getComputedStyle(node).display,rect:node.getBoundingClientRect().toJSON()}))})).catch(()=>null):null;throw new AggregateError([error,new Error(JSON.stringify({errors,consoleErrors,diagnostic}))],'Web input and browser errors');}finally{
  var cleanupErrors=[];
  for(const cleanup of [()=>context?.close(),()=>browser?.close(),()=>server?new Promise(resolve=>server.close(resolve)):undefined,()=>{
    assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));assert(path.basename(temp).startsWith('nelyx-w13-browser-'));
    fs.rmSync(temp,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }])try{await cleanup();}catch(error){cleanupErrors.push(error);}
  if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Web input test retirement failed');
}
});

