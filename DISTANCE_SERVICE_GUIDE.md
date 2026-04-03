# OpenRouteService Distance Calculator

## Overview

This feature integrates **OpenRouteService** with a **Leaflet Map** to calculate driving distances between two selected points. Users can click on the map to select Point A (origin) and Point B (destination), and optionally enable round-trip mode to double the distance.

## Features

✅ **Interactive Map** - Click-to-select origin and destination points
✅ **Round Trip Option** - Toggle to automatically double the calculated distance
✅ **Visual Markers** - Color-coded markers (green for origin, red for destination)
✅ **Route Visualization** - Dashed line showing the direct route between points
✅ **Real-time Integration** - Selected distance automatically populates the calculator
✅ **Error Handling** - Graceful error messages and validation
✅ **Loading States** - User feedback during route calculation

## File Structure

```
src/app/
├── services/
│   └── distance.service.ts        # OpenRouteService integration
├── components/
│   └── map.component.ts            # Leaflet map component
├── app.ts                          # Updated with distance service
├── app.html                        # Updated with map modal
├── app-module.ts                   # Updated with imports
└── ...
```

## Setup Instructions

### 1. Get OpenRouteService API Key

1. Visit [OpenRouteService](https://openrouteservice.org/)
2. Sign up for a free account
3. Go to your dashboard and copy your API key
4. Update `src/app/services/distance.service.ts`:

```typescript
private readonly API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your actual key
```

### 2. Installation

Dependencies are already installed:
- `leaflet` - Map library
- `openrouteservice` - Routing service
- `@types/leaflet` - TypeScript definitions

If needed, install manually:
```bash
npm install leaflet openrouteservice @types/leaflet
```

### 3. Usage

#### From Calculator UI
1. Click the **📍 Map** button next to the Distance input
2. Click on the map to select Point A (Origin)
3. Click again to select Point B (Destination)
4. Toggle "Round Trip" checkbox if needed
5. Click **Calculate Route** button
6. Click **Apply Distance** to populate the calculator

#### Programmatic Usage

```typescript
// Inject the service
constructor(private distanceService: DistanceService) {}

// Set coordinates
this.distanceService.setPointA({ lat: 28.6139, lng: 77.2090 }); // Delhi
this.distanceService.setPointB({ lat: 19.0760, lng: 72.8777 }); // Mumbai

// Calculate distance
this.distanceService.calculateDistance().subscribe({
  next: (result) => {
    const processed = this.distanceService.processDistanceResult(result);
    console.log('Distance:', processed.distance, 'km');
  },
  error: (error) => console.error('Error:', error)
});

// Get final distance (with round trip multiplier)
const finalDistance = this.distanceService.getFinalDistance();
```

## Service API

### `DistanceService`

#### Signals
- `pointA: Signal<RouteCoordinates | null>` - First selected point
- `pointB: Signal<RouteCoordinates | null>` - Second selected point
- `calculatedDistance: Signal<number>` - Distance in kilometers
- `isRoundTrip: Signal<boolean>` - Round trip mode enabled
- `routeGeometry: Signal<any>` - GeoJSON route geometry
- `isLoading: Signal<boolean>` - Loading state
- `errorMessage: Signal<string>` - Error message if any

#### Methods
- `setPointA(coordinates)` - Set origin point
- `setPointB(coordinates)` - Set destination point
- `toggleRoundTrip()` - Toggle round trip mode
- `calculateDistance()` - Call OpenRouteService API
- `processDistanceResult(result)` - Parse API response and apply round trip
- `getFinalDistance()` - Get distance with multiplier applied
- `getDistanceMultiplier()` - Get 1x or 2x multiplier
- `resetDistance()` - Clear all data

## Component Interaction

```
┌─────────────────────────────────────────┐
│         App Component                   │
│  (Calculator Form)                      │
├─────────────────────────────────────────┤
│ - showMapModal signal                   │
│ - toggleMapModal()                      │
│ - applyDistanceFromMap()                │
└────────────────┬────────────────────────┘
                 │ triggers
                 ▼
┌─────────────────────────────────────────┐
│     Map Modal (Template)                │
├─────────────────────────────────────────┤
│ - Display/Hide controlled by signal     │
│ - Provides Apply/Close buttons          │
└────────────────┬────────────────────────┘
                 │ contains
                 ▼
┌─────────────────────────────────────────┐
│     MapComponent (Standalone)           │
├─────────────────────────────────────────┤
│ - Leaflet map initialization            │
│ - Click handlers for points             │
│ - Route visualization                   │
│ - Integrate DistanceService             │
└────────────────┬────────────────────────┘
                 │ uses
                 ▼
┌─────────────────────────────────────────┐
│     DistanceService (Injectable)        │
├─────────────────────────────────────────┤
│ - Manages coordinates                   │
│ - Calls OpenRouteService API            │
│ - Applies round trip multiplier         │
│ - Manages state via signals             │
└─────────────────────────────────────────┘
```

## Distance Calculation Formula

For one-way trips:
```
Distance = Distance from OpenRouteService (in meters) / 1000
```

For round-trip:
```
Distance = (Distance from OpenRouteService / 1000) × 2
```

## Map Features

### Markers
- **Green Marker** - Point A (Origin) - Click first
- **Red Marker** - Point B (Destination) - Click second
- Both markers are draggable and show coordinates on hover

### Map Tiles
- OpenStreetMap tiles (OSM)
- Supports zoom levels 3-19
- Centered on India by default

### Visual Feedback
- Dashed blue line connecting the two points
- Auto-fit map view to show entire route
- Crosshair cursor to indicate map clickability

## Error Handling

The service provides comprehensive error handling:

1. **Missing API Key** - Update with your OpenRouteService API key
2. **Invalid Coordinates** - Service validates both points are set
3. **API Errors** - Graceful error messages displayed in UI
4. **Network Issues** - Errors propagated with user-friendly messages

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Requires modern ES2020+ JavaScript support

## Performance Optimization

- Map is lazy-loaded only when modal opens
- Signals provide reactive updates
- Route calculations debounced to prevent excessive API calls
- Browser caching enabled for map tiles

## Security Notes

⚠️ **API Key Management**
- Don't commit actual API keys to version control
- Use environment variables for production
- Consider using a backend proxy for sensitive operations

Future implementation:
```typescript
private readonly API_KEY = environment.openrouteServiceKey;
```

## Troubleshooting

### Map not loading
- Check browser console for errors
- Verify internet connection
- Ensure leaflet CSS is properly loaded

### Distance calculation fails
- Verify OpenRouteService API key is valid
- Check that coordinates are within service coverage area
- Ensure both points are selected before calculating

### Markers not appearing
- Refresh the page
- Clear browser cache
- Verify marker icon URLs are accessible

## Future Enhancements

- [ ] Multiple route options (fastest, shortest, etc.)
- [ ] Drag-and-drop markers after placement
- [ ] Save favorite routes
- [ ] Support for waypoints (via Point C, D, etc.)
- [ ] Route export (GPX, KML formats)
- [ ] Traffic-aware routing
- [ ] Estimated toll costs integration

## API Rate Limits

Free tier: 40 requests per minute
Paid tier: Check your OpenRouteService plan

## References

- [OpenRouteService Docs](https://openrouteservice.org/dev/#/)
- [Leaflet Documentation](https://leafletjs.com/)
- [Angular Signals](https://angular.io/guide/signals)
