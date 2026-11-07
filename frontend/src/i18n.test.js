import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LANGUAGES,
  MESSAGES,
  formatMessage,
  languageFromNavigator,
} from './i18n.js';

test('every language defines exactly the same message keys', () => {
  const base = Object.keys(MESSAGES.en).sort();
  for (const { value } of LANGUAGES) {
    assert.ok(MESSAGES[value], `missing dictionary for ${value}`);
    assert.deepEqual(Object.keys(MESSAGES[value]).sort(), base, value);
  }
});

test('formatMessage interpolates variables and pluralizes English', () => {
  assert.equal(
    formatMessage('en', 'onboarding.openError', { msg: 'denied' }),
    'Could not open folder: denied'
  );
  assert.equal(formatMessage('en', 'notes.count', { n: 1 }), '1 note');
  assert.equal(formatMessage('en', 'notes.count', { n: 3 }), '3 notes');
  assert.equal(formatMessage('en', 'note.counts', { words: 1, chars: 2 }), '1 word · 2 characters');
  assert.equal(formatMessage('zh-CN', 'notes.count', { n: 3 }), '3 篇');
  assert.equal(formatMessage('zh-CN', 'note.counts', { words: 5, chars: 9 }), '5 字 · 9 字符');
});

test('languageFromNavigator follows Chinese/English and falls back to English', () => {
  assert.equal(languageFromNavigator({ language: 'zh-Hans-CN' }), 'zh-CN');
  assert.equal(
    languageFromNavigator({ languages: ['fr-FR', 'zh-CN'] }),
    'zh-CN'
  );
  assert.equal(languageFromNavigator({ languages: ['en-US'] }), 'en');
  assert.equal(languageFromNavigator({ languages: ['fr-FR'] }), 'en');
});
