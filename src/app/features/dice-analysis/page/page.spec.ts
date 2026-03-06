import { TestBed } from '@angular/core/testing';

import { DiceAnalysisPage } from './page';

describe('DiceAnalysisPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DiceAnalysisPage],
    }).compileComponents();
  });

  it('creates the analysis route page', () => {
    const fixture = TestBed.createComponent(DiceAnalysisPage);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
