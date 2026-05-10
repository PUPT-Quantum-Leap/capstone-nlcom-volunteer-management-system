import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  HostListener,
  ElementRef,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  label: string;
  value: any;
  icon?: string;
}

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './custom-select.html',
  styleUrl: './custom-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomSelect {
  private elementRef = inject(ElementRef);

  @Input({ required: true }) options: SelectOption[] = [];
  @Input() value: any;
  @Input() placeholder = 'Select an option';
  @Input() variant: 'admin' | 'volunteer' | 'default' = 'default';
  @Input() status: 'present' | 'absent' | string | null = null;
  
  @Output() valueChange = new EventEmitter<any>();

  isOpen = signal(false);

  selectedOption = computed(() => 
    this.options.find(opt => opt.value === this.value)
  );

  toggleDropdown(): void {
    this.isOpen.update(v => !v);
  }

  selectOption(option: SelectOption): void {
    this.value = option.value;
    this.valueChange.emit(option.value);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
