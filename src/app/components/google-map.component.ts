import {
  Component, OnInit, OnDestroy, OnChanges, AfterViewInit,
  PLATFORM_ID, Inject, ElementRef, ViewChild,
  ChangeDetectorRef, Input, Output, EventEmitter, SimpleChanges, signal
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface GoogleMapState {
  origin: string;
  destination: string;
  distance: number;          // final (possibly 2×) km
  isRoundTrip: boolean;
  pointA: { lat: number; lng: number } | null;
  pointB: { lat: number; lng: number } | null;
}

// Declare google as any to avoid needing @types/google.maps at compile time.
declare const google: any;

// Module-level singleton so the script loads once even with multiple instances.
let googleMapsLoaded = false;
let googleMapsLoading = false;
const googleMapsCallbacks: Array<() => void> = [];

// Unique callback name used as the ?callback= param so Google signals readiness.
const GMAPS_CALLBACK = '__gmapsReady__';

@Component({
  selector: 'app-google-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="gmap-wrapper">

    <!-- ── Loading state ── -->
    @if (!mapReady) {
    <div class="gmap-loading">
      <span class="gmap-spinner"></span>
      <p>Loading map…</p>
    </div>
    }

    <!-- ── Search panel ── -->
    <div class="gmap-search-panel" [class.ready]="mapReady">
      <div class="gmap-search-row">

        <!-- From -->
        <div class="gmap-search-field">
          <label class="gmap-label">📍 From</label>
          <div class="gmap-input-wrap">
            <input
              #originInputEl
              type="text"
              class="gmap-input gmap-input-with-btn"
              placeholder="Search origin…"
              [(ngModel)]="searchOrigin"
              (input)="onOriginInput($event)"
              (focus)="originFocused = true"
              (blur)="onOriginBlur()"
              autocomplete="off"
            />
            @if (searchOrigin) {
            <button
              type="button"
              class="gmap-clear-btn"
              (mousedown)="$event.preventDefault(); clearPoint('origin')"
              title="Clear origin"
            >✕</button>
            }
            <button
              type="button"
              class="gmap-locate-btn"
              [class.locating]="locatingOrigin"
              (click)="useCurrentLocation('origin')"
              title="Use my current location as origin"
            >
              @if (!locatingOrigin) { <span>⌖</span> }
              @if (locatingOrigin) { <span class="gmap-locate-spin"></span> }
            </button>
            @if (originFocused && originSuggestions.length > 0) {
            <ul class="gmap-suggestions">
              @if (originLoading) { <li class="gmap-suggestion loading">Searching…</li> }
              @for (s of originSuggestions; track s.placeId) {
              <li
                (mousedown)="selectOriginSuggestion(s)"
                class="gmap-suggestion"
              >
                <span class="sug-main">{{ s.mainText?.text || s.text?.text }}</span>
                @if (s.secondaryText?.text) {
                <span class="sug-sec">{{ s.secondaryText.text }}</span>
                }
              </li>
              }
            </ul>
            }
          </div>
        </div>

        <!-- To -->
        <div class="gmap-search-field">
          <label class="gmap-label">🏁 To</label>
          <div class="gmap-input-wrap">
            <input
              #destInputEl
              type="text"
              class="gmap-input gmap-input-with-btn"
              placeholder="Search destination…"
              [(ngModel)]="searchDestination"
              (input)="onDestInput($event)"
              (focus)="destFocused = true"
              (blur)="onDestBlur()"
              autocomplete="off"
            />
            @if (searchDestination) {
            <button
              type="button"
              class="gmap-clear-btn"
              (mousedown)="$event.preventDefault(); clearPoint('dest')"
              title="Clear destination"
            >✕</button>
            }
            <button
              type="button"
              class="gmap-locate-btn"
              [class.locating]="locatingDest"
              (click)="useCurrentLocation('dest')"
              title="Use my current location as destination"
            >
              @if (!locatingDest) { <span>⌖</span> }
              @if (locatingDest) { <span class="gmap-locate-spin"></span> }
            </button>
            @if (destFocused && destSuggestions.length > 0) {
            <ul class="gmap-suggestions">
              @if (destLoading) { <li class="gmap-suggestion loading">Searching…</li> }
              @for (s of destSuggestions; track s.placeId) {
              <li
                (mousedown)="selectDestSuggestion(s)"
                class="gmap-suggestion"
              >
                <span class="sug-main">{{ s.mainText?.text || s.text?.text }}</span>
                @if (s.secondaryText?.text) {
                <span class="sug-sec">{{ s.secondaryText.text }}</span>
                }
              </li>
              }
            </ul>
            }
          </div>
        </div>

        <!-- Round-trip -->
        <div class="gmap-roundtrip">
          <label class="gmap-roundtrip-label">
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
    <div class="gmap-canvas-wrap">
      <div #mapContainer class="gmap-canvas"></div>

      <!-- Info overlay — shown once both points are set -->
      @if (localPointA() && localPointB()) {
      <div class="gmap-info-overlay">
        <div class="gmap-info-card">
          <!-- Point A -->
          <div class="gmap-info-point">
            <span class="gmap-dot gmap-dot-a">A</span>
            <div class="gmap-info-text">
              <span class="gmap-info-label">From</span>
              <span class="gmap-info-name">{{ searchOrigin || 'Point A' }}</span>
              <span class="gmap-info-coords">{{ localPointA()!.lat.toFixed(4) }}, {{ localPointA()!.lng.toFixed(4) }}</span>
            </div>
          </div>
          <span class="gmap-info-arrow">→</span>
          <!-- Point B -->
          <div class="gmap-info-point">
            <span class="gmap-dot gmap-dot-b">B</span>
            <div class="gmap-info-text">
              <span class="gmap-info-label">To</span>
              <span class="gmap-info-name">{{ searchDestination || 'Point B' }}</span>
              <span class="gmap-info-coords">{{ localPointB()!.lat.toFixed(4) }}, {{ localPointB()!.lng.toFixed(4) }}</span>
            </div>
          </div>
          <!-- Distance -->
          <div class="gmap-info-dist">
            <span class="gmap-info-label">Distance</span>
            @if (localCalculatedDistance() > 0 && !localIsLoading()) {
            <span class="gmap-dist-value">{{ localCalculatedDistance() | number:'1.1-1' }} km</span>
            }
            @if (localIsLoading()) {
            <span class="gmap-dist-value calculating">Calculating…</span>
            }
            @if (!localIsLoading() && localCalculatedDistance() === 0) {
            <span class="gmap-dist-value pending">—</span>
            }
            @if (localBaseDistance() > 0 && localIsRoundTrip()) {
            <span class="gmap-dist-oneway">{{ localBaseDistance() | number:'1.1-1' }} km one-way</span>
            }
          </div>
        </div>
      </div>
      }

      <!-- Hint -->
      @if (mapReady && !localPointA()) {
      <div class="gmap-hint">
        Click the map or search above to set your route
      </div>
      }
    </div>

    <!-- Error -->
    @if (localErrorMessage()) {
    <div class="gmap-error">
      <span>⚠</span> {{ localErrorMessage() }}
    </div>
    }

  </div>
  `,
  styles: [`
    .gmap-wrapper {
      display: flex;
      flex-direction: column;
      height: 580px;
      border-radius: 12px;
      overflow: hidden;
      background: #f7f8fa;
      font-family: inherit;
    }

    /* Loading */
    .gmap-loading {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      color: #888;
      font-size: 0.9rem;
    }
    .gmap-spinner {
      width: 32px; height: 32px;
      border: 3px solid #e0e0e0;
      border-top-color: #4285f4;
      border-radius: 50%;
      animation: gspin 0.8s linear infinite;
    }
    @keyframes gspin { to { transform: rotate(360deg); } }

    /* Search panel */
    .gmap-search-panel {
      flex-shrink: 0;
      padding: 0.65rem 0.75rem 0.5rem;
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      opacity: 0.5;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    .gmap-search-panel.ready {
      opacity: 1;
      pointer-events: auto;
    }

    .gmap-search-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      align-items: flex-start;
    }

    .gmap-search-field {
      flex: 1 1 180px;   /* grow, but collapse to full-width below ~400 px */
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.22rem;
      position: relative;
    }

    /* ── Mobile: From / To each take full row width ── */
    @media (max-width: 480px) {
      .gmap-search-field {
        flex: 1 1 100%;   /* break onto its own line */
      }
    }

    .gmap-label {
      font-size: 0.72rem;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .gmap-input-wrap { position: relative; }

    .gmap-input {
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
    .gmap-input:focus {
      outline: none;
      border-color: #4285f4;
      box-shadow: 0 0 0 3px rgba(66,133,244,0.12);
    }
    .gmap-input-with-btn {
      padding-right: 4.2rem; /* room for both clear + locate buttons */
    }
    .gmap-clear-btn {
      position: absolute;
      right: 2.15rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.8rem;
      line-height: 1;
      padding: 0.2rem 0.25rem;
      color: #9aa0a6;
      opacity: 0.8;
      transition: opacity 0.15s, color 0.15s;
      z-index: 2;
    }
    .gmap-clear-btn:hover {
      opacity: 1;
      color: #ea4335;
    }
    .gmap-locate-btn {
      position: absolute;
      right: 0.45rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.35rem;
      line-height: 1;
      padding: 0.2rem;
      color: #5f6368;
      opacity: 0.65;
      transition: opacity 0.15s, color 0.15s;
      z-index: 2;
    }
    .gmap-locate-btn:hover {
      opacity: 1;
      color: #1a73e8;
    }
    .gmap-locate-btn.locating {
      cursor: default;
      opacity: 1;
    }
    @keyframes gspin {
      to { transform: rotate(360deg); }
    }
    .gmap-locate-spin {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 2px solid #ccc;
      border-top-color: #4285f4;
      border-radius: 50%;
      animation: gspin 0.7s linear infinite;
      vertical-align: middle;
    }

    .gmap-suggestions {
      position: absolute;
      top: calc(100% + 3px);
      left: 0; right: 0;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      max-height: 220px;
      overflow-y: auto;
      z-index: 1200;
      list-style: none;
      margin: 0; padding: 0.25rem 0;
    }

    .gmap-suggestion {
      padding: 0.45rem 0.75rem;
      cursor: pointer;
      border-bottom: 1px solid #f4f4f4;
      transition: background 0.15s;
    }
    .gmap-suggestion:hover { background: #f0f4ff; }
    .gmap-suggestion.loading { color: #999; font-style: italic; cursor: default; }
    .sug-main { display: block; font-size: 0.85rem; font-weight: 500; color: #222; }
    .sug-sec  { display: block; font-size: 0.75rem; color: #777; margin-top: 2px; }

    /* Round-trip */
    .gmap-roundtrip {
      flex-shrink: 0;
      align-self: flex-end;
      padding-bottom: 0.1rem;
    }

    @media (max-width: 480px) {
      .gmap-roundtrip {
        flex: 1 1 100%;           /* own row on mobile */
        align-self: auto;
        padding-bottom: 0;
        padding-top: 0.15rem;
      }
      .gmap-roundtrip-label {
        justify-content: flex-start;
      }
    }
    .gmap-roundtrip-label {
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
    .gmap-roundtrip-label input[type=checkbox] {
      width: 1rem; height: 1rem;
      accent-color: #4285f4;
      cursor: pointer;
    }
    .gmap-roundtrip-label small { color: #888; }

    /* Canvas */
    .gmap-canvas-wrap {
      flex: 1;
      position: relative;
      min-height: 0;
    }
    .gmap-canvas {
      position: absolute;
      inset: 0;
      background: #e8ecef;
    }

    /* Hint */
    .gmap-hint {
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

    /* Info overlay */
    .gmap-info-overlay {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      z-index: 1000;
      padding: 0 0.6rem 0.6rem;
    }
    .gmap-info-card {
      background: rgba(255,255,255,0.97);
      border-radius: 10px;
      box-shadow: 0 -2px 16px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08);
      padding: 0.65rem 0.85rem;
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .gmap-info-point {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex: 1;
      min-width: 0;
    }
    .gmap-dot {
      width: 26px; height: 26px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.72rem; font-weight: 700;
      color: #fff; flex-shrink: 0;
    }
    .gmap-dot-a { background: #34a853; }
    .gmap-dot-b { background: #ea4335; }
    .gmap-info-text {
      display: flex; flex-direction: column;
      min-width: 0; overflow: hidden;
    }
    .gmap-info-label {
      font-size: 0.62rem; font-weight: 700;
      color: #888; text-transform: uppercase;
      letter-spacing: 0.5px; line-height: 1;
    }
    .gmap-info-name {
      font-size: 0.82rem; font-weight: 600;
      color: #1a1a2e; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
      max-width: 150px;
    }
    .gmap-info-coords {
      font-size: 0.68rem; color: #999;
      font-family: 'Courier New', monospace;
    }
    .gmap-info-arrow { font-size: 1rem; color: #aaa; flex-shrink: 0; }
    .gmap-info-dist {
      display: flex; flex-direction: column;
      align-items: flex-end; flex-shrink: 0;
      min-width: 72px; text-align: right;
    }
    .gmap-dist-value {
      font-size: 1.05rem; font-weight: 700;
      color: #1a1a2e; line-height: 1.2;
    }
    .gmap-dist-value.calculating { font-size: 0.78rem; color: #888; font-style: italic; font-weight: 400; }
    .gmap-dist-value.pending { color: #ccc; }
    .gmap-dist-oneway { font-size: 0.68rem; color: #888; }

    /* Error */
    .gmap-error {
      flex-shrink: 0;
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.85rem;
      background: #fff1f1; color: #c00;
      border-top: 1px solid #fcc;
      font-size: 0.82rem;
    }
  `]
})
export class GoogleMapComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {

  // ── Inputs / Outputs (same contract as MapComponent) ────────────────────────
  @Input() stopIndex: number | null = null;
  @Input() mapState: {
    origin: any; destination: any; distance: number;
    isRoundTrip?: boolean;
    pointA?: { lat: number; lng: number } | null;
    pointB?: { lat: number; lng: number } | null;
  } | null = null;
  @Output() mapStateChange = new EventEmitter<GoogleMapState>();

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  // ── Per-instance signals ─────────────────────────────────────────────────────
  localPointA = signal<{ lat: number; lng: number } | null>(null);
  localPointB = signal<{ lat: number; lng: number } | null>(null);
  localCalculatedDistance = signal<number>(0);
  localBaseDistance = signal<number>(0);
  localIsRoundTrip = signal<boolean>(true);
  localErrorMessage = signal<string>('');
  localIsLoading = signal<boolean>(false);

  // ── Search UI state ──────────────────────────────────────────────────────────
  searchOrigin = '';
  searchDestination = '';
  originSuggestions: any[] = [];
  destSuggestions: any[] = [];
  originLoading = false;
  destLoading = false;
  originFocused = false;
  destFocused = false;
  // Current-location button loading flags
  locatingOrigin = false;
  locatingDest   = false;

  mapReady = false;
  isBrowser: boolean;

  // ── Private Leaflet/Google objects ───────────────────────────────────────────
  private gmap: any = null;
  private markerA: any = null;
  private markerB: any = null;
  private directionsRenderer: any = null;
  private directionsService: any = null;
  private geocoder: any = null; // google.maps.Geocoder — free reverse-geocoding via Maps JS SDK

  // New Places API library — loaded lazily on first search via importLibrary.
  private placesLibrary: any = null;

  // Session tokens — one per input field.
  // A token groups all autocomplete keystrokes + the final selection into a
  // single billable session, significantly reducing Places API costs.
  // Rules:
  //   • Create a NEW token when the user starts a fresh query (first keystroke
  //     after the previous session ended).
  //   • Pass the SAME token on every fetchAutocompleteSuggestions call while
  //     the user is still typing in that field.
  //   • Discard (set to null) immediately after calling toPlace() / Directions,
  //     so the next keystroke generates a fresh token.
  private originSessionToken: any = null;
  private destSessionToken: any = null;

  // Stored place_ids from autocomplete — used so Directions API resolves
  // coordinates itself, eliminating any need for the Geocoding API.
  private pendingOriginPlaceId: string | null = null;
  private pendingDestPlaceId: string | null = null;

  // ── Debounce timers ──────────────────────────────────────────────────────────
  private originDebounce: any;
  private destDebounce: any;
  private dragDebounce: any; // debounce Directions calls triggered by marker drag
  private readonly DEBOUNCE_MS = 600;  // 600 ms — safe with session tokens (all keystrokes = 1 billable session)
  private readonly DRAG_DEBOUNCE_MS = 400; // wait for drag to settle before calling Directions API

  constructor(
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.restoreFromMapState(this.mapState);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mapState'] && this.mapState) {
      this.restoreFromMapState(this.mapState);
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    requestAnimationFrame(() => this.initGoogleMap());
  }

  ngOnDestroy(): void {
    clearTimeout(this.originDebounce);
    clearTimeout(this.destDebounce);
    clearTimeout(this.dragDebounce);
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
    }
  }

  // ── State restoration ────────────────────────────────────────────────────────

  private restoreFromMapState(state: typeof this.mapState): void {
    if (!state) return;
    this.searchOrigin = state.origin || '';
    this.searchDestination = state.destination || '';
    if (state.isRoundTrip !== undefined) this.localIsRoundTrip.set(state.isRoundTrip);
    if (state.distance > 0) {
      this.localCalculatedDistance.set(state.distance);
      this.localBaseDistance.set(
        this.localIsRoundTrip() ? state.distance / 2 : state.distance
      );
    }
    if (state.pointA) this.localPointA.set(state.pointA);
    if (state.pointB) this.localPointB.set(state.pointB);
  }

  // ── Google Maps loader ───────────────────────────────────────────────────────

  private async initGoogleMap(): Promise<void> {
    await this.loadGoogleMapsScript();
    this.bootMap();
  }

  private loadGoogleMapsScript(): Promise<void> {
    return new Promise((resolve) => {
      if (googleMapsLoaded) { resolve(); return; }
      if (googleMapsLoading) { googleMapsCallbacks.push(resolve); return; }

      googleMapsLoading = true;
      googleMapsCallbacks.push(resolve);

      // Register the callback Google will invoke once all libraries are ready.
      // Using the ?callback= param (not script onload) is the only reliable way
      // to know that google.maps.Map and friends are fully initialised.
      (window as any)[GMAPS_CALLBACK] = () => {
        delete (window as any)[GMAPS_CALLBACK];
        googleMapsLoaded = true;
        googleMapsLoading = false;
        googleMapsCallbacks.splice(0).forEach(cb => cb());
      };

      const key = environment.googleMapsKey;
      const script = document.createElement('script');
      // Do NOT add loading=async here — that makes the callback fire too early.
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=${GMAPS_CALLBACK}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        delete (window as any)[GMAPS_CALLBACK];
        googleMapsLoading = false;
        this.localErrorMessage.set('Failed to load Google Maps. Check your API key / network.');
        this.cdr.detectChanges();
        googleMapsCallbacks.splice(0).forEach(cb => cb());
      };
      document.head.appendChild(script);
    });
  }

  private bootMap(): void {
    if (!window || typeof google === 'undefined' || !google.maps) {
      this.localErrorMessage.set('Google Maps did not load correctly.');
      return;
    }

    // ── Reveal container before creating map so it has real dimensions ──
    this.mapReady = true;
    this.cdr.detectChanges();

    this.gmap = new google.maps.Map(this.mapContainer.nativeElement, {
      center: { lat: 20.5937, lng: 78.9629 }, // India default
      zoom: 5,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      gestureHandling: 'greedy',
    });

    // Services
    this.directionsService = new google.maps.DirectionsService();
    this.geocoder = new google.maps.Geocoder();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true, // we draw our own draggable markers
      polylineOptions: { strokeColor: '#4285f4', strokeWeight: 4, strokeOpacity: 0.8 }
    });
    this.directionsRenderer.setMap(this.gmap);

    // Click handler: first click = A, second = B, subsequent = move B
    this.gmap.addListener('click', (e: any) => this.onMapClick(e.latLng));

    // Restore markers if re-opening with saved state
    requestAnimationFrame(() => this.restoreMarkers());
  }

  // ── Map click ────────────────────────────────────────────────────────────────

  private onMapClick(latLng: any): void {
    const pos = { lat: latLng.lat(), lng: latLng.lng() };
    if (!this.localPointA()) {
      // Only origin set — reverse-geocode for the label, no route yet
      this.localPointA.set(pos);
      this.pendingOriginPlaceId = null;
      this.placeMarkerA(latLng);
      this.reverseGeocodeLatLng(latLng, (label) => {
        this.searchOrigin = label;
        this.cdr.detectChanges();
      });
    } else if (!this.localPointB()) {
      // Both points now set — calculateRoute will fill both labels via start/end_address
      this.localPointB.set(pos);
      this.pendingDestPlaceId = null;
      this.placeMarkerB(latLng);
      this.calculateRoute();
    } else {
      // Move B — calculateRoute will refresh the To label
      this.localPointB.set(pos);
      this.pendingDestPlaceId = null;
      this.markerB.setPosition(latLng);
      this.calculateRoute();
    }
  }

  // ── Markers ──────────────────────────────────────────────────────────────────

  private placeMarkerA(latLng: any): void {
    if (this.markerA) {
      this.markerA.setPosition(latLng);
      return;
    }
    this.markerA = new google.maps.Marker({
      position: latLng,
      map: this.gmap,
      draggable: true,
      label: { text: 'A', color: '#fff', fontWeight: 'bold' },
      icon: this.markerIcon('#34a853'),
      title: 'Origin (drag to move)'
    });
    this.markerA.addListener('dragend', (e: any) => {
      const latLng = e.latLng;
      this.localPointA.set({ lat: latLng.lat(), lng: latLng.lng() });
      this.pendingOriginPlaceId = null;
      // Debounce: wait for the marker to settle before firing a Directions call.
      // A user dragging slowly would otherwise trigger one call per pixel.
      clearTimeout(this.dragDebounce);
      this.dragDebounce = setTimeout(() => {
        if (this.localPointB()) {
          // calculateRoute will update both labels via start/end_address
          this.calculateRoute(undefined, undefined, true);
        } else {
          this.reverseGeocodeLatLng(latLng, (label) => {
            this.searchOrigin = label;
            this.cdr.detectChanges();
          });
        }
      }, this.DRAG_DEBOUNCE_MS);
      this.cdr.detectChanges();
    });
  }

  private placeMarkerB(latLng: any): void {
    if (this.markerB) {
      this.markerB.setPosition(latLng);
      return;
    }
    this.markerB = new google.maps.Marker({
      position: latLng,
      map: this.gmap,
      draggable: true,
      label: { text: 'B', color: '#fff', fontWeight: 'bold' },
      icon: this.markerIcon('#ea4335'),
      title: 'Destination (drag to move)'
    });
    this.markerB.addListener('dragend', (e: any) => {
      const latLng = e.latLng;
      this.localPointB.set({ lat: latLng.lat(), lng: latLng.lng() });
      this.pendingDestPlaceId = null;
      // Debounce: wait for the marker to settle before firing a Directions call.
      clearTimeout(this.dragDebounce);
      this.dragDebounce = setTimeout(() => {
        if (this.localPointA()) {
          // calculateRoute will update both labels via start/end_address
          this.calculateRoute(undefined, undefined, true);
        } else {
          this.reverseGeocodeLatLng(latLng, (label) => {
            this.searchDestination = label;
            this.cdr.detectChanges();
          });
        }
      }, this.DRAG_DEBOUNCE_MS);
      this.cdr.detectChanges();
    });
  }

  private markerIcon(color: string): any {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2,
    };
  }

  private restoreMarkers(): void {
    const a = this.localPointA();
    const b = this.localPointB();
    if (!a && !b) return;

    if (a) this.placeMarkerA(new google.maps.LatLng(a.lat, a.lng));
    if (b) this.placeMarkerB(new google.maps.LatLng(b.lat, b.lng));

    if (a && b) {
      this.calculateRoute();
    } else if (a) {
      this.gmap.setCenter({ lat: a.lat, lng: a.lng });
      this.gmap.setZoom(10);
    }
  }

  // ── Directions / Distance ────────────────────────────────────────────────────

  /**
   * Request a route from Directions API.
   *
   * `originRef` / `destinationRef` can each be:
   *  - a { lat, lng } coordinate (from map click or drag)
   *  - a place_id string (from autocomplete selection)
   *
   * When a place_id is supplied, Directions API resolves the coordinate
   * itself and we read it back from legs[0].start_location / end_location —
   * no Geocoding API call needed.
   */
  private calculateRoute(
    originRef?: { lat: number; lng: number } | string,
    destinationRef?: { lat: number; lng: number } | string,
    refreshLabels = false
  ): void {
    // Fall back to stored signals when not explicitly passed
    const oRef = originRef  ?? this.localPointA();
    const dRef = destinationRef ?? this.localPointB();
    if (!oRef || !dRef) return;

    // Build Directions API origin / destination values
    const toDirectionsInput = (ref: { lat: number; lng: number } | string) =>
      typeof ref === 'string'
        ? { placeId: ref }
        : new google.maps.LatLng((ref as any).lat, (ref as any).lng);

    this.localIsLoading.set(true);
    this.localErrorMessage.set('');
    this.cdr.detectChanges();

    this.directionsService.route(
      {
        origin: toDirectionsInput(oRef),
        destination: toDirectionsInput(dRef),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result: any, status: any) => {
        this.localIsLoading.set(false);
        if (status === google.maps.DirectionsStatus.OK) {
          this.directionsRenderer.setDirections(result);
          const leg = result.routes[0].legs[0];

          // Extract resolved LatLngs from the response
          const startLatLng = leg.start_location;
          const endLatLng   = leg.end_location;

          // Update coordinate signals from what Directions resolved
          this.localPointA.set({ lat: startLatLng.lat(), lng: startLatLng.lng() });
          this.localPointB.set({ lat: endLatLng.lat(),   lng: endLatLng.lng()   });

          // Sync marker positions to the Directions-resolved coordinates
          if (this.markerA) this.markerA.setPosition(startLatLng);
          else this.placeMarkerA(startLatLng);
          if (this.markerB) this.markerB.setPosition(endLatLng);
          else this.placeMarkerB(endLatLng);

          // Populate input labels from the Directions response.
          // leg.start_address / end_address are always returned for free.
          // Only set if the field is empty (map-click/drag) — don't overwrite
          // a place name the user picked from autocomplete.
          if ((!this.searchOrigin || refreshLabels) && leg.start_address) {
            this.searchOrigin = leg.start_address;
          }
          if ((!this.searchDestination || refreshLabels) && leg.end_address) {
            this.searchDestination = leg.end_address;
          }

          const distanceKm = leg.distance.value / 1000; // metres → km
          this.localBaseDistance.set(Math.round(distanceKm * 100) / 100);
          const displayed = this.localIsRoundTrip() ? distanceKm * 2 : distanceKm;
          this.localCalculatedDistance.set(Math.round(displayed * 100) / 100);
          this.emitState();
        } else {
          // Directions API failed — fall back to straight-line Haversine
          // (only possible when both sides are LatLng, not place_id)
          const a = this.localPointA();
          const b = this.localPointB();
          if (a && b) {
            const haversine = this.haversineKm(a, b);
            this.localBaseDistance.set(Math.round(haversine * 100) / 100);
            const displayed = this.localIsRoundTrip() ? haversine * 2 : haversine;
            this.localCalculatedDistance.set(Math.round(displayed * 100) / 100);
            this.emitState();
          }
          this.localErrorMessage.set(`Route unavailable (${status}). Showing straight-line distance.`);
        }
        this.cdr.detectChanges();
      }
    );
  }

  private haversineKm(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
  ): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  // ── Round-trip toggle ────────────────────────────────────────────────────────

  toggleRoundTrip(): void {
    const next = !this.localIsRoundTrip();
    this.localIsRoundTrip.set(next);
    const base = this.localBaseDistance();
    if (base > 0) {
      this.localCalculatedDistance.set(Math.round((next ? base * 2 : base) * 100) / 100);
      this.emitState();
    }
  }

  // ── Places autocomplete (debounced) ─────────────────────────────────────────

  onOriginInput(e: Event): void {
    const q = (e.target as HTMLInputElement).value.trim();
    this.searchOrigin = q;
    clearTimeout(this.originDebounce);
    if (q.length < 3) { this.originSuggestions = []; this.originSessionToken = null; return; }
    // Create a session token the first time the user starts typing a new query.
    // All subsequent keystrokes in this session reuse the same token.
    if (!this.originSessionToken && this.placesLibrary) {
      this.originSessionToken = new this.placesLibrary.AutocompleteSessionToken();
    }
    this.originLoading = true;
    this.originDebounce = setTimeout(() => this.fetchSuggestions(q, 'origin'), this.DEBOUNCE_MS);
  }

  onDestInput(e: Event): void {
    const q = (e.target as HTMLInputElement).value.trim();
    this.searchDestination = q;
    clearTimeout(this.destDebounce);
    if (q.length < 3) { this.destSuggestions = []; this.destSessionToken = null; return; }
    // Create a session token the first time the user starts typing a new query.
    if (!this.destSessionToken && this.placesLibrary) {
      this.destSessionToken = new this.placesLibrary.AutocompleteSessionToken();
    }
    this.destLoading = true;
    this.destDebounce = setTimeout(() => this.fetchSuggestions(q, 'dest'), this.DEBOUNCE_MS);
  }

  private async fetchSuggestions(query: string, target: 'origin' | 'dest'): Promise<void> {
    // Lazily load the New Places library on first use.
    if (!this.placesLibrary) {
      try {
        this.placesLibrary = await google.maps.importLibrary('places');
      } catch {
        if (target === 'origin') { this.originLoading = false; this.originSuggestions = []; }
        else                     { this.destLoading   = false; this.destSuggestions   = []; }
        this.cdr.detectChanges();
        return;
      }
    }

    // Create session token now if it wasn't created in onInput yet
    // (happens on the very first search before placesLibrary was available).
    if (target === 'origin' && !this.originSessionToken) {
      this.originSessionToken = new this.placesLibrary.AutocompleteSessionToken();
    }
    if (target === 'dest' && !this.destSessionToken) {
      this.destSessionToken = new this.placesLibrary.AutocompleteSessionToken();
    }

    try {
      // ── New Places API ─────────────────────────────────────────────────────
      // Passing sessionToken groups all keystrokes + final selection into one
      // billable session — dramatically cheaper than per-request billing.
      const request = {
        input: query,
        language: 'en',
        region: 'in',
        includedPrimaryTypes: [],
        sessionToken: target === 'origin' ? this.originSessionToken : this.destSessionToken,
      };
      const { suggestions } =
        await this.placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

      const mapped = (suggestions ?? []).map((s: any) => s.placePrediction);

      if (target === 'origin') {
        this.originLoading = false;
        this.originSuggestions = mapped;
      } else {
        this.destLoading = false;
        this.destSuggestions = mapped;
      }
    } catch {
      if (target === 'origin') { this.originLoading = false; this.originSuggestions = []; }
      else                     { this.destLoading   = false; this.destSuggestions   = []; }
    }
    this.cdr.detectChanges();
  }

  // ── Suggestion selection ─────────────────────────────────────────────────────

  selectOriginSuggestion(suggestion: any): void {
    this.searchOrigin = suggestion.text?.text ?? suggestion.mainText?.text ?? '';
    this.originSuggestions = [];
    this.originFocused = false;
    const placeId: string = suggestion.placeId;
    this.pendingOriginPlaceId = placeId;

    // Discard the session token — this signals the end of the autocomplete
    // session to Google and completes the single billable session unit.
    this.originSessionToken = null;

    if (this.pendingDestPlaceId) {
      this.calculateRoute(placeId, this.pendingDestPlaceId);
    } else if (this.localPointB()) {
      this.calculateRoute(placeId, this.localPointB()!);
    } else {
      // Only origin selected, no destination yet.
      // Use fetchFields({fields:['location']}) — FREE within the autocomplete
      // session (no extra SKU). Avoids a billable Directions API call.
      this.resolveCoordFromPlace(suggestion, (latLng: any) => {
        const pos = { lat: latLng.lat(), lng: latLng.lng() };
        this.localPointA.set(pos);
        this.placeMarkerA(latLng);
        this.gmap.panTo(latLng);
        this.cdr.detectChanges();
      });
    }
  }

  selectDestSuggestion(suggestion: any): void {
    this.searchDestination = suggestion.text?.text ?? suggestion.mainText?.text ?? '';
    this.destSuggestions = [];
    this.destFocused = false;
    const placeId: string = suggestion.placeId;
    this.pendingDestPlaceId = placeId;

    // Discard the session token — ends the billable session for this field.
    this.destSessionToken = null;

    if (this.pendingOriginPlaceId) {
      this.calculateRoute(this.pendingOriginPlaceId, placeId);
    } else if (this.localPointA()) {
      this.calculateRoute(this.localPointA()!, placeId);
    } else {
      // Only destination selected, no origin yet.
      // Use fetchFields({fields:['location']}) — FREE within autocomplete session.
      this.resolveCoordFromPlace(suggestion, (latLng: any) => {
        const pos = { lat: latLng.lat(), lng: latLng.lng() };
        this.localPointB.set(pos);
        this.placeMarkerB(latLng);
        this.gmap.panTo(latLng);
        this.cdr.detectChanges();
      });
    }
  }

  /**
   * Resolve a PlacePrediction's coordinates using the New Places API
   * fetchFields({ fields: ['location'] }).
   *
   * Cost: FREE — `fetchFields` called immediately after an autocomplete
   * selection is billed as part of the same autocomplete session (session
   * token was already discarded above, but Google counts it as the session
   * finalisation call when called right after selection).
   *
   * Previously used resolveCoordFromPlaceId which fired a full Directions
   * API call (billable at $5 / 1000 requests) just to obtain coordinates.
   */
  private async resolveCoordFromPlace(
    suggestion: any,
    cb: (latLng: any) => void
  ): Promise<void> {
    try {
      const place = suggestion.toPlace();
      await place.fetchFields({ fields: ['location'] });
      if (place.location) {
        cb(place.location);
      } else {
        this.localErrorMessage.set('Could not resolve location. Try again.');
        this.cdr.detectChanges();
      }
    } catch {
      this.localErrorMessage.set('Could not resolve location. Try again.');
      this.cdr.detectChanges();
    }
  }

  /**
   * @deprecated — kept only as a fallback if toPlace() is unavailable.
   * Resolve a single place's coordinate using Directions API
   * (origin = destination = same place_id).
   */
  private resolveCoordFromPlaceId(placeId: string, cb: (latLng: any) => void): void {
    this.directionsService.route(
      {
        origin: { placeId },
        destination: { placeId },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result: any, status: any) => {
        if (status === google.maps.DirectionsStatus.OK) {
          cb(result.routes[0].legs[0].start_location);
        } else {
          this.localErrorMessage.set('Could not resolve location. Try again.');
          this.cdr.detectChanges();
        }
      }
    );
  }

  // Close dropdowns on blur (delayed so mousedown on a suggestion fires first).
  // Also discard any open session token — an abandoned session should not be
  // left open, as Google may charge it on the next unrelated query.
  onOriginBlur(): void {
    setTimeout(() => {
      this.originFocused = false;
      if (this.originSuggestions.length === 0) this.originSessionToken = null;
      this.cdr.detectChanges();
    }, 200);
  }
  onDestBlur(): void {
    setTimeout(() => {
      this.destFocused = false;
      if (this.destSuggestions.length === 0) this.destSessionToken = null;
      this.cdr.detectChanges();
    }, 200);
  }

  // ── Current location ─────────────────────────────────────────────────────────

  /**
   * Obtain the device's GPS position and use it as the origin (target='origin')
   * or destination (target='dest').
   *
   * Reverse-geocoding is done by asking Directions API with origin=destination=
   * the LatLng — the same zero-distance trick already used in resolveCoordFromPlaceId.
   * This keeps us entirely within the Directions API quota and avoids enabling
   * the Geocoding API on the project.
   */
  useCurrentLocation(target: 'origin' | 'dest'): void {
    if (!this.isBrowser || !navigator.geolocation) {
      this.localErrorMessage.set('Geolocation is not supported by your browser.');
      return;
    }
    if (target === 'origin') this.locatingOrigin = true;
    else                     this.locatingDest   = true;
    this.localErrorMessage.set('');
    this.cdr.detectChanges();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const latLng = new google.maps.LatLng(lat, lng);
        const coord  = { lat, lng };

        if (target === 'origin') {
          this.locatingOrigin = false;
          this.localPointA.set(coord);
          this.placeMarkerA(latLng);
          this.gmap.panTo(latLng);
          this.pendingOriginPlaceId = null;
          if (this.localPointB()) {
            // Other point already set — calculateRoute fills both labels from
            // leg.start_address/end_address in ONE call (no extra reverse-geocode).
            this.calculateRoute(undefined, undefined, true);
          } else {
            // Alone — reverse-geocode to show a human label (free Geocoder).
            this.reverseGeocodeLatLng(latLng, (label: string) => {
              this.searchOrigin = label;
              this.cdr.detectChanges();
            });
          }
        } else {
          this.locatingDest = false;
          this.localPointB.set(coord);
          this.placeMarkerB(latLng);
          this.pendingDestPlaceId = null;
          if (this.localPointA()) {
            // Other point already set — calculateRoute fills both labels.
            this.calculateRoute(undefined, undefined, true);
          } else {
            this.reverseGeocodeLatLng(latLng, (label: string) => {
              this.searchDestination = label;
              this.cdr.detectChanges();
            });
          }
        }
        this.cdr.detectChanges();
      },
      (err) => {
        if (target === 'origin') this.locatingOrigin = false;
        else                     this.locatingDest   = false;
        this.localErrorMessage.set(
          err.code === 1
            ? 'Location access denied. On iPhone: Settings → Safari → Location → Allow.'
            : 'Could not get your location. Try again.'
        );
        this.cdr.detectChanges();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /**
   * Reverse-geocode a LatLng to a readable address using the Maps JS SDK's
   * built-in Geocoder — this is FREE (no extra SKU charge) because Geocoder is
   * included in the base Maps JavaScript API billing.
   * Previously used a Directions same-point trick which consumed a Directions API
   * call (billable at $5 / 1000 requests).
   */
  private reverseGeocodeLatLng(latLng: any, cb: (label: string) => void): void {
    const fallback = `${latLng.lat().toFixed(5)}, ${latLng.lng().toFixed(5)}`;
    if (!this.geocoder) { cb(fallback); return; }
    this.geocoder.geocode(
      { location: { lat: latLng.lat(), lng: latLng.lng() } },
      (results: any[], status: string) => {
        if (status === 'OK' && results && results[0]) {
          cb(results[0].formatted_address ?? fallback);
        } else {
          cb(fallback);
        }
      }
    );
  }

  // ── Clear individual point ────────────────────────────────────────────────────

  clearPoint(target: 'origin' | 'dest'): void {
    if (target === 'origin') {
      this.searchOrigin = '';
      this.originSuggestions = [];
      this.pendingOriginPlaceId = null;
      this.localPointA.set(null);
      if (this.markerA) {
        this.markerA.setMap(null);
        this.markerA = null;
      }
    } else {
      this.searchDestination = '';
      this.destSuggestions = [];
      this.pendingDestPlaceId = null;
      this.localPointB.set(null);
      if (this.markerB) {
        this.markerB.setMap(null);
        this.markerB = null;
      }
    }
    // Clear any drawn route since one point is gone
    if (this.directionsRenderer) {
      this.directionsRenderer.setDirections({ routes: [] });
    }
    this.localCalculatedDistance.set(0);
    this.emitState();
    this.cdr.detectChanges();
  }

  // ── Emit ─────────────────────────────────────────────────────────────────────

  private emitState(): void {
    this.mapStateChange.emit({
      origin: this.searchOrigin,
      destination: this.searchDestination,
      distance: this.localCalculatedDistance(),
      isRoundTrip: this.localIsRoundTrip(),
      pointA: this.localPointA(),
      pointB: this.localPointB(),
    });
  }
}
