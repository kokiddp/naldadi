import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';

import { I18nService } from '../../../core/i18n.service';
import { type DistributionPoint } from '../../../core/simulation.engine';

interface HistogramPoint {
  readonly key: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly frequency: number;
  readonly probability: number;
  readonly expectedProbability: number | null;
}

@Component({
  selector: 'app-distribution-chart',
  imports: [CommonModule],
  templateUrl: './distribution-chart.html',
  styleUrl: './distribution-chart.scss',
})
export class DistributionChart {
  private readonly i18n = inject(I18nService);
  @Input({ required: true })
  points: DistributionPoint[] = [];

  @Input({ required: true })
  title = '';

  @Input()
  mode: 'histogram' | 'cdf' | 'pmf' | 'tail' = 'histogram';

  @Input()
  meanMarker: number | null = null;

  @Input()
  medianMarker: number | null = null;

  protected readonly viewWidth = 720;
  protected readonly viewHeight = 220;
  private readonly maxHistogramBars = 100;
  private readonly maxLinePoints = 700;
  protected tooltipVisible = false;
  protected tooltipText = '';
  protected tooltipLeft = 0;
  protected tooltipTop = 0;
  protected tooltipBelowCursor = false;
  private readonly compactNumberFormatter = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  private histogramCacheKey: DistributionPoint[] | null = null;
  private histogramCache: HistogramPoint[] = [];
  private sampledLineCacheKey: DistributionPoint[] | null = null;
  private sampledLineCache: DistributionPoint[] = [];
  private linePathCacheKey: DistributionPoint[] | null = null;
  private linePathCacheMode: 'cdf' | 'pmf' | 'tail' | null = null;
  private linePathCache = '';
  private maxFrequencyCacheKey: HistogramPoint[] | null = null;
  private maxFrequencyCache = 1;

  protected get histogramPoints(): HistogramPoint[] {
    if (this.histogramCacheKey === this.points) {
      return this.histogramCache;
    }

    if (this.points.length <= this.maxHistogramBars) {
      this.histogramCache = this.points.map((point) => ({
        key: `${point.total}`,
        label: `${point.total}`,
        shortLabel: this.formatCompactNumber(point.total),
        frequency: point.frequency,
        probability: point.probability,
        expectedProbability: point.expectedProbability,
      }));

      this.histogramCacheKey = this.points;
      return this.histogramCache;
    }

    const chunkSize = Math.ceil(this.points.length / this.maxHistogramBars);
    const histogramPoints: HistogramPoint[] = [];

    for (let index = 0; index < this.points.length; index += chunkSize) {
      const chunk = this.points.slice(index, index + chunkSize);
      const startTotal = chunk[0]?.total ?? 0;
      const endTotal = chunk[chunk.length - 1]?.total ?? startTotal;
      const frequency = chunk.reduce((sum, point) => sum + point.frequency, 0);
      const probability = chunk.reduce((sum, point) => sum + point.probability, 0);
      const expectedProbabilitySum = chunk.reduce(
        (sum, point) => sum + (point.expectedProbability ?? 0),
        0,
      );
      const hasExpectedProbability = chunk.some((point) => point.expectedProbability !== null);

      histogramPoints.push({
        key: `${startTotal}-${endTotal}`,
        label: startTotal === endTotal ? `${startTotal}` : `${startTotal}-${endTotal}`,
        shortLabel:
          startTotal === endTotal
            ? this.formatCompactNumber(startTotal)
            : `${this.formatCompactNumber(startTotal)}-${this.formatCompactNumber(endTotal)}`,
        frequency,
        probability,
        expectedProbability: hasExpectedProbability ? expectedProbabilitySum : null,
      });
    }

    this.histogramCache = histogramPoints;
    this.histogramCacheKey = this.points;
    return this.histogramCache;
  }

  protected get sampledLinePoints(): DistributionPoint[] {
    if (this.sampledLineCacheKey === this.points) {
      return this.sampledLineCache;
    }

    if (this.points.length <= this.maxLinePoints) {
      this.sampledLineCache = this.points;
      this.sampledLineCacheKey = this.points;
      return this.sampledLineCache;
    }

    const step = Math.ceil(this.points.length / this.maxLinePoints);
    const sampled: DistributionPoint[] = [];

    for (let index = 0; index < this.points.length; index += step) {
      sampled.push(this.points[index]!);
    }

    const lastPoint = this.points[this.points.length - 1];
    if (sampled[sampled.length - 1] !== lastPoint && lastPoint !== undefined) {
      sampled.push(lastPoint);
    }

    this.sampledLineCache = sampled;
    this.sampledLineCacheKey = this.points;
    return this.sampledLineCache;
  }

  protected get linePath(): string {
    const sampled = this.sampledLinePoints;
    if (sampled.length === 0) {
      return '';
    }

    if (this.mode !== 'cdf' && this.mode !== 'pmf' && this.mode !== 'tail') {
      return '';
    }

    if (this.linePathCacheKey === sampled && this.linePathCacheMode === this.mode) {
      return this.linePathCache;
    }

    const maxTotal = sampled[sampled.length - 1]?.total ?? 1;
    const minTotal = sampled[0]?.total ?? 0;
    const xRange = Math.max(1, maxTotal - minTotal);
    const maxPmfProbability =
      this.mode === 'pmf' ? Math.max(1e-9, ...sampled.map((point) => point.probability)) : 1;

    const pathParts: string[] = [];
    sampled.forEach((point, index) => {
      const x = ((point.total - minTotal) / xRange) * this.viewWidth;
      const yValue = this.getLineValue(point, maxPmfProbability);
      const y = (1 - yValue) * this.viewHeight;
      pathParts.push(`${index === 0 ? 'M' : 'L'} ${x} ${y}`);
    });

    this.linePathCache = pathParts.join(' ');
    this.linePathCacheKey = sampled;
    this.linePathCacheMode = this.mode;
    return this.linePathCache;
  }

  protected get lineClass(): string {
    if (this.mode === 'pmf') {
      return 'pmf-line';
    }

    if (this.mode === 'tail') {
      return 'tail-line';
    }

    return 'cdf-line';
  }

  protected get maxFrequency(): number {
    const histogram = this.histogramPoints;
    if (this.maxFrequencyCacheKey === histogram) {
      return this.maxFrequencyCache;
    }

    this.maxFrequencyCache = Math.max(1, ...histogram.map((point) => point.frequency));
    this.maxFrequencyCacheKey = histogram;
    return this.maxFrequencyCache;
  }

  protected get markerRange(): { min: number; max: number; range: number } {
    const min = this.points[0]?.total ?? 0;
    const max = this.points[this.points.length - 1]?.total ?? 1;
    return {
      min,
      max,
      range: Math.max(1, max - min),
    };
  }

  protected markerLeft(total: number | null): number {
    if (total === null || this.points.length === 0) {
      return 0;
    }

    const range = this.markerRange;
    const normalized = (total - range.min) / range.range;
    return Math.min(100, Math.max(0, normalized * 100));
  }

  protected formatPercent(probability: number): string {
    const percent = probability * 100;
    if (percent >= 1) {
      return `${percent.toFixed(2)}%`;
    }

    if (percent >= 0.01) {
      return `${percent.toFixed(4)}%`;
    }

    if (percent > 0) {
      return `${percent.toFixed(6)}%`;
    }

    return '0.00%';
  }

  protected getHistogramTooltip(point: HistogramPoint): string {
    return this.i18n.t('chart.tooltip.histogramPoint', {
      label: point.label,
      frequency: point.frequency.toLocaleString(),
      actualProbability: this.formatPercent(point.probability),
      expectedProbability:
        point.expectedProbability === null ? '-' : this.formatPercent(point.expectedProbability),
    });
  }

  protected get isBinnedHistogram(): boolean {
    return this.points.length > this.maxHistogramBars;
  }

  protected shouldRenderLabel(index: number): boolean {
    const total = this.histogramPoints.length;
    if (total <= 18) {
      return true;
    }

    const step = Math.max(1, Math.ceil(total / 9));
    return index === 0 || index % step === 0 || index === total - 1;
  }

  protected onBarHover(event: MouseEvent, point: HistogramPoint): void {
    const wrap = (event.currentTarget as HTMLElement | null)?.closest('.histogram-wrap') as HTMLElement | null;
    if (wrap === null) {
      return;
    }

    const rect = wrap.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;

    this.tooltipVisible = true;
    this.tooltipText = this.getHistogramTooltip(point);
    this.tooltipLeft = Math.max(10, Math.min(rect.width - 10, relativeX));
    this.tooltipTop = Math.max(10, Math.min(rect.height - 10, relativeY));
    this.tooltipBelowCursor = relativeY < 54;
  }

  protected onBarLeave(): void {
    this.tooltipVisible = false;
  }

  protected onBarFocus(point: HistogramPoint): void {
    this.tooltipVisible = true;
    this.tooltipText = this.getHistogramTooltip(point);
    this.tooltipLeft = 18;
    this.tooltipTop = 18;
    this.tooltipBelowCursor = true;
  }

  protected trackByHistogramKey(_: number, point: HistogramPoint): string {
    return point.key;
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }

  private getLineValue(point: DistributionPoint, maxPmfProbability: number): number {
    if (this.mode === 'pmf') {
      return Math.min(1, Math.max(0, point.probability / maxPmfProbability));
    }

    if (this.mode === 'tail') {
      const lessThanCurrent = point.cumulativeProbability - point.probability;
      return Math.min(1, Math.max(0, 1 - lessThanCurrent));
    }

    return Math.min(1, Math.max(0, point.cumulativeProbability));
  }

  private formatCompactNumber(value: number): string {
    return this.compactNumberFormatter.format(value);
  }
}
