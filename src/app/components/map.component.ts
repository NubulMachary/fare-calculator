import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject, ElementRef, ViewChild, ChangeDetectorRef, Input, Output, EventEmitter, SimpleChanges, OnChanges, signal, AfterViewInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DistanceService, RouteCoordinates, GeocodeResult } from '../services/distance.service';

// Import Leaflet CSS globally for the map to render
import { finalize } from 'rxjs';

// Lazy import leaflet to avoid SSR issues
let L: any;

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="map-wrapper">

      <!-- ── Loading state ── -->
      <div *ngIf="!mapReady" class="map-loading">
        <span class="map-loading-spinner"></span>
        <p>Loading map…</p>
      </div>

      <!-- ── Top: search inputs + round-trip toggle ── -->
      <div class="search-panel" [class.ready]="mapReady">
        <div class="search-row">
          <!-- Origin -->
          <div class="search-field">
            <label class="search-label">📍 From</label>
            <div class="search-input-wrap">
              <input
                type="text"
                #originInput
                placeholder="Search origin…"
                [(ngModel)]="searchOrigin"
                (input)="onOriginSearch($event)"
                class="search-input"
              />
              <ul *ngIf="showOriginResults" class="search-results">
                <li *ngIf="originLoading" class="search-result-item loading">Searching…</li>
                <li *ngIf="!originLoading && originSearchResults.length === 0" class="search-result-item empty">No results</li>
                <li *ngFor="let result of originSearchResults" (click)="selectOrigin(result)" class="search-result-item">
                  <span class="result-name">{{ result.name }}</span>
                  <span *ngIf="result.address" class="result-addr">{{ result.address }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Destination -->
          <div class="search-field">
            <label class="search-label">🏁 To</label>
            <div class="search-input-wrap">
              <input
                type="text"
                #destinationInput
                placeholder="Search destination…"
                [(ngModel)]="searchDestination"
                (input)="onDestinationSearch($event)"
                class="search-input"
              />
              <ul *ngIf="showDestinationResults" class="search-results">
                <li *ngIf="destinationLoading" class="search-result-item loading">Searching…</li>
                <li *ngIf="!destinationLoading && destinationSearchResults.length === 0" class="search-result-item empty">No results</li>
                <li *ngFor="let result of destinationSearchResults" (click)="selectDestination(result)" class="search-result-item">
                  <span class="result-name">{{ result.name }}</span>
                  <span *ngIf="result.address" class="result-addr">{{ result.address }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Round-trip -->
          <div class="roundtrip-field">
            <label class="roundtrip-label">
              <input
                type="checkbox"
                [checked]="localIsRoundTrip()"
                (change)="toggleRoundTrip()"
              />
              <span>Round Trip <small>(2×)</small></span>
            </label>
          </div>
        </div>
      </div>

      <!-- ── Map canvas ── -->
      <div class="map-canvas-wrap">
        <div #mapContainer [id]="mapId" class="map-leaflet"></div>

        <!-- ── Info overlay — shown once both points are selected ── -->
        <div class="info-overlay" *ngIf="localPointA() && localPointB()">
          <div class="info-card">
            <div class="info-row">
              <div class="info-point origin">
                <span class="info-dot origin-dot">A</span>
                <div class="info-text">
                  <span class="info-label">From</span>
                  <span class="info-name">{{ searchOrigin || 'Point A' }}</span>
                  <span class="info-coords">{{ localPointA()!.lat.toFixed(4) }}, {{ localPointA()!.lng.toFixed(4) }}</span>
                </div>
              </div>
              <div class="info-divider">→</div>
              <div class="info-point dest">
                <span class="info-dot dest-dot">B</span>
                <div class="info-text">
                  <span class="info-label">To</span>
                  <span class="info-name">{{ searchDestination || 'Point B' }}</span>
                  <span class="info-coords">{{ localPointB()!.lat.toFixed(4) }}, {{ localPointB()!.lng.toFixed(4) }}</span>
                </div>
              </div>
              <div class="info-distance">
                <span class="dist-label">Distance</span>
                <span class="dist-value" *ngIf="localCalculatedDistance() > 0">
                  {{ localCalculatedDistance() | number:'1.1-1' }} km
                </span>
                <span class="dist-value calculating" *ngIf="localIsLoading()">Calculating…</span>
                <span class="dist-value pending" *ngIf="!localIsLoading() && localCalculatedDistance() === 0">—</span>
                <span class="dist-oneway" *ngIf="localBaseDistance() > 0 && localIsRoundTrip()">
                  {{ localBaseDistance() | number:'1.1-1' }} km one-way
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Hint shown before any point is selected -->
        <div class="map-hint" *ngIf="mapReady && !localPointA()">
          Click the map or search above to set your route
        </div>
      </div>

      <!-- ── Error ── -->
      <div *ngIf="localErrorMessage()" class="map-error">
        <span>⚠</span> {{ localErrorMessage() }}
      </div>
    </div>
  `,
    styles: [`

    /* ── Outer wrapper ── */
    .map-wrapper {
      display: flex;
      flex-direction: column;
      height: 580px;
      border-radius: 12px;
      overflow: hidden;
      background: #f7f8fa;
      font-family: inherit;
    }

    /* ── Loading overlay ── */
    .map-loading {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #888;
      gap: 0.75rem;
      font-size: 0.9rem;
    }
    .map-loading-spinner {
      width: 32px; height: 32px;
      border: 3px solid #e0e0e0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Search panel ── */
    .search-panel {
      padding: 0.65rem 0.75rem 0.5rem;
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
      opacity: 0.5;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    .search-panel.ready {
      opacity: 1;
      pointer-events: auto;
    }

    .search-row {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .search-field {
      flex: 1;
      min-width: 160px;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      position: relative;
    }

    .search-label {
      font-size: 0.72rem;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .search-input-wrap { position: relative; }

    .search-input {
      width: 100%;
      padding: 0.45rem 0.65rem;
      border: 1.5px solid #d1d5db;
      border-radius: 7px;
      font-size: 0.85rem;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
      background: #fff;
    }
    .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102,126,234,0.12);
    }

    .search-results {
      position: absolute;
      top: calc(100% + 3px);
      left: 0; right: 0;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      max-height: 220px;
      overflow-y: auto;
      z-index: 1200;
      list-style: none;
      margin: 0; padding: 0.25rem 0;
    }

    .search-result-item {
      padding: 0.45rem 0.75rem;
      cursor: pointer;
      border-bottom: 1px solid #f4f4f4;
      transition: background 0.15s;
    }
    .search-result-item:hover { background: #f0f4ff; }
    .search-result-item.loading,
    .search-result-item.empty { color: #999; font-style: italic; cursor: default; }
    .result-name { display: block; font-size: 0.85rem; font-weight: 500; color: #222; }
    .result-addr { display: block; font-size: 0.75rem; color: #777; margin-top: 2px; }

    /* Round-trip toggle */
    .roundtrip-field {
      flex-shrink: 0;
      align-self: flex-end;
      padding-bottom: 0.1rem;
    }
    .roundtrip-label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      cursor: pointer;
      user-select: none;
      font-size: 0.82rem;
      font-weight: 500;
      color: #444;
      white-space: nowrap;
    }
    .roundtrip-label input[type=checkbox] {
      width: 1rem; height: 1rem;
      accent-color: #667eea;
      cursor: pointer;
    }
    .roundtrip-label small { color: #888; }

    /* ── Map canvas wrapper ── */
    .map-canvas-wrap {
      flex: 1;
      position: relative;
      min-height: 0;
    }

    /* .map-leaflet — Leaflet container.
       Uses class (not #id) because Angular scoping breaks dynamic ID selectors. */
    .map-leaflet {
      position: absolute;
      inset: 0;
      background: #e8ecef;
    }

    /* ── Map hint ── */
    .map-hint {
      position: absolute;
      bottom: 2.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 900;
      background: rgba(255,255,255,0.88);
      padding: 0.35rem 0.9rem;
      border-radius: 20px;
      font-size: 0.78rem;
      color: #555;
      pointer-events: none;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    /* ── Info overlay — bottom of map ── */
    .info-overlay {
      position: absolute;
      bottom: 0;
      left: 0; right: 0;
      z-index: 1000;
      padding: 0 0.6rem 0.6rem;
    }

    .info-card {
      background: rgba(255, 255, 255, 0.97);
      border-radius: 10px;
      box-shadow: 0 -2px 16px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08);
      padding: 0.65rem 0.85rem;
      backdrop-filter: blur(4px);
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    /* Point A / B blocks */
    .info-point {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      min-width: 0;
    }

    .info-dot {
      width: 28px; height: 28px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
      color: #fff;
    }
    .origin-dot { background: #22c55e; }
    .dest-dot   { background: #ef4444; }

    .info-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
    }

    .info-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1;
    }

    .info-name {
      font-size: 0.82rem;
      font-weight: 600;
      color: #1a1a2e;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 160px;
    }

    .info-coords {
      font-size: 0.7rem;
      color: #888;
      font-family: 'Courier New', monospace;
    }

    .info-divider {
      font-size: 1.1rem;
      color: #aaa;
      flex-shrink: 0;
    }

    /* Distance block */
    .info-distance {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      flex-shrink: 0;
      min-width: 80px;
      text-align: right;
    }

    .dist-label {
      font-size: 0.65rem;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .dist-value {
      font-size: 1.1rem;
      font-weight: 700;
      color: #1a1a2e;
      line-height: 1.2;
    }
    .dist-value.calculating { font-size: 0.8rem; color: #888; font-style: italic; font-weight: 400; }
    .dist-value.pending { color: #ccc; }

    .dist-oneway {
      font-size: 0.7rem;
      color: #888;
    }

    /* ── Error bar ── */
    .map-error {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.85rem;
      background: #fff1f1;
      color: #c00;
      border-top: 1px solid #fcc;
      font-size: 0.82rem;
    }

  `]
})
export class MapComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @Input() stopIndex: number | null = null;
  @Input() mapState: { origin: any, destination: any, distance: number, isRoundTrip?: boolean, pointA?: { lat: number; lng: number } | null, pointB?: { lat: number; lng: number } | null } | null = null;
  @Output() mapStateChange = new EventEmitter<{ origin: any, destination: any, distance: number, isRoundTrip: boolean, pointA: { lat: number; lng: number } | null, pointB: { lat: number; lng: number } | null }>();

  // ── Per-instance isolated state (replaces shared DistanceService signals) ──
  localPointA = signal<{ lat: number; lng: number } | null>(null);
  localPointB = signal<{ lat: number; lng: number } | null>(null);
  localCalculatedDistance = signal<number>(0);
  localBaseDistance = signal<number>(0);
  localIsRoundTrip = signal<boolean>(true);
  localErrorMessage = signal<string>('');
  localIsLoading = signal<boolean>(false);

  /** Unique DOM id so multiple map instances don't clash on the same "map" element */
  readonly mapId: string;

  toggleRoundTrip(): void {
    const newVal = !this.localIsRoundTrip();
    this.localIsRoundTrip.set(newVal);
    const base = this.localBaseDistance();
    if (base > 0) {
      this.localCalculatedDistance.set(
        Math.round((newVal ? base * 2 : base) * 100) / 100
      );
      this.emitMapState();
    }
  }

  /** Returns the final (possibly 2×) distance for this instance */
  getFinalDistance(): number {
    return this.localCalculatedDistance();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mapState'] && this.mapState) {
      // Restore search text and distance when modal re-opens with saved state
      this.searchOrigin = this.mapState.origin || '';
      this.searchDestination = this.mapState.destination || '';
      // Restore round-trip flag first so base-distance derivation below is correct
      if (this.mapState.isRoundTrip !== undefined) {
        this.localIsRoundTrip.set(this.mapState.isRoundTrip);
      }
      if (this.mapState.distance > 0) {
        this.localCalculatedDistance.set(this.mapState.distance);
        // Back-derive base (one-way) using the restored round-trip flag
        this.localBaseDistance.set(
          this.localIsRoundTrip() ? this.mapState.distance / 2 : this.mapState.distance
        );
      }
      // Restore map coordinates so info panel reflects saved positions immediately
      if (this.mapState.pointA) this.localPointA.set(this.mapState.pointA);
      if (this.mapState.pointB) this.localPointB.set(this.mapState.pointB);
    }
  }
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
  /** True once Leaflet has successfully attached to the DOM container */
  mapReady = false;

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('originInput', { static: false }) originInput?: ElementRef<HTMLInputElement>;
  @ViewChild('destinationInput', { static: false }) destinationInput?: ElementRef<HTMLInputElement>;

  constructor(
    public distanceService: DistanceService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    // Each instance gets a unique map container id to avoid Leaflet id collisions
    this.mapId = 'map-' + Math.random().toString(36).slice(2, 9);
    // Only read API key in browser
    if (this.isBrowser) {
      this.apiKeyInput = (window as any).VITE_OPENROUTESERVICE_KEY || localStorage.getItem('OPENROUTESERVICE_API_KEY') || '';
    }
  }

  ngOnInit(): void {
    // Restore search text, distance, and coordinates from saved state when modal re-opens
    if (this.mapState) {
      this.searchOrigin = this.mapState.origin || '';
      this.searchDestination = this.mapState.destination || '';
      // Restore round-trip flag first so base-distance derivation below is correct
      if (this.mapState.isRoundTrip !== undefined) {
        this.localIsRoundTrip.set(this.mapState.isRoundTrip);
      }
      if (this.mapState.distance > 0) {
        this.localCalculatedDistance.set(this.mapState.distance);
        // Back-derive base (one-way) using the restored round-trip flag
        this.localBaseDistance.set(
          this.localIsRoundTrip() ? this.mapState.distance / 2 : this.mapState.distance
        );
      }
      // Restore coordinates so the info panel and markers reflect saved positions
      if (this.mapState.pointA) this.localPointA.set(this.mapState.pointA);
      if (this.mapState.pointB) this.localPointB.set(this.mapState.pointB);
    }
  }

  ngAfterViewInit(): void {
    console.log('[Map] ngAfterViewInit — isBrowser:', this.isBrowser, '| mapId:', this.mapId);
    if (!this.isBrowser) {
      console.log('[Map] Skipping init — not a browser environment (SSR)');
      return;
    }
    this.distanceService.ensureApiKeyReady();
    // Use rAF so the browser has painted the container at full size before Leaflet reads dimensions
    requestAnimationFrame(() => this.initializeMap());
  }

  // loadMap() kept for any future manual trigger but delegates to initializeMap
  loadMap(): void {
    if (!this.isBrowser || this.map) return;
    this.initializeMap();
  }

    ngOnDestroy(): void {
        if (this.isBrowser && this.map) {
            this.map.remove();
        }
    }

    private async initializeMap(): Promise<void> {
    console.log('[Map] initializeMap() start — container el:', this.mapContainer?.nativeElement);

    // ── 1. Inject Leaflet CSS ──────────────────────────────────────────────
    try {
      const href = 'https://unpkg.com/leaflet/dist/leaflet.css';
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
        console.log('[Map] Leaflet CSS injected');
      } else {
        console.log('[Map] Leaflet CSS already present');
      }
    } catch (e) {
      console.warn('[Map] Could not inject Leaflet CSS:', e);
    }

    // ── 2. Import Leaflet ──────────────────────────────────────────────────
    if (!L) {
      console.log('[Map] Importing Leaflet module…');
      try {
        const leafletMod = await import('leaflet');
        L = (leafletMod && (leafletMod as any).default) ? (leafletMod as any).default : leafletMod;
        console.log('[Map] Leaflet imported — L.map available:', !!(L && L.map));
      } catch (e) {
        console.error('[Map] Failed to import Leaflet:', e);
        this.localErrorMessage.set('Failed to load map library. Please refresh.');
        return;
      }
    } else {
      console.log('[Map] Leaflet already imported');
    }

    // ── 3. Reveal the container BEFORE Leaflet measures it ─────────────────
    // The loading overlay covers the map while mapReady=false.
    // Set mapReady=true first so Angular shows the search panel, then let the browser
    // paint before we call L.map().
    this.mapReady = true;
    this.cdr.detectChanges();
    console.log('[Map] Container revealed (mapReady=true) — size:', this.mapContainer.nativeElement.offsetWidth, '×', this.mapContainer.nativeElement.offsetHeight);

    // ── 4. Initialise Leaflet ──────────────────────────────────────────────
    try {
      this.map = L.map(this.mapContainer.nativeElement).setView([20.5937, 78.9629], 5);
      console.log('[Map] ✓ Leaflet map created successfully');
    } catch (err) {
      console.error('[Map] ✗ Failed to create Leaflet map:', err);
      this.localErrorMessage.set('Failed to load map. Please try again.');
      return;
    }

    // ── 5. Add OSM tile layer ──────────────────────────────────────────────
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
      minZoom: 3
    }).addTo(this.map);
    console.log('[Map] Tile layer added');

    // ── 6. Wire up click handler ───────────────────────────────────────────
    this.map.on('click', (event: any) => {
      this.onMapClick(event.latlng);
    });
    this.map.getContainer().style.cursor = 'crosshair';

    // ── 7. Force size recalc after paint ───────────────────────────────────
    // A second rAF ensures the container has its final CSS dimensions.
    requestAnimationFrame(() => {
      this.map.invalidateSize();
      console.log('[Map] invalidateSize() called — final size:', this.mapContainer.nativeElement.offsetWidth, '×', this.mapContainer.nativeElement.offsetHeight);
      // ── 8. Restore previously saved markers (if map was re-opened) ────────
      this.restoreMarkersOnMap();
    });
  }

  /** Re-place markers and route polyline when the map is re-opened with saved coordinates */
  private restoreMarkersOnMap(): void {
    const a = this.localPointA();
    const b = this.localPointB();
    if (!a && !b) return;

    if (a) this.updatePointAMarker({ lat: a.lat, lng: a.lng });
    if (b) this.updatePointBMarker({ lat: b.lat, lng: b.lng });

    if (a && b) {
      this.drawRoute();
      // Fit the map to the restored route
      if (this.routePath) {
        this.map.fitBounds(this.routePath.getBounds(), { padding: [50, 50] });
      }
    } else if (a) {
      this.map.setView([a.lat, a.lng], 10);
    } else if (b) {
      this.map.setView([b!.lat, b!.lng], 10);
    }
    console.log('[Map] Markers restored — A:', a, 'B:', b);
  }

    private onMapClick(latlng: any): void {
        // Only respond when a selection mode is active
        // For mobile simplified UX: clicks set nearest unset point when not using search
        if (!this.selectionMode) {
            // If neither point set, set origin; if origin set and destination not, set destination
            if (!this.localPointA()) {
                this.localPointA.set({ lat: latlng.lat, lng: latlng.lng });
                this.updatePointAMarker(latlng);
            } else if (!this.localPointB()) {
                this.localPointB.set({ lat: latlng.lat, lng: latlng.lng });
                this.updatePointBMarker(latlng);
            } else {
                // both set -> replace destination by default
                this.localPointB.set({ lat: latlng.lat, lng: latlng.lng });
                this.updatePointBMarker(latlng);
            }
        } else {
            if (this.selectionMode === 'origin') {
                this.localPointA.set({ lat: latlng.lat, lng: latlng.lng });
                this.updatePointAMarker(latlng);
            } else if (this.selectionMode === 'destination') {
                this.localPointB.set({ lat: latlng.lat, lng: latlng.lng });
                this.updatePointBMarker(latlng);
            }
        }

        // If both points are set, draw the route and calculate distance automatically
        if (this.localPointA() && this.localPointB()) {
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
                draggable: true,
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(this.map).bindPopup('<b>Point A (Origin)</b>');

            this.pointAMarker.on('dragend', (e: any) => {
                const pos = e.target.getLatLng();
                this.localPointA.set({ lat: pos.lat, lng: pos.lng });
                if (this.localPointA() && this.localPointB()) {
                    this.drawRoute();
                    this.triggerCalculateIfReady();
                }
            });
        }
    }

    private updatePointBMarker(latlng: any): void {
        if (this.pointBMarker) {
            this.pointBMarker.setLatLng(latlng);
        } else {
            this.pointBMarker = L.marker(latlng, {
                draggable: true,
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(this.map).bindPopup('<b>Point B (Destination)</b>');

            this.pointBMarker.on('dragend', (e: any) => {
                const pos = e.target.getLatLng();
                this.localPointB.set({ lat: pos.lat, lng: pos.lng });
                if (this.localPointA() && this.localPointB()) {
                    this.drawRoute();
                    this.triggerCalculateIfReady();
                }
            });
        }
    }

    private drawRoute(): void {
        const pointA = this.localPointA();
        const pointB = this.localPointB();

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
        return this.localPointA() !== null &&
            this.localPointB() !== null &&
            !this.localIsLoading();
    }

    calculateRoute(): void {
        const a = this.localPointA();
        const b = this.localPointB();
        if (!a || !b) return;
        this.distanceService.calculateDistanceFor(a, b).subscribe({
            next: (result) => {
                this.localBaseDistance.set(result.distanceKm);
                const displayed = this.localIsRoundTrip() ? result.distanceKm * 2 : result.distanceKm;
                this.localCalculatedDistance.set(Math.round(displayed * 100) / 100);
                this.localErrorMessage.set('');
                console.log('Route calculated:', result);
            },
            error: (error) => {
                this.localErrorMessage.set(error.message || 'Failed to calculate route');
                console.error('Error calculating route:', error);
            }
        });
    }

    resetRoute(): void {
        this.localPointA.set(null);
        this.localPointB.set(null);
        this.localCalculatedDistance.set(0);
        this.localBaseDistance.set(0);
        this.localErrorMessage.set('');

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
  // Persist the last search value
  if (this.isBrowser) localStorage.setItem('MAP_LAST_ORIGIN', query);

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
    // Persist the last search value
    if (this.isBrowser) localStorage.setItem('MAP_LAST_DEST', query);

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
          this.distanceService.searchLocations(query).pipe(finalize(() => {
            this.destinationLoading = false;
            this.cdr.detectChanges();
          })).subscribe({
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
              try { this.destinationInput?.nativeElement.focus(); } catch (e) { /* ignore */ }
            },
            error: (err) => {
              console.error('Destination search error:', err);
              this.showDestinationResults = false;
            }
          });
        }, this.SEARCH_DEBOUNCE_MS);
    }

    /**
     * Select origin from search results
     */
  selectOrigin(result: GeocodeResult): void {
    this.localPointA.set(result.coordinates);
    this.updatePointAMarker({ lat: result.coordinates.lat, lng: result.coordinates.lng });
    this.searchOrigin = result.name;
    this.showOriginResults = false;

    // If both points set, draw route and calculate
    if (this.localPointA() && this.localPointB()) {
      this.drawRoute();
      this.triggerCalculateIfReady();
    }
  }

    /**
     * Select destination from search results
     */
  selectDestination(result: GeocodeResult): void {
    this.localPointB.set(result.coordinates);
    this.updatePointBMarker({ lat: result.coordinates.lat, lng: result.coordinates.lng });
    this.searchDestination = result.name;
    this.showDestinationResults = false;

    // If both points set, draw route and calculate
    if (this.localPointA() && this.localPointB()) {
      this.drawRoute();
      this.triggerCalculateIfReady();
    }
  }
  emitMapState() {
    this.mapStateChange.emit({
      origin: this.searchOrigin,
      destination: this.searchDestination,
      distance: this.localCalculatedDistance(),
      isRoundTrip: this.localIsRoundTrip(),
      pointA: this.localPointA(),
      pointB: this.localPointB()
    });
  }

    // Trigger automatic distance calculation when both points are available
    private triggerCalculateIfReady(): void {
        const a = this.localPointA();
        const b = this.localPointB();
        if (!a || !b) return;

        this.localIsLoading.set(true);
        this.localErrorMessage.set('');
        this.distanceService.calculateDistanceFor(a, b).subscribe({
            next: (res) => {
                this.localBaseDistance.set(res.distanceKm);
                const displayed = this.localIsRoundTrip() ? res.distanceKm * 2 : res.distanceKm;
                this.localCalculatedDistance.set(Math.round(displayed * 100) / 100);
                this.localIsLoading.set(false);
                // Emit AFTER we have the final distance
                this.emitMapState();
                this.cdr.detectChanges();
                console.log('Auto-calculated route:', res);
            },
            error: (err) => {
                this.localErrorMessage.set(err.message || 'Failed to calculate route');
                this.localIsLoading.set(false);
                this.cdr.detectChanges();
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
