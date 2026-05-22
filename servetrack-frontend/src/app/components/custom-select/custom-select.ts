import {
  Component,
  input,
  output,
  signal,
  computed,
  ElementRef,
  inject,
  ChangeDetectionStrategy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  label: string;
  value: any;
  icon?: string;
}

@Component({
  selector: 'app-custom-select',
  imports: [CommonModule],
  templateUrl: './custom-select.html',
  styleUrl: './custom-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onClickOutside($event)'
  }
})
export class CustomSelect {
  private elementRef = inject(ElementRef);

  options = input.required<SelectOption[]>();
  value = input<any>();
  placeholder = input<string>('Select an option');
  variant = input<'admin' | 'volunteer' | 'default'>('default');
  status = input<'present' | 'absent' | string | null>(null);
  
  valueChange = output<any>();

  isOpen = signal(false);

  selectedOption = computed(() => 
    this.options().find(opt => opt.value === this.value())
  );

  toggleDropdown(): void {
    this.isOpen.update(v => !v);
  }

  selectOption(option: SelectOption): void {
    this.valueChange.emit(option.value);
    this.isOpen.set(false);
  }

  onClickOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
