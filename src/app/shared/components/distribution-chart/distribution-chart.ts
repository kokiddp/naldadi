import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { type DistributionPoint } from '../../../core/simulation.engine';

interface HistogramPoint {
  readonly key: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly frequency: number;
  readonly probability: number;
}

@Component({
  selector: 'app-distribution-chart',
  imports: [CommonModule],
  templateUrl: './distribution-chart.html',
  styleUrl: './distribution-chart.scss',
})
export class DistributionChart {
  @Input({ required: true })
  points: DistributionPoint[] = [];

  @Input({ required: true })
  title = '';

  @Input()
  mode: 'histogram' | 'cdf' = 'histogram';

  @Input()
  meanMarker: number | null = null;

  @Input()
  medianMarker: number | null = null;

  protected readonly viewWidth = 720;
  protected readonly viewHeight = 220;
  private readonly maxHistogramBars = 100;
  private readonly maxCdfPoints = 700;
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
  private sampledCdfCacheKey: DistributionPoint[] | null = null;
  private sampledCdfCache: DistributionPoint[] = [];
  private linePathCacheKey: DistributionPoint[] | null = null;
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

      histogramPoints.push({
        key: `${startTotal}-${endTotal}`,
        label: startTotal === endTotal ? `${startTotal}` : `${startTotal}-${endTotal}`,
        shortLabel:
          startTotal === endTotal
            ? this.formatCompactNumber(startTotal)
            : `${this.formatCompactNumber(startTotal)}-${this.formatCompactNumber(endTotal)}`,
        frequency,
        probability,
      });
    }

    this.histogramCache = histogramPoints;
    this.histogramCacheKey = this.points;
    return this.histogramCache;
  }

  protected get sampledCdfPoints(): DistributionPoint[] {
    if (this.sampledCdfCacheKey === this.points) {
      return this.sampledCdfCache;
    }

    if (this.points.length <= this.maxCdfPoints) {
      this.sampledCdfCache = this.points;
      this.sampledCdfCacheKey = this.points;
      return this.sampledCdfCache;
    }

    const step = Math.ceil(this.points.length / this.maxCdfPoints);
    const sampled: DistributionPoint[] = [];

    for (let index = 0; index < this.points.length; index += step) {
      sampled.push(this.points[index]!);
    }

    const lastPoint = this.points[this.points.length - 1];
    if (sampled[sampled.length - 1] !== lastPoint && lastPoint !== undefined) {
      sampled.push(lastPoint);
    }

    this.sampledCdfCache = sampled;
    this.sampledCdfCacheKey = this.points;
    return this.sampledCdfCache;
  }

  protected get linePath(): string {
    const sampled = this.sampledCdfPoints;
    if (sampled.length === 0) {
      return '';
    }

    if (this.linePathCacheKey === sampled) {
      return this.linePathCache;
    }

    const maxTotal = sampled[sampled.length - 1]?.total ?? 1;
    const minTotal = sampled[0]?.total ?? 0;
    const xRange = Math.max(1, maxTotal - minTotal);

    const pathParts: string[] = [];
    sampled.forEach((point, index) => {
      const x = ((point.total - minTotal) / xRange) * this.viewWidth;
      const y = (1 - point.cumulativeProbability) * this.viewHeight;
      pathParts.push(`${index === 0 ? 'M' : 'L'} ${x} ${y}`);
    });

    this.linePathCache = pathParts.join(' ');
    this.linePathCacheKey = sampled;
    return this.linePathCache;
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
    return `${(probability * 100).toFixed(2)}%`;
  }

  protected getHistogramTooltip(point: HistogramPoint): string {
    return `Total ${point.label}: ${point.frequency.toLocaleString()} results (${this.formatPercent(point.probability)})`;
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

  private formatCompactNumber(value: number): string {
    return this.compactNumberFormatter.format(value);
  }
}
