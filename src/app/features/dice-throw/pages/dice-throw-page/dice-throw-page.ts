import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';

import { createEmptyThrowConfig, DIE_TYPES, type ThrowConfig } from '../../../../core/dice.model';
import { I18nService } from '../../../../core/i18n.service';
import { rollThrow, type ThrowRollResult } from '../../../../core/roll.engine';
import { getTotalDice, validateThrowConfig, type ThrowValidationError } from '../../../../core/throw.validators';
import { ThrowComposer } from '../../../../shared/components/throw-composer/throw-composer';

interface ThrowHistoryItem {
  readonly id: number;
  readonly total: number;
  readonly summary: string;
}

@Component({
  selector: 'app-dice-throw-page',
  imports: [CommonModule, ThrowComposer],
  templateUrl: './dice-throw-page.html',
  styleUrl: './dice-throw-page.scss',
})
export class DiceThrowPage {
  private readonly historyStorageKey = 'naldadi.throw.history';
  private readonly maxStoredHistoryItems = 200;
  private readonly pageSize = 20;
  private readonly i18n = inject(I18nService);
  protected readonly dieTypes = DIE_TYPES;
  protected readonly config = signal<ThrowConfig>(createEmptyThrowConfig());
  protected readonly result = signal<ThrowRollResult | null>(null);
  protected readonly history = signal<ThrowHistoryItem[]>(this.loadHistory());
  protected readonly historyPage = signal(1);

  protected readonly canRoll = computed(() => getTotalDice(this.config()) > 0);
  protected readonly validationError = computed(() => {
    const error = validateThrowConfig(this.config())[0] ?? null;
    return error === null ? null : this.translateThrowValidationError(error);
  });
  protected readonly totalHistoryPages = computed(() =>
    Math.max(1, Math.ceil(this.history().length / this.pageSize)),
  );
  protected readonly pagedHistory = computed(() => {
    const page = Math.min(this.historyPage(), this.totalHistoryPages());
    const start = (page - 1) * this.pageSize;
    return this.history().slice(start, start + this.pageSize);
  });
  protected readonly canGoToPreviousHistoryPage = computed(() => this.historyPage() > 1);
  protected readonly canGoToNextHistoryPage = computed(
    () => this.historyPage() < this.totalHistoryPages(),
  );

  protected onConfigChange(updatedConfig: ThrowConfig): void {
    this.config.set(updatedConfig);
  }

  protected roll(): void {
    const nextResult = rollThrow(this.config());
    this.result.set(nextResult);

    const summary = DIE_TYPES.map((dieType) => {
      const values = nextResult.rollsByType[dieType];
      return values.length > 0 ? `${dieType}: ${values.join(', ')}` : null;
    })
      .filter((value): value is string => value !== null)
      .join(' | ');

    const item: ThrowHistoryItem = {
      id: Date.now(),
      total: nextResult.total,
      summary,
    };

    this.history.update((current) => {
      const next = [item, ...current].slice(0, this.maxStoredHistoryItems);
      this.persistHistory(next);
      return next;
    });
    this.historyPage.set(1);
  }

  protected deleteHistoryItem(itemId: number): void {
    this.history.update((current) => {
      const next = current.filter((item) => item.id !== itemId);
      this.persistHistory(next);
      return next;
    });
    this.clampHistoryPage();
  }

  protected clearHistory(): void {
    this.history.set([]);
    this.persistHistory([]);
    this.historyPage.set(1);
  }

  protected previousHistoryPage(): void {
    if (!this.canGoToPreviousHistoryPage()) {
      return;
    }

    this.historyPage.update((current) => Math.max(1, current - 1));
  }

  protected nextHistoryPage(): void {
    if (!this.canGoToNextHistoryPage()) {
      return;
    }

    this.historyPage.update((current) => Math.min(this.totalHistoryPages(), current + 1));
  }

  protected trackByHistoryId(_: number, item: ThrowHistoryItem): number {
    return item.id;
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected getRollValues(rollResult: ThrowRollResult, dieType: (typeof DIE_TYPES)[number]): string {
    const values = rollResult.rollsByType[dieType];
    return values.length > 0 ? values.join(', ') : '-';
  }

  private translateThrowValidationError(error: ThrowValidationError): string {
    if (error.key === 'invalidDieCount') {
      return this.i18n.t('validator.invalidDieCount', { dieType: error.dieType ?? '' });
    }

    return this.i18n.t('validator.noDiceSelected');
  }

  private persistHistory(items: ThrowHistoryItem[]): void {
    try {
      localStorage.setItem(this.historyStorageKey, JSON.stringify(items));
    } catch {
      // Ignore persistence failures (private mode/quota issues).
    }
  }

  private loadHistory(): ThrowHistoryItem[] {
    try {
      const raw = localStorage.getItem(this.historyStorageKey);
      if (raw === null) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item): item is ThrowHistoryItem => this.isThrowHistoryItem(item))
        .slice(0, this.maxStoredHistoryItems);
    } catch {
      return [];
    }
  }

  private isThrowHistoryItem(value: unknown): value is ThrowHistoryItem {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<ThrowHistoryItem>;
    return (
      typeof candidate.id === 'number' &&
      typeof candidate.total === 'number' &&
      typeof candidate.summary === 'string'
    );
  }

  private clampHistoryPage(): void {
    this.historyPage.update((current) => Math.min(current, this.totalHistoryPages()));
  }
}
