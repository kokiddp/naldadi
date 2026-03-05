import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DIE_TYPES, type DieType, type ThrowConfig } from '../../../core/dice.model';
import {
  decrementDie,
  incrementDie,
  normalizeThrowConfig,
  sanitizeDieCount,
  validateThrowConfig,
} from '../../../core/throw.validators';

@Component({
  selector: 'app-throw-composer',
  imports: [CommonModule, FormsModule],
  templateUrl: './throw-composer.html',
  styleUrl: './throw-composer.scss',
})
export class ThrowComposer {
  @Input({ required: true })
  config!: ThrowConfig;

  @Output()
  readonly configChange = new EventEmitter<ThrowConfig>();

  protected readonly dieTypes = DIE_TYPES;

  protected get normalizedConfig(): ThrowConfig {
    return normalizeThrowConfig(this.config);
  }

  protected get configErrors(): string[] {
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
}
