import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgentPage } from './agent-page';

describe('AgentPage', () => {
  let component: AgentPage;
  let fixture: ComponentFixture<AgentPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentPage],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
