import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { type DistributionPoint } from '../../../core/simulation.engine';

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

  protected readonly viewWidth = 720;
  protected readonly viewHeight = 220;

  protected get linePath(): string {
    if (this.points.length === 0) {
      return '';
    }

    const maxTotal = this.points[this.points.length - 1]?.total ?? 1;
    const minTotal = this.points[0]?.total ?? 0;
    const xRange = Math.max(1, maxTotal - minTotal);

    const pathParts: string[] = [];
    this.points.forEach((point, index) => {
      const x = ((point.total - minTotal) / xRange) * this.viewWidth;
      const y = (1 - point.cumulativeProbability) * this.viewHeight;
      pathParts.push(`${index === 0 ? 'M' : 'L'} ${x} ${y}`);
    });

    return pathParts.join(' ');
  }

  protected get maxFrequency(): number {
    return Math.max(1, ...this.points.map((point) => point.frequency));
  }

  protected trackByTotal(_: number, point: DistributionPoint): number {
    return point.total;
  }
}
