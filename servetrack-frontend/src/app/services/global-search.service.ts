import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GlobalSearchService {
  private searchQuerySignal = signal('');

  readonly searchQuery = this.searchQuerySignal.asReadonly();

  setSearchQuery(query: string): void {
    this.searchQuerySignal.set(query);
  }

  clearSearchQuery(): void {
    this.searchQuerySignal.set('');
  }
}
