const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let server;
let browser;
let baseURL;

before(async () => {
  server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

async function openApp(options = {}) {
  const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block', ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(baseURL);
  await page.waitForFunction(() => document.querySelector('#strengthExercise').options.length > 1);
  return { context, page };
}

async function getAll(page, store) {
  return page.evaluate(async (name) => (await import('./src/db.js')).getAll(name), store);
}

async function setDate(page, date) {
  const dayPicker = page.locator('#selectedDate');
  await (await dayPicker.isVisible() ? dayPicker : page.locator('.panel.is-active .sectionDate')).fill(date);
  await page.waitForFunction((value) => document.querySelector('#selectedDate').value === value, date);
}

function strengthRecord(id, exerciseId, reps, extra = {}) {
  return {
    id,
    date: '2026-01-14',
    exerciseId,
    loadMode: 'band',
    bandId: 'purple',
    targetReps: 5,
    sets: reps.map((count, index) => ({ index: index + 1, reps: count })),
    ...extra
  };
}

async function showForecast(page, exerciseId, previous, lastExerciseId = 'handstand-pushups', extraRecords = []) {
  await setDate(page, '2026-01-16');
  if (previous?.loadMode === 'technical_step') {
    await page.waitForFunction(() => document.querySelector('#strengthTechniqueLevel') !== null);
    await page.evaluate((level) => { document.querySelector('#strengthTechniqueLevel').value = String(level); }, previous.technicalStepLevel);
  }
  await page.evaluate(async ({ previousRecord, lastId, records }) => {
    const db = await import('./src/db.js');
    if (previousRecord) await db.put('strengthWorkouts', previousRecord);
    if (lastId) await db.put('strengthWorkouts', {
      id: 'rotation-last', date: '2026-01-15', exerciseId: lastId,
      loadMode: 'band', bandId: 'none', sets: [{ index: 1, reps: 5 }]
    });
    for (const record of records) await db.put('strengthWorkouts', record);
  }, { previousRecord: previous, lastId: lastExerciseId, records: extraRecords });
  await page.locator('[data-tab="strength"]').click();
  await page.waitForFunction((id) => document.querySelector('[data-enhanced-suggested-strength]')?.dataset.enhancedSuggestedStrength === id, exerciseId);
  return page.locator('#strengthSuggestion');
}

test('records: strength and cycling CRUD persists across reloads', async () => {
  const { context, page } = await openApp();
  try {
    await setDate(page, '2026-01-15');
    await page.locator('[data-tab="strength"]').click();
    await page.locator('#strengthExercise').selectOption('squats');
    await page.locator('#strengthAddedWeight').fill('10');
    await page.locator('[data-set-reps="0"]').selectOption('8');
    await page.locator('#strengthNote').fill('First set');
    await page.locator('#strengthSave').click();
    let rows = await getAll(page, 'strengthWorkouts');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sets[0].reps, 8);
    assert.equal(rows[0].addedWeightKg, 10);

    await page.reload();
    await page.waitForFunction(() => document.querySelector('#strengthExercise').options.length > 1);
    await setDate(page, '2026-01-15');
    await page.locator('[data-tab="strength"]').click();
    await page.locator('[data-edit-strength]').click();
    await page.locator('#strengthNote').fill('Updated set');
    await page.locator('#strengthSave').click();
    rows = await getAll(page, 'strengthWorkouts');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].notes, 'Updated set');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-delete-strength]').click();
    assert.equal((await getAll(page, 'strengthWorkouts')).length, 0);

    await page.locator('[data-tab="cycling"]').click();
    await page.locator('#cyclingDuration').selectOption('10');
    await page.locator('#cyclingDistance').fill('5');
    await page.locator('#cyclingLoad').selectOption('4');
    await page.locator('#cyclingNote').fill('First ride');
    await page.waitForTimeout(1100); // Date-change defaults must not replace the user's duration.
    assert.equal(await page.locator('#cyclingDuration').inputValue(), '10');
    await page.locator('#cyclingSave').click();
    await page.waitForFunction(async () => (await import('./src/db.js')).getAll('cyclingWorkouts').then((records) => records.length === 1));
    rows = await getAll(page, 'cyclingWorkouts');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].durationMinutes, 10);
    assert.equal(rows[0].averageSpeedKmh, 30);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#strengthExercise').options.length > 1);
    await setDate(page, '2026-01-15');
    await page.locator('[data-tab="cycling"]').click();
    await page.locator('[data-edit-cycling]').click();
    await page.locator('#cyclingNote').fill('Updated ride');
    await page.locator('#cyclingSave').click();
    rows = await getAll(page, 'cyclingWorkouts');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].notes, 'Updated ride');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-delete-cycling]').click();
    assert.equal((await getAll(page, 'cyclingWorkouts')).length, 0);
  } finally {
    await context.close();
  }
});

test('backup: JSON export and import round-trip every IndexedDB store', async () => {
  const { context, page } = await openApp();
  try {
    const fixture = {
      days: [{ date: '2026-01-15', wellbeing: 8, note: 'Backup day' }],
      strengthWorkouts: [{ id: 'strength-fixture', date: '2026-01-15', exerciseId: 'squats', sets: [{ index: 1, reps: 8 }] }],
      cyclingWorkouts: [{ id: 'cycling-fixture', date: '2026-01-15', durationMinutes: 10, distanceKm: 5 }],
      exercises: [{ id: 'exercise-fixture', name: 'Fixture exercise' }],
      bands: [{ id: 'band-fixture', name: 'Fixture band', assistanceLevel: 1 }],
      supplements: [{ id: 'supplement-fixture', name: 'Fixture supplement' }],
      supplementIntakes: [{ id: 'intake-fixture', date: '2026-01-15', supplementId: 'supplement-fixture', dose: '1' }]
    };
    await page.evaluate(async (data) => (await import('./src/db.js')).importAll(data), fixture);
    await page.locator('.more-toggle').click();
    await page.locator('[data-tab="settings"]').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportData').click();
    const download = await downloadPromise;
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.deepEqual(exported, fixture);

    await page.evaluate(async () => (await import('./src/db.js')).importAll({}));
    for (const store of Object.keys(fixture)) assert.equal((await getAll(page, store)).length, 0);
    await page.locator('#importData').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
    await page.waitForFunction(async () => (await import('./src/db.js')).getAll('days').then((rows) => rows.length === 1));
    for (const [store, expected] of Object.entries(fixture)) assert.deepEqual(await getAll(page, store), expected);
    await page.locator('#importData').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{invalid json') });
    assert.deepEqual(await getAll(page, 'days'), fixture.days);
  } finally {
    await context.close();
  }
});

test('offline: installed service worker serves the app and cached assets', async () => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    await page.addInitScript(() => {
      sessionStorage.setItem('test-page-loads', String(Number(sessionStorage.getItem('test-page-loads') || 0) + 1));
    });
    await page.goto(baseURL);
    await page.waitForFunction(() => Number(sessionStorage.getItem('test-page-loads')) >= 2 && navigator.serviceWorker.controller !== null);
    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names.find((name) => name.startsWith('personal-day-journal-v')));
      return Promise.all(['./index.html', './src/app.js', './src/styles.css'].map(async (asset) => Boolean(await cache.match(asset))));
    });
    assert.deepEqual(cached, [true, true, true]);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#strengthExercise').options.length > 1);
    assert.equal(await page.title(), 'День');
  } finally {
    await context.close();
  }
});

test('calculations: forecast, speed, and same-day cycling aggregation', async () => {
  const { context, page } = await openApp();
  try {
    await setDate(page, '2026-01-16');
    await page.evaluate(async () => {
      const db = await import('./src/db.js');
      await db.put('strengthWorkouts', { id: 'previous', date: '2026-01-15', exerciseId: 'handstand-pushups', loadMode: 'band', bandId: 'none', targetReps: 5, sets: Array.from({ length: 5 }, (_, index) => ({ index: index + 1, reps: 5 })) });
      await db.put('strengthWorkouts', { id: 'forecast-source', date: '2026-01-14', exerciseId: 'pullups-reverse-grip', loadMode: 'band', bandId: 'none', targetReps: 5, sets: Array.from({ length: 5 }, (_, index) => ({ index: index + 1, reps: 5 })) });
      await db.put('cyclingWorkouts', { id: 'ride-1', date: '2026-01-15', durationMinutes: 10, averageSpeedKmh: 30, load: 4 });
      await db.put('cyclingWorkouts', { id: 'ride-2', date: '2026-01-15', durationMinutes: 20, averageSpeedKmh: 20, load: 6 });
    });
    await page.locator('[data-tab="strength"]').click();
    await page.waitForFunction(() => document.querySelector('#strengthSuggestion')?.textContent.includes('Зробити: 6'));
    await page.locator('[data-tab="cycling"]').click();
    await page.locator('#cyclingDuration').selectOption('10');
    await page.locator('#cyclingDistance').fill('5');
    assert.equal(await page.locator('#cyclingAverageSpeed').textContent(), '30 км/год');
    await page.locator('.more-toggle').click();
    await page.locator('[data-tab="progress"]').click();
    await page.locator('#progressPanel details').nth(1).locator('summary').click();
    await page.locator('#progressCyclingDateFrom').fill('2026-01-15');
    await page.locator('#progressCyclingDateTo').fill('2026-01-15');
    await page.locator('#progressCyclingMetric').selectOption('load');
    await page.waitForFunction(() => document.querySelector('#cyclingProgressChart')?.textContent.includes('6'));
    assert.match(await page.locator('#cyclingProgressChart').textContent(), /6/);
    await page.locator('#progressCyclingMetric').selectOption('cyclingIndex');
    await page.waitForFunction(() => document.querySelector('#cyclingProgressChart')?.textContent.includes('360'));
    assert.match(await page.locator('#cyclingProgressChart').textContent(), /360/);
  } finally {
    await context.close();
  }
});

test('forecast: first workout uses the exercise minimum and shows no previous result', async () => {
  const { context, page } = await openApp();
  try {
    const block = await showForecast(page, 'handstand-pushups', null, null);
    assert.match(await block.textContent(), /Віджимання у стійці/);
    assert.match(await block.textContent(), /Зробити: 5 у підході/);
    assert.match(await block.textContent(), /Попереднього результату для цієї вправи ще немає/);
  } finally {
    await context.close();
  }
});

for (const scenario of [
  { name: 'uneven sets retain the previous target', reps: [5, 4, 5, 4, 5], targetReps: 7, expected: 7 },
  { name: 'consolidation keeps the same reps', reps: [6, 6, 6, 6, 6], targetReps: 6, needsConsolidation: true, expected: 6 },
  { name: 'empty sets retain the previous target', reps: [], targetReps: 7, expected: 7 }
]) {
  test(`forecast: ${scenario.name}`, async () => {
    const { context, page } = await openApp();
    try {
      const previous = strengthRecord('forecast-previous', 'pullups-reverse-grip', scenario.reps, scenario);
      const block = await showForecast(page, 'pullups-reverse-grip', previous);
      assert.match(await block.textContent(), /Підтягування зворотним хватом/);
      assert.match(await block.textContent(), new RegExp(`Зробити: ${scenario.expected} у підході`));
      assert.match(await block.textContent(), /Гумка: Фіолетова/);
    } finally {
      await context.close();
    }
  });
}

test('forecast: reaching the upper target selects a harder band and applies it to the form', async () => {
  const { context, page } = await openApp();
  try {
    const previous = strengthRecord('forecast-previous', 'pullups-reverse-grip', [10, 10, 10, 10, 10]);
    const block = await showForecast(page, 'pullups-reverse-grip', previous);
    assert.match(await block.textContent(), /Зробити: 5 у підході/);
    assert.match(await block.textContent(), /Гумка: Зелена/);
    await block.locator('[data-enhanced-suggested-strength]').click();
    await page.waitForFunction(() => document.querySelector('#strengthExercise').value === 'pullups-reverse-grip' && document.querySelector('#strengthBand').value === 'green');
    assert.equal(await page.locator('#strengthTargetReps').inputValue(), '5');
  } finally {
    await context.close();
  }
});

test('forecast: reaching the upper target adds 5 kg and applies it to the form', async () => {
  const { context, page } = await openApp();
  try {
    const previous = strengthRecord('forecast-previous', 'squats', [15, 15, 15, 15, 15], { loadMode: 'weight', bandId: null, addedWeightKg: 10, targetReps: 15 });
    const block = await showForecast(page, 'squats', previous, 'pullups-reverse-grip');
    assert.match(await block.textContent(), /Зробити: 10 у підході/);
    assert.match(await block.textContent(), /Додаткова вага: \+15 кг/);
    await block.locator('[data-enhanced-suggested-strength]').click();
    await page.waitForFunction(() => document.querySelector('#strengthExercise').value === 'squats' && document.querySelector('#strengthAddedWeight').value === '15');
    assert.equal(await page.locator('#strengthTargetReps').inputValue(), '10');
  } finally {
    await context.close();
  }
});

for (const [startingLevel, expectedLevel] of [[9, 10], [10, 10]]) {
  test(`forecast: technique level ${startingLevel} advances to ${expectedLevel} at the upper target`, async () => {
    const { context, page } = await openApp();
    try {
      const previous = strengthRecord('forecast-previous', 'leg-raises', [10, 10, 10, 10, 10], {
        loadMode: 'technical_step', bandId: null, technicalStep: 'Кут', technicalStepLevel: startingLevel, targetReps: 10
      });
      const block = await showForecast(page, 'leg-raises', previous, 'ring-pullups');
      assert.match(await block.textContent(), /Зробити: 5 у підході/);
      assert.match(await block.textContent(), /Техніка: Кут/);
      assert.match(await block.textContent(), new RegExp(`Рівень техніки: ${expectedLevel}`));
      await block.locator('[data-enhanced-suggested-strength]').click();
      await page.waitForFunction((level) =>
        document.querySelector('#strengthExercise').value === 'leg-raises' &&
        document.querySelector('#strengthTechnique').value === 'Кут' &&
        document.querySelector('#strengthTechniqueLevel')?.value === String(level), expectedLevel);
      assert.equal(await page.locator('#strengthTechnique').inputValue(), 'Кут');
    } finally {
      await context.close();
    }
  });
}

test('forecast: yesterday\'s skipped turn keeps the missed exercise scheduled today', async () => {
  const { context, page } = await openApp();
  try {
    const previous = strengthRecord('before-skip', 'handstand-pushups', [5]);
    const skipped = { id: 'skipped-turn', date: '2026-01-15', exerciseId: 'skip', loadMode: 'skip', sets: [] };
    const block = await showForecast(page, 'pullups-reverse-grip', previous, null, [skipped]);
    assert.match(await block.textContent(), /Підтягування зворотним хватом/);
    assert.match(await block.textContent(), /Зробити: 5 у підході/);
  } finally {
    await context.close();
  }
});

test('forecast: consecutive skipped days still keep the missed exercise', async () => {
  const { context, page } = await openApp();
  try {
    const previous = strengthRecord('before-skips', 'handstand-pushups', [5], { date: '2026-01-13' });
    const skips = [
      { id: 'skip-1', date: '2026-01-14', exerciseId: 'skip', loadMode: 'skip', sets: [] },
      { id: 'skip-2', date: '2026-01-15', exerciseId: 'skip', loadMode: 'skip', sets: [] }
    ];
    const block = await showForecast(page, 'pullups-reverse-grip', previous, null, skips);
    assert.match(await block.textContent(), /Підтягування зворотним хватом/);
  } finally {
    await context.close();
  }
});

test('forecast: a skip before any completed workout keeps the first exercise', async () => {
  const { context, page } = await openApp();
  try {
    const skipped = { id: 'first-day-skip', date: '2026-01-15', exerciseId: 'skip', loadMode: 'skip', sets: [] };
    const block = await showForecast(page, 'handstand-pushups', null, null, [skipped]);
    assert.match(await block.textContent(), /Віджимання у стійці/);
  } finally {
    await context.close();
  }
});

test('forecast: saving a skip in the form keeps the missed exercise until it is completed', async () => {
  const { context, page } = await openApp();
  try {
    await page.evaluate(async () => {
      const db = await import('./src/db.js');
      await db.put('strengthWorkouts', {
        id: 'completed-before-skip', date: '2026-01-14', exerciseId: 'handstand-pushups',
        loadMode: 'band', bandId: 'none', sets: [{ index: 1, reps: 5 }]
      });
    });
    await setDate(page, '2026-01-15');
    await page.locator('[data-tab="strength"]').click();
    await page.locator('#strengthExercise').selectOption('skip');
    await page.locator('#strengthSave').click();
    await page.waitForFunction(async () => (await import('./src/db.js')).getAll('strengthWorkouts').then((rows) => rows.some((row) => row.loadMode === 'skip')));
    await setDate(page, '2026-01-16');
    await page.waitForFunction(() => document.querySelector('[data-enhanced-suggested-strength]')?.dataset.enhancedSuggestedStrength === 'pullups-reverse-grip');
    await page.locator('[data-enhanced-suggested-strength]').click();
    await page.waitForFunction(() => document.querySelector('#strengthExercise').value === 'pullups-reverse-grip');
    await page.locator('#strengthSave').click();
    await page.waitForFunction(async () => (await import('./src/db.js')).getAll('strengthWorkouts').then((rows) => rows.some((row) => row.date === '2026-01-16' && row.exerciseId === 'pullups-reverse-grip')));
    await setDate(page, '2026-01-17');
    await page.waitForFunction(() => document.querySelector('[data-enhanced-suggested-strength]')?.dataset.enhancedSuggestedStrength === 'squats');
  } finally {
    await context.close();
  }
});

test('Google Sheets UI: upload, restore, and failed request use a mocked endpoint', async () => {
  const { context, page } = await openApp();
  const requests = [];
  try {
    await context.route('https://script.google.com/macros/s/test/exec**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        requests.push(JSON.parse(request.postData()));
        await route.fulfill({ status: 200, body: 'ok', headers: { 'access-control-allow-origin': '*' } });
      } else {
        const callback = new URL(request.url()).searchParams.get('callback');
        const payload = { ok: true, savedAt: '2026-01-15T10:00:00Z', data: { days: [{ date: '2026-01-15', note: 'From Sheets' }] } };
        await route.fulfill({ status: 200, contentType: 'text/javascript', body: `${callback}(${JSON.stringify(payload)});` });
      }
    });
    await page.locator('.more-toggle').click();
    await page.locator('[data-tab="settings"]').click();
    await page.locator('#sheetsScriptUrl').fill('https://script.google.com/macros/s/test/exec');
    await page.locator('#sheetsBackupKey').fill('test-key');
    await page.locator('#backupToSheets').click();
    await page.waitForFunction(() => document.querySelector('#sheetsBackupStatus').textContent.includes('відправлено'));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].key, 'test-key');
    assert.ok(requests[0].data.days);
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#restoreFromSheets').click();
    await page.waitForFunction(() => document.querySelector('#sheetsBackupStatus').textContent.includes('Відновлено'));
    assert.equal((await getAll(page, 'days'))[0].note, 'From Sheets');
    await context.unrouteAll();
    await context.route('https://script.google.com/macros/s/test/exec**', (route) => route.abort());
    await page.locator('#backupToSheets').click();
    await page.waitForFunction(() => document.querySelector('#sheetsBackupStatus').textContent.includes('Не вдалося'));
  } finally {
    await context.close();
  }
});
