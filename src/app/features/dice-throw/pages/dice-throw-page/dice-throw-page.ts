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
  private readonly i18n = inject(I18nService);
  protected readonly dieTypes = DIE_TYPES;
  protected readonly config = signal<ThrowConfig>(createEmptyThrowConfig());
  protected readonly result = signal<ThrowRollResult | null>(null);
  protected readonly history = signal<ThrowHistoryItem[]>([]);

  protected readonly canRoll = computed(() => getTotalDice(this.config()) > 0);
  protected readonly validationError = computed(() => {
    const error = validateThrowConfig(this.config())[0] ?? null;
    return error === null ? null : this.translateThrowValidationError(error);
  });

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

    this.history.update((current) => [item, ...current].slice(0, 12));
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
}
