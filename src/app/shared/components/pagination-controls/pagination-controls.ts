import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';

import { I18nService } from '../../../core/i18n.service';

@Component({
  selector: 'app-pagination-controls',
  imports: [CommonModule],
  templateUrl: './pagination-controls.html',
  styleUrl: './pagination-controls.scss',
})
export class PaginationControls {
  private readonly i18n = inject(I18nService);

  @Input({ required: true })
  currentPage = 1;

  @Input({ required: true })
  totalPages = 1;

  @Input()
  previousDisabled = false;

  @Input()
  nextDisabled = false;

  @Output()
  readonly previous = new EventEmitter<void>();

  @Output()
  readonly next = new EventEmitter<void>();

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected onPrevious(): void {
    this.previous.emit();
  }

  protected onNext(): void {
    this.next.emit();
  }
}
