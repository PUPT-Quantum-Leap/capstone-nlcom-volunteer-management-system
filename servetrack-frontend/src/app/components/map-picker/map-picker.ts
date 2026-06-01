import {
  Component,
  AfterViewInit,
  OnDestroy,
  input,
  output,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';

export interface MapLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type: string;
}

@Component({
  selector: 'app-map-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-picker.html',
  styleUrl: './map-picker.scss',
})
export class MapPickerComponent implements AfterViewInit, OnDestroy {
  /** Initial latitude (defaults to Manila, PH) */
  initialLat = input<number>(14.5995);
  /** Initial longitude */
  initialLng = input<number>(120.9842);
  /** Initial zoom level */
  initialZoom = input<number>(13);

  /** Emits when a location is selected */
  locationSelected = output<MapLocation>();

  private map!: L.Map;
  private marker: L.Marker | null = null;

  readonly mapContainer = viewChild.required<ElementRef>('mapContainer');
  readonly searchQuery = signal('');
  readonly isSearching = signal(false);
  readonly searchResults = signal<NominatimResult[]>([]);
  readonly selectedAddress = signal('');

  constructor() {
    // Fix Leaflet's default icon path issue with bundlers
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    const el = this.mapContainer().nativeElement;

    this.map = L.map(el, {
      center: [this.initialLat(), this.initialLng()],
      zoom: this.initialZoom(),
    });

    // OpenStreetMap tiles (free, no API key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    // Click to place marker
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.setMarker(e.latlng.lat, e.latlng.lng);
      this.reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    // If custom initial coords are provided (editing existing location), place marker
    if (this.initialLat() !== 14.5995 || this.initialLng() !== 120.9842) {
      this.setMarker(this.initialLat(), this.initialLng());
      this.reverseGeocode(this.initialLat(), this.initialLng());
    }
  }

  private setMarker(lat: number, lng: number): void {
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);

      // Drag to reposition
      this.marker.on('dragend', () => {
        const pos = this.marker!.getLatLng();
        this.reverseGeocode(pos.lat, pos.lng);
      });
    }
  }

  /** Search for a place using Nominatim (free geocoding) */
  async searchPlace(): Promise<void> {
    const query = this.searchQuery().trim();
    if (!query) return;

    this.isSearching.set(true);
    this.searchResults.set([]);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=ph`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ServeTrack/1.0' },
      });
      const results: NominatimResult[] = await response.json();
      this.searchResults.set(results);
    } catch (err) {
      console.error('Geocoding search failed:', err);
    } finally {
      this.isSearching.set(false);
    }
  }

  /** Select a search result */
  selectResult(result: NominatimResult): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    this.map.setView([lat, lng], 16);
    this.setMarker(lat, lng);
    this.selectedAddress.set(result.display_name);
    this.searchResults.set([]);
    this.searchQuery.set('');

    this.locationSelected.emit({
      latitude: lat,
      longitude: lng,
      address: result.display_name,
    });
  }

  /** Reverse geocode lat/lng to get address */
  private async reverseGeocode(lat: number, lng: number): Promise<void> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ServeTrack/1.0' },
      });
      const data = await response.json();
      const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      this.selectedAddress.set(address);

      this.locationSelected.emit({ latitude: lat, longitude: lng, address });
    } catch {
      this.selectedAddress.set(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      this.locationSelected.emit({
        latitude: lat,
        longitude: lng,
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
    }
  }

  /** Called from parent to set coords programmatically (e.g., when editing) */
  setLocation(lat: number, lng: number): void {
    this.map.setView([lat, lng], 16);
    this.setMarker(lat, lng);
    this.reverseGeocode(lat, lng);
  }

  /** Invalidate map size (call after modal opens to fix rendering) */
  refreshMap(): void {
    setTimeout(() => this.map?.invalidateSize(), 200);
  }
}
