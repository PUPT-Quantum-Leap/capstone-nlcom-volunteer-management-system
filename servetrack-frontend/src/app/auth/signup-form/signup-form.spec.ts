import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { SignupForm } from './signup-form';

describe('SignupForm', () => {
  let component: SignupForm;
  let fixture: ComponentFixture<SignupForm>;

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [SignupForm],
    })
      .overrideComponent(SignupForm, {
        remove: {
          templateUrl: './signup-form.html',
          styleUrl: './signup-form.scss',
        },
        add: {
          template: '<div>SignupForm Component Mock Template</div>',
          styles: [],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SignupForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
