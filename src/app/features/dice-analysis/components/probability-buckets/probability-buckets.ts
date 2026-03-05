import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';

import { I18nService } from '../../../../core/i18n.service';
import { type DistributionPoint } from '../../../../core/simulation.engine';

export interface ProbabilityBucketItem {
  readonly fromPercent: number;
  readonly toPercent: number;
  readonly points: ReadonlyArray<DistributionPoint>;
}

@Component({
  selector: 'app-probability-buckets',
  imports: [CommonModule],
  templateUrl: './probability-buckets.html',
  styleUrl: './probability-buckets.scss',
})
export class ProbabilityBuckets {
  private readonly i18n = inject(I18nService);

  @Input({ required: true })
  buckets: ReadonlyArray<ProbabilityBucketItem> = [];

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  protected trackByBucket(_: number, row: ProbabilityBucketItem): number {
    return row.toPercent;
  }

  protected trackByTotal(_: number, point: DistributionPoint): number {
    return point.total;
  }

  protected formatPercent(probability: number): string {
    return `${(probability * 100).toFixed(2)}%`;
  }

  protected formatProbabilityBucketLabel(row: ProbabilityBucketItem): string {
    if (row.fromPercent === 0) {
      return this.i18n.t('analysis.probabilityBuckets.label.lessThan', { to: row.toPercent });
    }

    return this.i18n.t('analysis.probabilityBuckets.label.range', {
      from: row.fromPercent,
      to: row.toPercent,
    });
  }
}
