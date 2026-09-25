const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createScript() {
  const cells = new Map();
  let clearCount = 0;
  const sheet = {
    clear() { cells.clear(); clearCount += 1; },
    getRange(row, column) {
      return {
        setValues(rows) {
          rows.forEach((values, rowIndex) => values.forEach((value, columnIndex) => {
            cells.set(`${row + rowIndex}:${column + columnIndex}`, value);
          }));
        },
        getValue() { return cells.get(`${row}:${column}`) || ''; }
      };
    }
  };
  const output = (text) => ({ text, setMimeType(type) { this.mimeType = type; return this; } });
  const sandbox = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
    ContentService: { createTextOutput: output, MimeType: { JSON: 'json', JAVASCRIPT: 'javascript' } }
  };
  vm.runInNewContext(readFileSync(path.join(__dirname, '..', 'apps-script.gs'), 'utf8'), sandbox);
  return { sandbox, cells, get clearCount() { return clearCount; } };
}

test('Google Apps Script stores and restores a complete snapshot', () => {
  const script = createScript();
  const data = { days: [{ date: '2026-01-15', note: 'Stored in Sheets' }], strengthWorkouts: [] };
  const savedAt = '2026-01-15T10:00:00Z';
  const post = script.sandbox.doPost({ postData: { contents: JSON.stringify({ key: 'change-this-key', savedAt, source: 'test', data }) } });
  assert.equal(JSON.parse(post.text).ok, true);
  assert.equal(script.cells.get('2:1'), savedAt);
  assert.equal(script.cells.get('2:2'), 'test');
  assert.deepEqual(JSON.parse(script.cells.get('2:3')), data);

  const get = script.sandbox.doGet({ parameter: { key: 'change-this-key', callback: 'receiveBackup' } });
  assert.equal(get.mimeType, 'javascript');
  assert.ok(get.text.startsWith('receiveBackup('));
  const payload = JSON.parse(get.text.slice('receiveBackup('.length, -2));
  assert.deepEqual(payload.data, data);
  assert.equal(payload.savedAt, savedAt);
});

test('Google Apps Script rejects a wrong key without clearing an existing backup', () => {
  const script = createScript();
  script.sandbox.doPost({ postData: { contents: JSON.stringify({ key: 'change-this-key', data: { days: [{ date: '2026-01-15' }] } }) } });
  const before = script.cells.get('2:3');
  const clearCount = script.clearCount;
  const response = script.sandbox.doPost({ postData: { contents: JSON.stringify({ key: 'wrong-key', data: {} }) } });
  assert.equal(JSON.parse(response.text).error, 'Invalid key');
  assert.equal(script.clearCount, clearCount);
  assert.equal(script.cells.get('2:3'), before);
  assert.match(script.sandbox.doGet({ parameter: { key: 'wrong-key', callback: 'receiveBackup' } }).text, /Invalid key/);
});
