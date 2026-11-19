// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { execute } from '../../../Nelyx/sdk/tooling/cli/src/commands.mjs';

if (!process.argv.includes('--child')) {
  await execute(process.execPath, [import.meta.filename, '--child'], { timeout: 1_200_000 });
  process.exit(0);
}

const build = path.resolve(import.meta.dirname, '../.nelyx/web');
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript'],
  ['.json', 'application/json'],
  ['.wasm', 'application/wasm'],
  ['.png', 'image/png'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
]);
assert(
  fs.existsSync(path.join(build, 'index.html')),
  'Build the Testbed Web Release before running the demo checks',
);
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(build, '.' + pathname);
  if (
    !file.startsWith(build + path.sep) ||
    !fs.statSync(file, { throwIfNoEntry: false })?.isFile()
  ) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('Content-Type', types.get(path.extname(file)) ?? 'application/octet-stream');
  fs.createReadStream(file)
    .on('error', () => response.destroy())
    .pipe(response);
});

let browser;
let page;
const failures = [];
try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(12_000);
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const button = (name) => page.getByRole('button', { name, exact: true });
  const selected = async (control, name) => {
    await control.locator('[aria-selected=true]').and(button(name)).waitFor();
  };
  const center = async (locator) => {
    await locator.waitFor();
    const stable = await locator.evaluate(async (element) => {
      let previous;
      let stableFrames = 0;
      for (let frame = 0; frame < 30; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const { x, y, width, height } = element.getBoundingClientRect();
        if (!element.isConnected || width <= 0 || height <= 0) return false;
        const current = [x, y, width, height];
        stableFrames =
          previous && current.every((value, i) => Math.abs(value - previous[i]) < 0.2)
            ? stableFrames + 1
            : 0;
        if (stableFrames === 3) return true;
        previous = current;
      }
      return false;
    });
    assert.equal(stable, true, `Control bounds changed while preparing pointer input: ${locator}`);
    const bounds = await locator.boundingBox();
    assert(bounds && bounds.width > 0 && bounds.height > 0);
    return [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
  };
  const clickPointer = async (locator) => {
    await page.mouse.move(...(await center(locator)));
    await page.mouse.down();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await page.mouse.up();
  };
  const wheelIntoView = async (locator, step = 240) => {
    await page.mouse.move(1244, 700);
    for (let i = 0; i < 8 && !(await locator.isVisible()); i++) {
      await page.mouse.wheel(0, step);
      await locator.waitFor({ timeout: 750 }).catch(() => {});
    }
    await locator.waitFor();
  };

  const material = page.getByRole('group', { name: 'Segmented buttons 기본 API' });
  await selected(material, 'List');
  await clickPointer(button('Grid'));
  await selected(material, 'Grid');
  await clickPointer(button('Map'));
  assert.equal(await material.locator('[aria-selected=true]').getAttribute('aria-label'), 'Grid');
  await button('List').focus();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.keyboard.press('Enter');
  await selected(material, 'List');

  await clickPointer(button('Cupertino'));
  const cupertino = page.getByRole('list', { name: /Sliding segmented control/ });
  await selected(cupertino, 'Daily');
  await clickPointer(button('Weekly'));
  await selected(cupertino, 'Weekly');
  await clickPointer(button('Yearly'));
  await selected(cupertino, 'Weekly');
  assert.notEqual(await button('Yearly').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowLeft');
  await selected(cupertino, 'Daily');
  await page.mouse.move(...(await center(button('Daily'))));
  await page.mouse.down();
  const [weeklyX, weeklyY] = await center(button('Weekly'));
  await page.mouse.move(weeklyX, weeklyY, { steps: 8 });
  await page.mouse.up();
  await selected(cupertino, 'Weekly');

  const borderedDay = button('Day');
  const borderedWeek = button('Week');
  await borderedDay.and(page.locator('[aria-selected=true]')).waitFor();
  await clickPointer(borderedWeek);
  await borderedWeek.and(page.locator('[aria-selected=true]')).waitFor();
  assert.equal(await button('Month').isDisabled(), true);

  await button('Selection').evaluate((element) => element.click());
  await page.locator('[aria-label="7개 섹션 · 스크롤하여 탐색"]').waitFor();
  await page.mouse.move(1244, 700);
  await page.mouse.wheel(0, 600);
  const wheel = (value) =>
    page.getByRole('slider').and(page.locator(`[aria-valuetext="${value}"]`));
  const fruit = wheel('Apple');
  await fruit.focus();
  assert.equal(await fruit.evaluate((element) => document.activeElement === element), true);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.keyboard.press('ArrowDown');
  await wheel('Peach').waitFor();
  await page.locator('[aria-label="Fruit: Peach"]').waitFor();
  await page.keyboard.press('ArrowUp');
  await wheel('Apple').waitFor();

  const portion = wheel('Small');
  await portion.focus();
  await page.keyboard.press('ArrowDown');
  await portion.waitFor();
  const [portionX, portionY] = await center(portion);
  await page.mouse.click(portionX, portionY + 30);
  await wheel('Medium').waitFor();
  await page.locator('[aria-label="Portion: Medium"]').waitFor();
  await page.mouse.move(portionX, portionY);
  await page.mouse.wheel(0, 40);
  await wheel('Large').waitFor();
  await page.locator('[aria-label="Portion: Large"]').waitFor();

  await page.mouse.move(1244, 700);
  await page.mouse.wheel(0, 400);
  await wheel('01 시간').waitFor();
  await wheel('5 분').waitFor();
  const timerSeconds = wheel('15 초');
  await timerSeconds.focus();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.keyboard.press('ArrowUp');
  await wheel('30 초').waitFor();
  await page.locator('[aria-label="Timer: 3930 seconds"]').waitFor();

  const dateMinute = wheel('30분');
  await wheelIntoView(dateMinute);
  await dateMinute.focus();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.keyboard.press('ArrowUp');
  await wheel('35분').waitFor();
  await page.locator('[aria-label="Date: 2024-02-29 09:35"]').waitFor();

  await button('Text inputs').evaluate((element) => element.click());
  await page.locator('[aria-label="2개 섹션 · 스크롤하여 탐색"]').waitFor();
  await page.mouse.move(1244, 700);
  await page.mouse.wheel(0, 600);
  const search = page.getByRole('textbox', { name: '검색', exact: true });
  await search.waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Disabled search' }).isDisabled(), true);
  await clickPointer(search);
  await page.keyboard.type('wheel');
  await page.locator('[aria-label="Search changed: wheel"]').waitFor();
  await page.keyboard.press('Enter');
  await page.locator('[aria-label="Search submitted: wheel"]').waitFor();
  await clickPointer(button('삭제'));
  await page.locator('[aria-label="Search changed: (empty)"]').waitFor();
  await button('삭제').waitFor({ state: 'detached' });

  await button('Containment').evaluate((element) => element.click());
  const openSheet = button('Open action sheet');
  await wheelIntoView(openSheet);
  const showCupertinoSheet = () => openSheet.evaluate((element) => element.click());
  await showCupertinoSheet();
  const sheet = page.getByRole('dialog', { name: 'Alert', exact: true });
  const cancel = sheet.getByRole('button', { name: 'Cancel', exact: true });
  const waitForBottomPosition = () =>
    page.waitForFunction(() => {
      const dialog = document.querySelector('[role=dialog][aria-label="Alert"]');
      const save = dialog?.querySelector('button[aria-label="Save item"]')?.getBoundingClientRect();
      const cancel = dialog?.querySelector('button[aria-label="Cancel"]')?.getBoundingClientRect();
      return Boolean(
        save &&
        cancel &&
        cancel.top > save.top &&
        cancel.top > innerHeight / 2 &&
        cancel.bottom <= innerHeight,
      );
    });
  await waitForBottomPosition();
  await clickPointer(sheet.getByRole('button', { name: 'Delete item', exact: true }));
  await page.locator('[aria-label="Action sheet: Deleted"]').waitFor();
  await sheet.waitFor({ state: 'detached' });
  await showCupertinoSheet();
  await waitForBottomPosition();
  await clickPointer(cancel);
  await page.locator('[aria-label="Action sheet: Cancelled"]').waitFor();
  await sheet.waitFor({ state: 'detached' });
  await showCupertinoSheet();
  await sheet.waitFor();
  await page.mouse.click(30, 100);
  await page.locator('[aria-label="Action sheet: Dismissed"]').waitFor();
  await sheet.waitFor({ state: 'detached' });

  const openCupertinoSheet = button('Open Cupertino sheet');
  await wheelIntoView(openCupertinoSheet, 180);
  await openCupertinoSheet.evaluate((element) => element.click());
  const collectionDetails = button('Open collection details');
  await collectionDetails.waitFor();
  await page.waitForFunction(() => {
    const title = document.querySelector('[aria-label="Edit collection"]');
    return title && title.getBoundingClientRect().top < 170;
  });
  await clickPointer(collectionDetails);
  await page.getByRole('note', { name: 'Collection details', exact: true }).waitFor();
  await button('Save and close sheet').evaluate((element) => element.click());
  await page.locator('[aria-label="Cupertino sheet: Saved"]').waitFor();
  await collectionDetails.waitFor({ state: 'detached' });

  await wheelIntoView(openCupertinoSheet, 180);
  await openCupertinoSheet.evaluate((element) => element.click());
  await collectionDetails.waitFor();
  // CupertinoSheetRoute admits interactive dismissal after its 500 ms entrance.
  await page.waitForTimeout(500);
  const dragSheet = await page.context().newCDPSession(page);
  try {
    const point = (y) => [{ x: 600, y }];
    await dragSheet.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: point(264),
    });
    for (let step = 1; step <= 15; step++) {
      await dragSheet.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(264 + 36 * step),
      });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
    await dragSheet.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await dragSheet
      .send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      .catch(() => {});
    await dragSheet.detach();
  }
  await page.locator('[aria-label="Cupertino sheet: Dismissed"]').waitFor();
  await collectionDetails.waitFor({ state: 'detached' });

  const refreshButton = button('Open refresh list');
  await wheelIntoView(refreshButton);
  await refreshButton.evaluate((element) => element.click());
  const refreshItems = page.getByRole('group', { name: 'Refresh items', exact: true });
  await refreshItems.waitFor();
  await page.waitForFunction(() => {
    const bounds = document.querySelector('[aria-label="Refresh items"]')?.getBoundingClientRect();
    return bounds && bounds.width > 1000 && window.innerHeight - bounds.top >= 420;
  });
  const refreshBox = await refreshItems.getByRole('list').boundingBox();
  assert.ok(refreshBox);
  const refreshX = refreshBox.x + refreshBox.width / 2;
  const refreshY = refreshBox.y + 12;
  const touch = await page.context().newCDPSession(page);
  try {
    const point = (y) => [{ x: refreshX, y }];
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: point(refreshY),
    });
    for (let i = 1; i <= 14; i++) {
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(refreshY + 28 * i),
      });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await touch.detach();
  }
  await page.locator('[aria-label="Cupertino refresh completed: 1"]').waitFor();
  await refreshItems.getByRole('list', { name: /Item 25/ }).waitFor();
  await button('Back').evaluate((element) => element.click());
  await refreshItems.waitFor({ state: 'detached' });

  await button('Navigation').evaluate((element) => element.click());
  const namedRoute = button('Open named route');
  await wheelIntoView(namedRoute);
  await clickPointer(namedRoute);
  await page.locator('[aria-label="Details"]').waitFor();
  await clickPointer(button('Increment'));
  await clickPointer(button('Return result'));
  await page.getByRole('note', { name: /Cupertino route result: 1$/ }).waitFor();
  await clickPointer(namedRoute);
  await button('뒤로').evaluate((element) => element.click());
  await page.getByRole('note', { name: /Cupertino route result: cancelled$/ }).waitFor();

  const openCupertinoTabs = button('Open Cupertino tabs');
  await wheelIntoView(openCupertinoTabs, 150);
  await clickPointer(openCupertinoTabs);
  const folders = page.getByRole('tab', { name: 'Folders', exact: true });
  const history = page.getByRole('tab', { name: 'History', exact: true });
  await folders.and(page.locator('[aria-selected="true"]')).waitFor();
  assert.equal(await history.getAttribute('aria-description'), '탭 2개 중 2번째');
  await clickPointer(button('Open folder details'));
  const folderDetails = page.getByRole('note', { name: 'Folder details', exact: true });
  await folderDetails.waitFor();
  await clickPointer(history);
  await history.and(page.locator('[aria-selected="true"]')).waitFor();
  await folderDetails.waitFor({ state: 'detached' });
  await clickPointer(button('Open history entry'));
  const historyDetails = page.getByRole('note', { name: 'History entry', exact: true });
  await historyDetails.waitFor();
  await page.keyboard.press('Escape');
  await button('Open history entry').waitFor();
  await clickPointer(folders);
  await folderDetails.waitFor();
  await clickPointer(button('뒤로').or(page.locator('button[aria-description="뒤로"]')).first());
  await clickPointer(button('Close tabs'));
  await openCupertinoTabs.waitFor();

  await clickPointer(button('Material 3'));
  await button('Cupertino').waitFor();
  await clickPointer(button('Selection'));
  const dateButton = page.getByRole('button', { name: /^Choose date/ });
  const original = await dateButton.getAttribute('aria-label');
  await clickPointer(dateButton);
  await clickPointer(button('취소'));
  await dateButton.waitFor();
  assert.equal(await dateButton.getAttribute('aria-label'), original);

  await clickPointer(button('Containment'));
  const openBottomSheet = button('Open bottom sheet');
  await clickPointer(openBottomSheet);
  const saveSheet = button('Save from sheet');
  assert.ok((await center(saveSheet))[1] > page.viewportSize().height / 2);
  await clickPointer(saveSheet);
  await page.getByRole('note', { name: /Bottom sheet saved$/ }).waitFor();
  await saveSheet.waitFor({ state: 'detached' });
  await clickPointer(openBottomSheet);
  await saveSheet.waitFor();
  await page.mouse.click(30, 100);
  await page.getByRole('note', { name: /Bottom sheet dismissed$/ }).waitFor();
  await saveSheet.waitFor({ state: 'detached' });

  const controlledBody = page.locator('[aria-label*="Controlled panel body"]').first();
  await clickPointer(button('Controlled details'));
  await controlledBody.waitFor();
  await clickPointer(button('Controlled details'));
  await controlledBody.waitFor({ state: 'detached' });
  const firstRadio = page.locator('[aria-label*="Radio first body"]').first();
  const secondRadio = page.locator('[aria-label*="Radio second body"]').first();
  await firstRadio.waitFor();
  await clickPointer(button('Radio second'));
  await secondRadio.waitFor();
  await firstRadio.waitFor({ state: 'detached' });
  await page.getByRole('note', { name: /Panel 0: closed → Panel 1: open$/ }).waitFor();

  const dataTable = page
    .getByRole('group', { name: 'Data table 기본 API', exact: true })
    .getByRole('table');
  const quantity = dataTable.getByRole('columnheader').getByRole('button', { name: 'Qty' });
  await wheelIntoView(quantity);
  const selectAll = dataTable.getByRole('checkbox', { name: '전체 선택', exact: true });
  await selectAll.waitFor();
  assert.equal(await selectAll.getAttribute('aria-checked'), 'mixed');
  await clickPointer(quantity);
  await page.getByRole('note', { name: /Data table: Qty ascending$/ }).waitFor();
  await page.mouse.move(1244, 700);
  await page.mouse.wheel(0, 260);
  const pearRow = dataTable.getByRole('row', { name: 'Pear 3' });
  await clickPointer(pearRow.getByRole('cell').getByRole('button', { name: 'Pear', exact: true }));
  await page.getByRole('note', { name: /Data table: Pear selected$/ }).waitFor();
  await pearRow.and(page.locator('[aria-selected="true"]')).waitFor();

  const nextPage = button('Next page').or(page.locator('button[aria-description="Next page"]'));
  await wheelIntoView(nextPage);
  await clickPointer(nextPage);
  await page.getByRole('note', { name: /Paginated table: first row index 3$/ }).waitFor();
  await clickPointer(button('Rows per page: 3'));
  const fiveRows = button('5 rows per page');
  await wheelIntoView(fiveRows, 140);
  await clickPointer(fiveRows);
  await page.getByRole('note', { name: /Paginated table: 5 rows per page$/ }).waitFor();

  const continueStep = button('Continue step');
  await wheelIntoView(continueStep);
  await clickPointer(continueStep);
  await page.getByRole('note', { name: /Stepper: Review step$/ }).waitFor();
  const unavailableStep = page.getByRole('button', { name: /Unavailable step$/ });
  assert.equal(await unavailableStep.isDisabled(), true);
  const reviewStep = page.getByRole('button', { name: /Review step$/ });
  await wheelIntoView(reviewStep.and(page.locator('[aria-selected="true"]')), 180);

  await clickPointer(button('Actions'));
  const extendedFab = button('New item');
  await clickPointer(extendedFab);
  await page.getByRole('note', { name: /Extended FAB pressed$/ }).waitFor();
  const fabs = page.getByRole('group', { name: /Floating action buttons/ });
  assert.equal(await fabs.getByRole('button', { disabled: true }).count(), 1);
  const playAnimation = button('Play animation');
  await wheelIntoView(playAnimation);
  const playSymbol = page.getByRole('note', { name: 'Play symbol', exact: true });
  const playBounds = await playSymbol.boundingBox();
  assert.ok(playBounds && playBounds.width === 32 && playBounds.height === 32);
  const playFrame = await page.screenshot({ clip: playBounds });
  await clickPointer(playAnimation);
  const pauseSymbol = page.getByRole('note', { name: 'Pause symbol', exact: true });
  await pauseSymbol.waitFor();
  const pauseFrame = await page.screenshot({ clip: playBounds });
  assert.notDeepEqual(playFrame, pauseFrame, 'Animated icon path remained on its initial frame');
  await clickPointer(button('Pause animation'));
  await playSymbol.waitFor();
  assert.deepEqual(await page.screenshot({ clip: playBounds }), playFrame);

  await button('Navigation').evaluate((element) => element.click());
  await page.getByRole('note', { name: /7개 섹션 · 스크롤하여 탐색/ }).waitFor();
  const navigation = page.getByRole('tablist');
  const home = navigation.getByRole('tab', { name: 'Home', exact: true });
  const searchDestination = navigation.getByRole('tab', { name: 'Search', exact: true });
  await home.waitFor();
  assert.equal(await home.getAttribute('aria-selected'), 'true');
  await clickPointer(searchDestination);
  await navigation.locator('[aria-selected=true]').and(searchDestination).waitFor();
  await page.getByRole('note', { name: /Navigation destination: 1$/ }).waitFor();
  assert.equal(await navigation.getByRole('tab', { name: 'Unavailable' }).isDisabled(), true);

  const extendRail = button('Extend navigation rail');
  await wheelIntoView(extendRail);
  const recent = page.getByRole('tab', { name: 'Recent', exact: true });
  await wheelIntoView(recent, 160);
  const narrowRailWidth = (await recent.boundingBox()).width;
  await clickPointer(extendRail);
  await page.waitForFunction((width) => {
    const destination = document.querySelector('[role=tab][aria-label="Recent"]');
    return destination && destination.getBoundingClientRect().width > width + 50;
  }, narrowRailWidth);
  const favorites = page.getByRole('tab', { name: 'Favorites', exact: true });
  await clickPointer(favorites);
  await favorites.and(page.locator('[aria-selected="true"]')).waitFor();
  await page.getByRole('note', { name: /Rail destination: 1$/ }).waitFor();
  const unavailableDestination = page.getByRole('tab', { name: 'Archive unavailable' });
  await wheelIntoView(unavailableDestination, 160);
  assert.equal(await unavailableDestination.isDisabled(), true);

  const openDrawerDemo = button('Open drawer example');
  await wheelIntoView(openDrawerDemo, -160);
  await clickPointer(openDrawerDemo);
  const drawerButtons = page.locator('button[aria-description="탐색 메뉴 열기"]');
  const leftDrawer = drawerButtons.first();
  const rightDrawer = drawerButtons.last();
  await rightDrawer.waitFor();
  assert.equal(await drawerButtons.count(), 2);
  assert.ok((await leftDrawer.boundingBox()).x < (await rightDrawer.boundingBox()).x);
  await clickPointer(leftDrawer);
  const drawerHome = page.getByRole('button', { name: /Drawer home/ });
  const drawerRecent = page.getByRole('button', { name: /Recent collections/ });
  await drawerHome.and(page.locator('[aria-selected="true"]')).waitFor();
  assert.equal(await page.getByRole('button', { name: /Archived collections/ }).isDisabled(), true);
  assert.equal(await button('Back to gallery').count(), 0);
  await clickPointer(drawerRecent);
  await drawerRecent.and(page.locator('[aria-selected="true"]')).waitFor();
  await clickPointer(button('Close navigation drawer'));
  await drawerRecent.waitFor({ state: 'detached' });
  await page.getByRole('note', { name: 'Recent collections selected', exact: true }).waitFor();
  await clickPointer(rightDrawer);
  const endDrawerContent = page.getByRole('note', { name: 'Filter this collection', exact: true });
  await endDrawerContent.waitFor();
  await page.keyboard.press('Escape');
  await endDrawerContent.waitFor({ state: 'detached' });
  await clickPointer(button('Back to gallery'));
  await openDrawerDemo.waitFor();

  const openTabs = button('Open tabs example');
  await wheelIntoView(openTabs, 160);
  await clickPointer(openTabs);
  const tab = (name) => page.getByRole('tab', { name, exact: true });
  const activeTab = (name) => tab(name).and(page.locator('[aria-selected="true"]'));
  const panel = (name) => page.getByRole('tabpanel', { name, exact: true });
  await activeTab('Overview').waitFor();
  await panel('Overview panel').waitFor();
  await page.waitForFunction(() => {
    const overview = document.querySelector('[role="tabpanel"][aria-label="Overview panel"]');
    return overview && Math.abs(overview.getBoundingClientRect().left) < 1;
  });
  assert.equal(await page.evaluate(() => document.elementFromPoint(1080, 480)?.tagName), 'CANVAS');
  const swipe = await page.context().newCDPSession(page);
  try {
    const point = (x) => [{ x, y: 480 }];
    await swipe.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(1080) });
    for (let step = 1; step <= 14; step++) {
      await swipe.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: point(1080 - 52 * step),
      });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    }
    const position = await panel('Activity panel').boundingBox();
    assert.ok(
      position && position.x < 850,
      `Tab page did not follow the touch drag (${JSON.stringify(position)})`,
    );
    await swipe.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await swipe
      .send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      .catch(() => {});
    await swipe.detach();
  }
  await activeTab('Activity').waitFor();
  await panel('Activity panel').waitFor();
  await clickPointer(tab('Overview'));
  await activeTab('Overview').waitFor();
  await panel('Overview panel').waitFor();
  await clickPointer(tab('Preferences'));
  await activeTab('Preferences').waitFor();
  await activeTab('General').waitFor();
  await panel('General panel').waitFor();
  await panel('Overview panel').waitFor({ state: 'detached' });
  await page.waitForFunction(() => {
    const general = document.querySelector('[role="tabpanel"][aria-label="General panel"]');
    return general && Math.abs(general.getBoundingClientRect().left) < 1;
  });
  assert.equal(await tab('Notifications').count(), 1);
  await clickPointer(tab('Notifications'));
  await activeTab('Notifications').waitFor();
  await panel('Notifications panel').waitFor();
  assert.equal(await tab('Notifications').count(), 1);
  await clickPointer(button('뒤로').or(page.locator('button[aria-description="뒤로"]')).first());

  const searchBar = page.getByRole('textbox', { name: 'Search collections', exact: true });
  await wheelIntoView(searchBar, 160);
  await clickPointer(searchBar);
  const searchView = page.getByRole('dialog', { name: 'Find a collection', exact: true });
  const searchField = searchView.getByRole('textbox', { name: 'Find a collection', exact: true });
  await clickPointer(searchField);
  await page.keyboard.type('a');
  await page.keyboard.press('Control+a');
  await page.keyboard.type('or');
  const orchids = searchView.getByRole('button', { name: 'Orchids', exact: true });
  await orchids.waitFor();
  await page.waitForTimeout(430);
  assert.equal(
    await searchView.getByRole('button', { name: 'Apple trees', exact: true }).count(),
    0,
  );
  await clickPointer(orchids);
  await searchView.waitFor({ state: 'detached' });
  await page.getByRole('note', { name: /Search: Orchids$/ }).waitFor();
  assert.equal(await searchBar.inputValue(), 'Orchids');

  const openAppBar = button('Open app bar example');
  await wheelIntoView(openAppBar);
  await clickPointer(openAppBar);
  await page.locator('[aria-label="App bar example"]').waitFor();
  await page.getByRole('note', { name: 'Toolbar details', exact: true }).waitFor();
  await clickPointer(button('Refresh toolbar'));
  const back = button('뒤로').or(page.locator('button[aria-description="뒤로"]'));
  await clickPointer(back.first());
  await page.getByRole('note', { name: /App bar action pressed$/ }).waitFor();

  await button('Selection').evaluate((element) => element.click());
  const chooseTime = page.getByRole('button', { name: /^Choose time/ });
  await wheelIntoView(chooseTime);
  await clickPointer(chooseTime);
  const timeDial = page.getByRole('dialog', { name: '시간 선택', exact: true });
  await clickPointer(timeDial.getByRole('button', { name: '10', exact: true }));
  await clickPointer(timeDial.getByRole('button', { name: '20', exact: true }));
  await clickPointer(timeDial.getByRole('button', { name: '확인', exact: true }));
  await page.getByRole('note', { name: /Time: 10:20$/ }).waitFor();

  await clickPointer(chooseTime);
  const switchToInput = timeDial
    .getByRole('button', { name: '텍스트 입력 모드로 전환' })
    .or(timeDial.locator('button[aria-description="텍스트 입력 모드로 전환"]'));
  await clickPointer(switchToInput.first());
  const timeInput = page.getByRole('dialog', { name: '시간 입력', exact: true });
  const setTimeField = async (name, value) => {
    await clickPointer(timeInput.getByRole('textbox', { name, exact: true }));
    await page.keyboard.press('Control+a');
    await page.keyboard.type(value);
  };
  await setTimeField('시간', '99');
  await clickPointer(timeInput.getByRole('button', { name: '확인', exact: true }));
  await timeInput
    .getByRole('note', { name: 'Enter a valid hour and minute', exact: true })
    .waitFor();
  await setTimeField('시간', '11');
  await setTimeField('분', '45');
  await clickPointer(timeInput.getByRole('button', { name: '오후', exact: true }));
  await clickPointer(timeInput.getByRole('button', { name: '확인', exact: true }));
  await page.getByRole('note', { name: /Time: 23:45$/ }).waitFor();

  const documentActions = button('Document actions');
  await wheelIntoView(documentActions, 160);
  const menuItem = (name) =>
    page.getByRole('menuitem', { name, exact: true }).or(button(name)).first();
  await clickPointer(documentActions);
  const menu = page.getByRole('menu');
  await menu.first().waitFor();
  assert.equal(await menuItem('Share unavailable').isDisabled(), true);
  await page.mouse.move(...(await center(menuItem('Export formats'))));
  await clickPointer(menuItem('Export PDF'));
  await page.getByRole('note', { name: /Menu: PDF$/ }).waitFor();
  await menu.first().waitFor({ state: 'detached' });
  await clickPointer(documentActions);
  await menuItem('Rename document').waitFor();
  await page.keyboard.press('Escape');
  await menu.first().waitFor({ state: 'detached' });

  await button('Communication').evaluate((element) => element.click());
  const openSnackbar = button('Open snackbar example');
  await wheelIntoView(openSnackbar);
  await clickPointer(openSnackbar);
  await button('Archive item').evaluate((element) => element.click());
  const undo = button('Undo archive');
  await undo.waitFor();
  const queued = page.getByRole('group', { name: 'Queue complete', exact: true });
  assert.equal(await queued.isVisible(), false);
  await undo.evaluate((element) => element.click());
  await queued.waitFor();
  const closeSnackbar = button('닫기').or(page.locator('button[aria-description="닫기"]'));
  await closeSnackbar.first().evaluate((element) => element.click());
  await queued.waitFor({ state: 'detached' });
  await button('뒤로')
    .or(page.locator('button[aria-description="뒤로"]'))
    .first()
    .evaluate((element) => element.click());
  await page.getByRole('note', { name: /Queue snackbar: dismiss$/ }).waitFor();

  assert.deepEqual(
    failures.filter((message) => !message.includes('favicon.ico')),
    [],
  );
  console.log(
    'W11 Testbed Web passed: controls, sheets, data tables, app bars, tabs, navigation, pickers and snack bar queue',
  );
} catch (error) {
  if (failures.length) console.error(failures.join('\n'));
  if (page && !page.isClosed()) {
    console.error(
      await page.getByRole('slider').evaluateAll((elements) =>
        elements.map((element) => ({
          value: element.getAttribute('aria-valuetext'),
          focused: document.activeElement === element,
          bounds: element.getBoundingClientRect().toJSON(),
        })),
      ),
    );
    console.error(
      await page
        .locator('body')
        .ariaSnapshot({ timeout: 1000 })
        .catch(() => '(snapshot unavailable)'),
    );
  }
  throw error;
} finally {
  await browser?.close();
  server.closeAllConnections();
  server.close();
}
