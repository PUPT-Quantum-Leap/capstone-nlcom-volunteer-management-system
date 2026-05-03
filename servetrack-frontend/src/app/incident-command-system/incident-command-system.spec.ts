import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IncidentCommandSystemComponent } from './incident-command-system';

describe('IncidentCommandSystemComponent', () => {
  let component: IncidentCommandSystemComponent;
  let fixture: ComponentFixture<IncidentCommandSystemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncidentCommandSystemComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentCommandSystemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('MOBILE KITCHEN OPERATIONS');
  });

  it('should render 3 operational columns', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.op-column').length).toBe(3);
  });
});
