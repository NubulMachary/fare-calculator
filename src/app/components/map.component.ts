import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DistanceService, RouteCoordinates, GeocodeResult } from '../services/distance.service';

// Import Leaflet CSS globally for the map to render
import 'leaflet/dist/leaflet.css';
import { finalize } from 'rxjs';

// Lazy import leaflet to avoid SSR issues
let L: any;

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="map-container" *ngIf="isBrowser && mapVisible">
    
      <!-- Controls and info above the map -->
      <div class="controls-top">
        <div class="search-row p-2">
          <div class="search-inputs">
            <input
              type="text"
              #originInput
              placeholder="Search Origin"
              [(ngModel)]="searchOrigin"
              (input)="onOriginSearch($event)"
              class="search-input"
              title="Type location name or address for Point A"
            />
            <ul *ngIf="showOriginResults" class="search-results">
              <li *ngIf="originLoading" class="search-result-item">Searching...</li>
              <li *ngIf="!originLoading && originSearchResults.length === 0" class="search-result-item">No results found</li>
              <li *ngFor="let result of originSearchResults" (click)="selectOrigin(result)" class="search-result-item">
                <strong>{{ result.name }}</strong>
                <small *ngIf="result.address">{{ result.address }}</small>
              </li>
            </ul>
          </div>

          <div class="search-inputs">
            <input
              type="text"
              #destinationInput
              placeholder="Search Destination"
              [(ngModel)]="searchDestination"
              (input)="onDestinationSearch($event)"
              class="search-input"
              title="Type location name or address for Point B"
            />
            <ul *ngIf="showDestinationResults" class="search-results">
              <li *ngIf="destinationLoading" class="search-result-item">Searching...</li>
              <li *ngIf="!destinationLoading && destinationSearchResults.length === 0" class="search-result-item">No results found</li>
              <li *ngFor="let result of destinationSearchResults" (click)="selectDestination(result)" class="search-result-item">
                <strong>{{ result.name }}</strong>
                <small *ngIf="result.address">{{ result.address }}</small>
              </li>
            </ul>
          </div>
           <!-- Round-trip toggle -->
        <div class="round-trip-inline" style="margin-top:0.5rem">
          <label class="round-trip-label">
            <input
              type="checkbox"
              class="round-trip-checkbox"
              [checked]="distanceService.isRoundTrip()"
              (change)="distanceService.toggleRoundTrip()"
              title="Double the distance for a round trip"
            />
            <span class="round-trip-text">Round Trip(2x distance)</span>
          </label>
        </div>
        </div>

        <div class="from-to-row p-2" style="display: flex; flex-wrap: wrap;" *ngIf="distanceService.pointA() || distanceService.pointB()">
        <div style="width: 300px;"> 
                <div class="from-to-item">
                    <p class="label"><strong>From</strong>
                        <span class="value" *ngIf="distanceService.pointA()">{{ distanceService.pointA()!.lat.toFixed(4) }}, {{ distanceService.pointA()!.lng.toFixed(4) }}</span>
                    </p>
                    <p class="value empty" *ngIf="!distanceService.pointA()">Not selected</p>
                </div>
                <div class="from-to-item">
                    <p class="label"><strong>To</strong>
                        <span class="value" *ngIf="distanceService.pointB()">{{ distanceService.pointB()!.lat.toFixed(4) }}, {{ distanceService.pointB()!.lng.toFixed(4) }}</span>
                    </p>
                    <p class="value empty" *ngIf="!distanceService.pointB()">Not selected</p>
                </div>
        </div>
          <div class="from-to-item center">
            <p class="label"><strong>Distance:</strong>
            <span class="value distance-large">{{ distanceService.calculatedDistance() | number:'1.2-2' }} km</span>
            <span class="value distance-sub">{{ distanceService.baseDistance() ? (distanceService.baseDistance() | number:'1.2-2') + ' km one-way' : '' }}</span>
        </p>
          </div>
          
        </div>
        
      </div>

      <!-- Map Container -->
      <div id="map" class="map"></div>

      <!-- Controls removed for mobile: distance is calculated automatically when both points are set -->

      <!-- Error Message -->
      <div *ngIf="distanceService.errorMessage()" class="error-message">
        <span class="error-icon">⚠</span>
        {{ distanceService.errorMessage() }}
      </div>
    </div>
    <div *ngIf="!isBrowser || !mapVisible" class="map-container">
      <div class="p-8 text-center text-gray-600">
        <p class="mb-3">Map is not available while server rendering. The interactive map loads in the browser.</p>
        <button *ngIf="isBrowser && !mapVisible" (click)="loadMap()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg">Load interactive map</button>
      </div>
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

    .map-header.compact {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
    }

    .map-actions { display:flex; align-items:center; gap:0.5rem }

    .round-trip-inline { display:flex; gap:0.5rem; align-items:center; font-size:0.9rem }

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

    .overlay-controls {
      position: absolute;
      top: 0.75rem;
      left: 0.75rem;
      right: 0.75rem;
      z-index: 1100;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: auto;
    }

    .search-row { display:flex; gap:0.5rem; flex-direction:column }

    .search-inputs { position: relative }

    .search-input { width:100%; padding:0.6rem 0.75rem; border-radius:8px; border:1px solid rgba(0,0,0,0.12); }

    .search-results { position:absolute; left:0; right:0; top:110%; background:white; border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,0.12); max-height:240px; overflow:auto; z-index:1110; }

    .search-result-item { padding:0.5rem 0.75rem; border-bottom:1px solid #f0f0f0; cursor:pointer }

    .search-result-item small { display:block; color:#666; margin-top:0.25rem }

    .bottom-info {
      position: absolute;
      left: 0.5rem;
      right: 0.5rem;
      bottom: 0.75rem;
      z-index: 1100;
      background: rgba(255,255,255,0.96);
      padding: 0.5rem 0.75rem;
      border-radius: 10px;
      display: flex;
      gap: 0.75rem;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
    }

    .bottom-left, .bottom-right { display:flex; flex-direction:column; gap:0.25rem }
    .bottom-middle { text-align:center }
    .distance-large { font-weight:700; font-size:1.1rem }
    .distance-sub { font-size:0.75rem; color:#666 }

    /* Responsive: horizontal search on wider screens */
    @media(min-width: 700px) {
      .search-row { flex-direction:row }
      .overlay-controls { width: auto; left: 1rem; right: auto; max-width:900px }
      .bottom-info { left: auto; right: 1rem; width:360px; bottom:1rem; flex-direction:column; align-items:flex-end }
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
    // Separate timeouts for origin/destination to avoid cross-interference
    private originSearchTimeout: any;
    private destinationSearchTimeout: any;
    private readonly SEARCH_DEBOUNCE_MS = 1000; // 2 seconds debounce
    private lastOriginQuery = '';
    private lastDestinationQuery = '';

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
  // Loading flags to indicate debounce/waiting or in-flight requests
  originLoading = false;
  destinationLoading = false;
    // API key input for quick local setup (not persisted to repo)
    apiKeyInput = '';
  @ViewChild('originInput', { static: false }) originInput?: ElementRef<HTMLInputElement>;
  @ViewChild('destinationInput', { static: false }) destinationInput?: ElementRef<HTMLInputElement>;

  mapVisible = false; // controls client-side map rendering

  constructor(
    public distanceService: DistanceService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    // Only read API key in browser
    if (this.isBrowser) {
      this.apiKeyInput = (window as any).VITE_OPENROUTESERVICE_KEY || localStorage.getItem('OPENROUTESERVICE_API_KEY') || '';
    }
  }

  ngOnInit(): void {
    // If running in browser, show the map container and initialize map.
    // We keep the server-side render showing a fallback message.
    if (this.isBrowser) {
      this.mapVisible = true;
      // initialize after microtask to ensure DOM exists
      setTimeout(() => this.initializeMap(), 0);
    }
  }

  // Called from the fallback button to load the interactive map on demand
  loadMap(): void {
    if (!this.isBrowser) return;
    if (this.mapVisible && this.map) return;
    this.mapVisible = true;
    this.cdr.detectChanges();
    setTimeout(() => this.initializeMap(), 0);
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
        // For mobile simplified UX: clicks set nearest unset point when not using search
        if (!this.selectionMode) {
            // If neither point set, set origin; if origin set and destination not, set destination
            if (!this.distanceService.pointA()) {
                this.distanceService.setPointA({ lat: latlng.lat, lng: latlng.lng });
                this.updatePointAMarker(latlng);
            } else if (!this.distanceService.pointB()) {
                this.distanceService.setPointB({ lat: latlng.lat, lng: latlng.lng });
                this.updatePointBMarker(latlng);
            } else {
                // both set -> replace destination by default
                this.distanceService.setPointB({ lat: latlng.lat, lng: latlng.lng });
                this.updatePointBMarker(latlng);
            }
        } else {
            if (this.selectionMode === 'origin') {
                this.distanceService.setPointA({ lat: latlng.lat, lng: latlng.lng });
                this.updatePointAMarker(latlng);
            } else if (this.selectionMode === 'destination') {
                this.distanceService.setPointB({ lat: latlng.lat, lng: latlng.lng });
                this.updatePointBMarker(latlng);
            }
        }

        // If both points are set, draw the route and calculate distance automatically
        if (this.distanceService.pointA() && this.distanceService.pointB()) {
            this.drawRoute();
            this.triggerCalculateIfReady();
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
        clearTimeout(this.originSearchTimeout);
        const query = ((event.target as HTMLInputElement).value || '').trim();

        if (query.length < 2) {
          this.originLoading = false;
          this.showOriginResults = false;
          return;
        }

        // Avoid repeating the same query — if the query hasn't changed,
        // ensure the dropdown visibility reflects existing results and do not re-query.
        // Open dropdown and show loading while waiting for debounce/fetch
        this.originLoading = true;
        this.showOriginResults = true;
        this.cdr.detectChanges();

        if (query === this.lastOriginQuery) {
          // No need to re-query; reflect cached results and clear loading
          this.originLoading = false;
          this.showOriginResults = this.originSearchResults.length > 0;
          // ensure the input is focused so the dropdown is visible
          try { this.originInput?.nativeElement.focus(); } catch (e) { /* ignore */ }
          this.cdr.detectChanges();
          return;
        }

        this.originSearchTimeout = setTimeout(() => {
          this.lastOriginQuery = query;
          this.originLoading = true;
          this.distanceService.searchLocations(query).pipe(finalize(() => {
            this.originLoading = false;
            this.cdr.detectChanges();
          })).subscribe({
            next: (results: any) => {
              console.log('Origin search results:', results);
              this.originSearchResults = results.features.map((feature: any) => ({
                name: feature.properties.name,
                address: feature.properties.label,
                coordinates: {
                  lat: feature.geometry.coordinates[1],
                  lng: feature.geometry.coordinates[0]
                }
              }));
              this.showOriginResults = this.originSearchResults.length > 0;
              try { this.originInput?.nativeElement.focus(); } catch (e) { /* ignore */ }
              console.log('Processed origin search results:', this.originSearchResults);
            },
            error: (err) => {
              console.error('Origin search error:', err);
              this.showOriginResults = false;
            }
          });
        }, this.SEARCH_DEBOUNCE_MS);
    }

    /**
     * Handle destination location search with debounce
     */
    onDestinationSearch(event: Event): void {
        clearTimeout(this.destinationSearchTimeout);
        const query = ((event.target as HTMLInputElement).value || '').trim();

        if (query.length < 2) {
          this.destinationLoading = false;
          this.showDestinationResults = false;
          return;
        }

        // Avoid repeating the same query — if the query hasn't changed,
        // ensure the dropdown visibility reflects existing results and do not re-query.
        // Open dropdown and show loading while waiting for debounce/fetch
  this.destinationLoading = true;
  this.showDestinationResults = true;
  this.cdr.detectChanges();

        if (query === this.lastDestinationQuery) {
          this.destinationLoading = false;
          this.showDestinationResults = this.destinationSearchResults.length > 0;
          try { this.destinationInput?.nativeElement.focus(); } catch (e) { /* ignore */ }
          this.cdr.detectChanges();
          return;
        }

        this.destinationSearchTimeout = setTimeout(() => {
          this.lastDestinationQuery = query;
          this.destinationLoading = true;
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
              this.destinationLoading = false;
              this.showDestinationResults = this.destinationSearchResults.length > 0;
              try { this.destinationInput?.nativeElement.focus(); } catch (e) { /* ignore */ }
            },
            error: (err) => {
              console.error('Destination search error:', err);
              this.destinationLoading = false;
              this.showDestinationResults = false;
            }
          });
        }, this.SEARCH_DEBOUNCE_MS);
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
            this.triggerCalculateIfReady();
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
            this.triggerCalculateIfReady();
        }
    }

    // Trigger automatic distance calculation when both points are available
    private triggerCalculateIfReady(): void {
        if (!this.distanceService.pointA() || !this.distanceService.pointB()) return;

        this.distanceService.calculateDistance().subscribe({
            next: (res) => {
                const processed = this.distanceService.processDistanceResult(res);
                // Optionally we can emit or log the processed result
                console.log('Auto-calculated route:', processed);
            },
            error: (err) => {
                console.error('Error calculating route:', err);
            }
        });
    }

    // Save API key to localStorage and window for immediate use
    saveApiKey(): void {
        if (!this.apiKeyInput || this.apiKeyInput.trim().length === 0) return;
        localStorage.setItem('OPENROUTESERVICE_API_KEY', this.apiKeyInput.trim());
        (window as any).VITE_OPENROUTESERVICE_KEY = this.apiKeyInput.trim();
        console.log('OpenRouteService API key saved to localStorage');
    }

    // Clear API key from localStorage and window
    clearApiKey(): void {
        localStorage.removeItem('OPENROUTESERVICE_API_KEY');
        try { delete (window as any).VITE_OPENROUTESERVICE_KEY; } catch (e) { (window as any).VITE_OPENROUTESERVICE_KEY = undefined; }
        this.apiKeyInput = '';
        console.log('OpenRouteService API key cleared');
    }
}
