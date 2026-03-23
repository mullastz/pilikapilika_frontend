import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageAccount } from './manage-account';

describe('ManageAccount', () => {
  let component: ManageAccount;
  let fixture: ComponentFixture<ManageAccount>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageAccount],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageAccount);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
