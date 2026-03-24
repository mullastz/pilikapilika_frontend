import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackShipping } from './track-shipping';

describe('TrackShipping', () => {
  let component: TrackShipping;
  let fixture: ComponentFixture<TrackShipping>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackShipping],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackShipping);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
