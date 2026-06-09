import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Interface representing an RSVP event for the picker component
 */
export interface RsvpPickerEvent {
  id: number;
  title: string;
  date: string | null;
  location?: string;
  status: 'active' | 'closed' | 'draft';
}

/**
 * Unified RSVP Event Picker Modal Component
 *
 * Provides a single consistent UI for selecting RSVP events,
 * replacing the Dashboard dropdown and Operations carousel.
 */
@Component({
  selector: 'app-rsvp-picker',
  imports: [CommonModule],
  templateUrl: './rsvp-picker-modal.html',
  styleUrl: './rsvp-picker-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class RsvpPickerComponent {
  // Inputs
  readonly events = input<RsvpPickerEvent[]>([]);
  readonly selectedId = input<number | null>(null);
  readonly loading = input(false);

  // Outputs
  readonly eventSelected = output<number>();

  // Internal state
  readonly searchQuery = signal('');
  readonly isOpen = signal(false);
  readonly statusFilter = signal<'all' | 'active' | 'closed' | 'draft'>('all');

  // Computed
  readonly filteredEvents = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.statusFilter();
    let filtered = this.events();

    if (query || status !== 'all') {
      filtered = filtered.filter(event => {
        const matchesSearch = !query ||
          event.title.toLowerCase().includes(query);
        const matchesStatus = status === 'all' ||
          event.status === status;
        return matchesSearch && matchesStatus;
      });
    }

    return filtered;
  });

  readonly selectedEvent = computed(() => {
    const id = this.selectedId();
    if (id === null) return null;
    return this.events().find(e => e.id === id) || null;
  });

  // Keyboard support
  onEscape(): void {
    if (this.isOpen()) this.closeModal();
  }

  // Public methods
  openModal(): void {
    this.isOpen.set(true);
  }

  closeModal(): void {
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.statusFilter.set('all');
  }

  selectEvent(eventId: number): void {
    this.eventSelected.emit(eventId);
    this.closeModal();
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  truncateLocation(location: string | undefined, maxLength = 35): string {
    if (!location) return '';
    return location.length > maxLength
      ? location.substring(0, maxLength) + '...'
      : location;
  }
}
