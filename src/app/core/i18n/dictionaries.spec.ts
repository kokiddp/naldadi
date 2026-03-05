import { describe, expect, it } from 'vitest';

import { EN_DICTIONARY } from './en';
import { IT_DICTIONARY } from './it';

function sortedKeys(dictionary: Record<string, string>): string[] {
  return Object.keys(dictionary).sort((a, b) => a.localeCompare(b));
}

describe('i18n dictionaries', () => {
  it('keeps English and Italian key sets aligned', () => {
    const enKeys = sortedKeys(EN_DICTIONARY);
    const itKeys = sortedKeys(IT_DICTIONARY);

    expect(itKeys).toEqual(enKeys);
  });
});
