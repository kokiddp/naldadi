import { TestBed } from '@angular/core/testing';

import { DiceThrowPage } from './dice-throw-page';

describe('DiceThrowPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DiceThrowPage],
    }).compileComponents();
  });

  it('creates the throw route page', () => {
    const fixture = TestBed.createComponent(DiceThrowPage);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
