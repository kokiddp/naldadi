import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DIE_TYPES, type DieType, type ThrowConfig } from '../../../core/dice.model';
import { I18nService } from '../../../core/i18n.service';
import {
  decrementDie,
  incrementDie,
  normalizeThrowConfig,
  sanitizeDieCount,
  type ThrowValidationError,
  validateThrowConfig,
} from '../../../core/throw.validators';

@Component({
  selector: 'app-throw-composer',
  imports: [CommonModule, FormsModule],
  templateUrl: './throw-composer.html',
  styleUrl: './throw-composer.scss',
})
export class ThrowComposer {
  private readonly i18n = inject(I18nService);
  @Input({ required: true })
  config!: ThrowConfig;

  @Output()
  readonly configChange = new EventEmitter<ThrowConfig>();

  protected readonly dieTypes = DIE_TYPES;

  protected get normalizedConfig(): ThrowConfig {
    return normalizeThrowConfig(this.config);
  }

  protected get configErrors(): ThrowValidationError[] {
    return validateThrowConfig(this.normalizedConfig);
  }

  protected increase(dieType: DieType): void {
    this.configChange.emit(incrementDie(this.normalizedConfig, dieType));
  }

  protected decrease(dieType: DieType): void {
    this.configChange.emit(decrementDie(this.normalizedConfig, dieType));
  }

  protected onCountChange(dieType: DieType, value: string): void {
    const parsed = Number.parseInt(value, 10);
    this.configChange.emit({
      ...this.normalizedConfig,
      [dieType]: sanitizeDieCount(parsed),
    });
  }

  protected trackByDieType(_: number, dieType: DieType): DieType {
    return dieType;
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected getConfigErrorMessage(error: ThrowValidationError): string {
    if (error.key === 'invalidDieCount') {
      return this.i18n.t('validator.invalidDieCount', { dieType: error.dieType ?? '' });
    }

    return this.i18n.t('validator.noDiceSelected');
  }
}
