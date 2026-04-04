import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DistanceService, RouteCoordinates, GeocodeResult } from '../services/distance.service';

// Import Leaflet CSS globally for the map to render
import 'leaflet/dist/leaflet.css';

// Lazy import leaflet to avoid SSR issues
let L: any;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="map-container" *ngIf="isBrowser">
      <!-- Map Header -->
      <div class="map-header">
        <h3 class="map-title">Select Route on Map</h3>
        <div class="map-instructions">
          <p class="instruction-text">
            Use the buttons below to choose which point you want to set, then click on the map.
          </p>
          <p class="instruction-text">
            <strong>Tip:</strong> Click "Set Origin" and then click a location on the map to place Point A. Switch to "Set Destination" and click to place Point B.
          </p>
        </div>
      </div>

      <!-- Map Container -->
      <div id="map" class="map"></div>

      <!-- Overlay selection controls (fixed on top of map) -->
      <div class="overlay-controls" aria-hidden="false">
        <!-- Search inputs for Point A and B -->
        <div class="search-inputs">
          <input
            type="text"
            placeholder="Search Origin..."
            [(ngModel)]="searchOrigin"
            (input)="onOriginSearch($event)"
            class="search-input"
            title="Type location name or address for Point A"
          />
          <ul *ngIf="showOriginResults" class="search-results">
            <li *ngFor="let result of originSearchResults" (click)="selectOrigin(result)" class="search-result-item">
              <strong>{{ result.name }}</strong>
              <small *ngIf="result.address">{{ result.address }}</small>
            </li>
          </ul>
        </div>

        <div class="search-inputs">
          <input
            type="text"
            placeholder="Search Destination..."
            [(ngModel)]="searchDestination"
            (input)="onDestinationSearch($event)"
            class="search-input"
            title="Type location name or address for Point B"
          />
          <ul *ngIf="showDestinationResults" class="search-results">
            <li *ngFor="let result of destinationSearchResults" (click)="selectDestination(result)" class="search-result-item">
              <strong>{{ result.name }}</strong>
              <small *ngIf="result.address">{{ result.address }}</small>
            </li>
          </ul>
        </div>

        <!-- Manual selection buttons -->
        <div class="button-group">
          <button
            (click)="setSelectionMode('origin')"
            [class.btn-primary]="selectionMode === 'origin'"
            [class.btn-secondary]="selectionMode !== 'origin'"
            class="btn btn-small"
            title="Click this, then click on the map to set Origin"
          >
            Click Origin
          </button>

          <button
            (click)="setSelectionMode('destination')"
            [class.btn-primary]="selectionMode === 'destination'"
            [class.btn-secondary]="selectionMode !== 'destination'"
            class="btn btn-small"
            title="Click this, then click on the map to set Destination"
          >
            Click Dest
          </button>

          <button
            (click)="setSelectionMode(null)"
            class="btn btn-secondary btn-small"
            title="Exit selection mode"
          >
            Exit
          </button>
        </div>
      </div>

      <!-- Route Info -->
      <div *ngIf="distanceService.pointA() || distanceService.pointB()" class="route-info">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Point A</span>
            <span class="info-value" *ngIf="distanceService.pointA()">
              {{ distanceService.pointA()!.lat.toFixed(4) }}, {{ distanceService.pointA()!.lng.toFixed(4) }}
            </span>
            <span class="info-value empty" *ngIf="!distanceService.pointA()">Not selected</span>
          </div>
          <div class="info-item">
            <span class="info-label">Point B</span>
            <span class="info-value" *ngIf="distanceService.pointB()">
              {{ distanceService.pointB()!.lat.toFixed(4) }}, {{ distanceService.pointB()!.lng.toFixed(4) }}
            </span>
            <span class="info-value empty" *ngIf="!distanceService.pointB()">Not selected</span>
          </div>
          <div class="info-item">
            <span class="info-label">Distance</span>
            <span class="info-value">{{ distanceService.calculatedDistance() | number:'1.2-2' }} km</span>
          </div>
          <div class="info-item">
            <label class="round-trip-label">
              <input 
                type="checkbox" 
                [checked]="distanceService.isRoundTrip()"
                (change)="distanceService.toggleRoundTrip()"
                class="round-trip-checkbox"
              />
              <span class="round-trip-text">Round Trip (×2)</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Controls (calculate/reset) -->
      <div class="map-controls">
        <div style="display:flex; gap:0.5rem; width:320px">
          <button 
            (click)="calculateRoute()"
            [disabled]="!canCalculate()"
            class="btn btn-primary"
            [class.btn-disabled]="!canCalculate()"
          >
            {{ distanceService.isLoading() ? 'Calculating...' : 'Calculate Route' }}
          </button>
          <button 
            (click)="resetRoute()"
            class="btn btn-secondary"
          >
            Reset
          </button>
        </div>
      </div>

      <!-- Error Message -->
      <div *ngIf="distanceService.errorMessage()" class="error-message">
        <span class="error-icon">⚠</span>
        {{ distanceService.errorMessage() }}
      </div>
    </div>
    <div *ngIf="!isBrowser" class="map-container">
      <p class="text-center text-gray-500 py-8">Map is only available in browser mode</p>
    </div>
  `,
  styles: [`
    .map-container {
      display: flex;
      flex-direction: column;
      position: relative;
      height: 100%;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      background: white;
    }

    .map-header {
      padding: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .map-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .map-instructions {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
    }

    .instruction-text {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .step {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      font-size: 0.75rem;
      font-weight: 600;
    }

    #map {
      flex: 1;
      min-height: 400px;
      background: #f0f0f0;
    }

    .route-info {
      padding: 1rem;
      background: #f8f9fa;
      border-top: 1px solid #e0e0e0;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      padding: 0.75rem;
      background: white;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .info-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.25rem;
    }

    .info-value {
      font-size: 0.875rem;
      font-weight: 500;
      color: #333;
      font-family: 'Courier New', monospace;
    }

    .info-value.empty {
      color: #999;
      font-style: italic;
    }

    .round-trip-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      user-select: none;
    }

    .round-trip-checkbox {
      width: 1.1rem;
      height: 1.1rem;
      cursor: pointer;
      accent-color: #667eea;
    }

    .round-trip-text {
      font-weight: 500;
      color: #333;
    }

    .map-controls {
      display: flex;
      gap: 0.75rem;
      padding: 1rem;
      background: white;
      border-top: 1px solid #e0e0e0;
    }

    /* Overlay controls placed on top-left of the map */
    .overlay-controls {
      position: absolute;
      top: 1rem;
      left: 1rem;
      z-index: 1100;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background: rgba(255,255,255,0.95);
      padding: 0.75rem;
      border-radius: 8px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.12);
      max-width: 400px;
    }

    .search-inputs {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .search-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.875rem;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
    }

    .search-results {
      list-style: none;
      margin: 0;
      padding: 0.25rem 0;
      background: white;
      border: 1px solid #ddd;
      border-top: none;
      border-radius: 0 0 4px 4px;
      max-height: 200px;
      overflow-y: auto;
    }

    .search-result-item {
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      transition: background-color 0.15s;
      border-bottom: 1px solid #f0f0f0;
    }

    .search-result-item:hover {
      background-color: #f0f0f0;
    }

    .search-result-item strong {
      display: block;
      font-size: 0.875rem;
      color: #333;
    }

    .search-result-item small {
      display: block;
      font-size: 0.75rem;
      color: #666;
      margin-top: 0.125rem;
    }

    .button-group {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
    }

    .btn-small {
      flex: 1;
      min-width: 80px;
      padding: 0.5rem 0.75rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .btn {
      flex: 1;
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.3s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(.btn-disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: #e0e0e0;
      color: #333;
    }

    .btn-secondary:hover {
      background: #d0d0d0;
    }

    .btn-disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    .error-message {
      padding: 0.75rem 1rem;
      background: #fee;
      color: #c00;
      border-top: 1px solid #fcc;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }

    .error-icon {
      font-size: 1.25rem;
    }
  `]
})
export class MapComponent implements OnInit, OnDestroy {
  private map!: any;
  private pointAMarker: any | null = null;
  private pointBMarker: any | null = null;
  private routePath: any | null = null;
  private searchTimeout: any;

  // Selection mode and search properties
  selectionMode: 'origin' | 'destination' | null = null;
  isBrowser: boolean;

  // Search input properties
  searchOrigin = '';
  searchDestination = '';
  originSearchResults: GeocodeResult[] = [];
  destinationSearchResults: GeocodeResult[] = [];
  showOriginResults = false;
  showDestinationResults = false;

  constructor(
    public distanceService: DistanceService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.initializeMap();
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser && this.map) {
      this.map.remove();
    }
  }

  private async initializeMap(): Promise<void> {
    // Dynamically import leaflet to avoid SSR issues
    if (!L) {
      L = await import('leaflet');
    }

    // Create map centered on India
    this.map = L.map('map').setView([20.5937, 78.9629], 5);

    // Add OSM tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      minZoom: 3
    }).addTo(this.map);

    // Add map click handler
    this.map.on('click', (event: any) => {
      this.onMapClick(event.latlng);
    });

    // Add custom cursor feedback
    this.map.getContainer().style.cursor = 'crosshair';
  }

  private onMapClick(latlng: any): void {
    // Only respond when a selection mode is active
    if (!this.selectionMode) return;

    if (this.selectionMode === 'origin') {
      this.distanceService.setPointA({ lat: latlng.lat, lng: latlng.lng });
      this.updatePointAMarker(latlng);
    } else if (this.selectionMode === 'destination') {
      this.distanceService.setPointB({ lat: latlng.lat, lng: latlng.lng });
      this.updatePointBMarker(latlng);
    }

    // If both points are set, draw the route
    if (this.distanceService.pointA() && this.distanceService.pointB()) {
      this.drawRoute();
    }
  }

  setSelectionMode(mode: 'origin' | 'destination' | null): void {
    this.selectionMode = mode;
    // Visual feedback via cursor: still crosshair, but could be extended
    if (this.map && this.map.getContainer) {
      this.map.getContainer().style.cursor = mode ? 'crosshair' : 'default';
    }
  }

  private updatePointAMarker(latlng: any): void {
    if (this.pointAMarker) {
      this.pointAMarker.setLatLng(latlng);
    } else {
      this.pointAMarker = L.marker(latlng, {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(this.map).bindPopup('<b>Point A (Origin)</b>');
    }
  }

  private updatePointBMarker(latlng: any): void {
    if (this.pointBMarker) {
      this.pointBMarker.setLatLng(latlng);
    } else {
      this.pointBMarker = L.marker(latlng, {
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      }).addTo(this.map).bindPopup('<b>Point B (Destination)</b>');
    }
  }

  private drawRoute(): void {
    const pointA = this.distanceService.pointA();
    const pointB = this.distanceService.pointB();

    if (!pointA || !pointB) return;

    // Remove existing route if any
    if (this.routePath) {
      this.map.removeLayer(this.routePath);
    }

    // Draw a simple line between the two points
    this.routePath = L.polyline([
      [pointA.lat, pointA.lng],
      [pointB.lat, pointB.lng]
    ], {
      color: '#667eea',
      weight: 3,
      opacity: 0.7,
      dashArray: '5, 5'
    }).addTo(this.map);

    // Fit map to route
    this.map.fitBounds(this.routePath.getBounds(), { padding: [50, 50] });
  }

  canCalculate(): boolean {
    return this.distanceService.pointA() !== null && 
           this.distanceService.pointB() !== null &&
           !this.distanceService.isLoading();
  }

  calculateRoute(): void {
    this.distanceService.calculateDistance().subscribe({
      next: (result) => {
        const processed = this.distanceService.processDistanceResult(result);
        console.log('Route calculated:', processed);
      },
      error: (error) => {
        console.error('Error calculating route:', error);
      }
    });
  }

  resetRoute(): void {
    this.distanceService.resetDistance();
    
    // Reset markers
    if (this.pointAMarker) {
      this.map.removeLayer(this.pointAMarker);
      this.pointAMarker = null;
    }
    if (this.pointBMarker) {
      this.map.removeLayer(this.pointBMarker);
      this.pointBMarker = null;
    }
    if (this.routePath) {
      this.map.removeLayer(this.routePath);
      this.routePath = null;
    }
    
    this.selectionMode = null;
  }

  /**
   * Handle origin location search with debounce
   */
  onOriginSearch(event: Event): void {
    clearTimeout(this.searchTimeout);
    const query = (event.target as HTMLInputElement).value;
    
    if (query.length < 2) {
      this.showOriginResults = false;
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.distanceService.searchLocations(query).subscribe({
        next: (results: any) => {
          this.originSearchResults = results.features.map((feature: any) => ({
            name: feature.properties.name,
            address: feature.properties.label,
            coordinates: {
              lat: feature.geometry.coordinates[1],
              lng: feature.geometry.coordinates[0]
            }
          }));
          this.showOriginResults = this.originSearchResults.length > 0;
        },
        error: (err) => {
          console.error('Origin search error:', err);
          this.showOriginResults = false;
        }
      });
    }, 300);
  }

  /**
   * Handle destination location search with debounce
   */
  onDestinationSearch(event: Event): void {
    clearTimeout(this.searchTimeout);
    const query = (event.target as HTMLInputElement).value;
    
    if (query.length < 2) {
      this.showDestinationResults = false;
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.distanceService.searchLocations(query).subscribe({
        next: (results: any) => {
          this.destinationSearchResults = results.features.map((feature: any) => ({
            name: feature.properties.name,
            address: feature.properties.label,
            coordinates: {
              lat: feature.geometry.coordinates[1],
              lng: feature.geometry.coordinates[0]
            }
          }));
          this.showDestinationResults = this.destinationSearchResults.length > 0;
        },
        error: (err) => {
          console.error('Destination search error:', err);
          this.showDestinationResults = false;
        }
      });
    }, 300);
  }

  /**
   * Select origin from search results
   */
  selectOrigin(result: GeocodeResult): void {
    this.distanceService.setPointA(result.coordinates);
    this.updatePointAMarker({ lat: result.coordinates.lat, lng: result.coordinates.lng });
    this.searchOrigin = result.name;
    this.showOriginResults = false;
    
    // If both points set, draw route
    if (this.distanceService.pointA() && this.distanceService.pointB()) {
      this.drawRoute();
    }
  }

  /**
   * Select destination from search results
   */
  selectDestination(result: GeocodeResult): void {
    this.distanceService.setPointB(result.coordinates);
    this.updatePointBMarker({ lat: result.coordinates.lat, lng: result.coordinates.lng });
    this.searchDestination = result.name;
    this.showDestinationResults = false;
    
    // If both points set, draw route
    if (this.distanceService.pointA() && this.distanceService.pointB()) {
      this.drawRoute();
    }
  }
}
