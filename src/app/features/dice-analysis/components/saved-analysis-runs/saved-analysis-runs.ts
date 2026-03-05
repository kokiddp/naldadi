import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import { I18nService } from '../../../../core/i18n.service';

export interface SavedAnalysisRunView {
  readonly id: number;
  readonly title: string;
  readonly summary: string;
}

@Component({
  selector: 'app-saved-analysis-runs',
  imports: [CommonModule],
  templateUrl: './saved-analysis-runs.html',
  styleUrl: './saved-analysis-runs.scss',
})
export class SavedAnalysisRuns {
  private readonly i18n = inject(I18nService);

  @Input({ required: true })
  items: ReadonlyArray<SavedAnalysisRunView> = [];

  @Input()
  activeItemId: number | null = null;

  @Input({ required: true })
  currentPage = 1;

  @Input({ required: true })
  totalPages = 1;

  @Input()
  disabled = false;

  @Output()
  readonly load = new EventEmitter<number>();

  @Output()
  readonly delete = new EventEmitter<number>();

  @Output()
  readonly clear = new EventEmitter<void>();

  @Output()
  readonly previousPage = new EventEmitter<void>();

  @Output()
  readonly nextPage = new EventEmitter<void>();

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected trackBySavedRun(_: number, item: SavedAnalysisRunView): number {
    return item.id;
  }

  protected onLoad(itemId: number): void {
    this.load.emit(itemId);
  }

  protected onDelete(itemId: number): void {
    this.delete.emit(itemId);
  }

  protected onClear(): void {
    this.clear.emit();
  }

  protected onPreviousPage(): void {
    this.previousPage.emit();
  }

  protected onNextPage(): void {
    this.nextPage.emit();
  }
}
