import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-feature-panel',
  imports: [CommonModule],
  templateUrl: './feature-panel.html',
  styleUrl: './feature-panel.scss',
})
export class FeaturePanel {
  @Input({ required: true })
  title = '';

  @Input({ required: true })
  subtitle = '';
}
