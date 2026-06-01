import {
  Component,
  AfterViewInit,
  OnDestroy,
  input,
  ElementRef,
  viewChild,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map-view.html',
  styleUrl: './map-view.scss',
})
export class MapViewComponent implements AfterViewInit, OnDestroy {
  /** Latitude of the pinned location */
  latitude = input.required<number>();
  /** Longitude of the pinned location */
  longitude = input.required<number>();
  /** Display name for the location */
  locationName = input<string>('');
  /** Map height in pixels */
  height = input<number>(180);
  /** Zoom level */
  zoom = input<number>(15);

  private map!: L.Map;
  readonly mapContainer = viewChild.required<ElementRef>('mapContainer');

  /** Google Maps directions URL (uses current location as origin) */
  directionsUrl = computed(() => {
    const lat = this.latitude();
    const lng = this.longitude();
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  });

  constructor() {
    // Fix Leaflet's default icon path issue
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
    const lat = this.latitude();
    const lng = this.longitude();

    this.map = L.map(el, {
      center: [lat, lng],
      zoom: this.zoom(),
      dragging: true,
      scrollWheelZoom: false,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(this.map);

    const marker = L.marker([lat, lng]).addTo(this.map);
    if (this.locationName()) {
      marker.bindPopup(`<strong>${this.locationName()}</strong>`).openPopup();
    }
  }

  /** Call to fix rendering when container becomes visible */
  refreshMap(): void {
    setTimeout(() => this.map?.invalidateSize(), 200);
  }
}
