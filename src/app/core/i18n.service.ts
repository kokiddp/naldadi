import { Injectable, signal } from '@angular/core';

import { EN_DICTIONARY } from './i18n/en';
import { IT_DICTIONARY } from './i18n/it';
import { type Dictionary, type SupportedLanguage } from './i18n/types';

const DICTIONARIES: Record<SupportedLanguage, Dictionary> = {
  en: EN_DICTIONARY,
  it: IT_DICTIONARY,
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly language = signal<SupportedLanguage>(this.detectLanguage());

  readonly currentLanguage = this.language.asReadonly();

  t(key: string, params?: Record<string, string | number>): string {
    const dictionary = DICTIONARIES[this.language()];
    const template = dictionary[key] ?? EN_DICTIONARY[key] ?? key;

    if (params === undefined) {
      return template;
    }

    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, placeholder: string) => {
      const value = params[placeholder];
      return value === undefined ? '' : String(value);
    });
  }

  private detectLanguage(): SupportedLanguage {
    const languages = typeof navigator !== 'undefined' ? navigator.languages : [];
    const candidate = (languages[0] ?? navigator.language ?? 'en').toLowerCase();
    return candidate.startsWith('it') ? 'it' : 'en';
  }
}
