# Quick Reference: Distance Calculator with OpenRouteService

## 🎯 What's New?

Your fare calculator now includes an interactive **map-based distance calculator** powered by OpenRouteService!

## 🚀 Quick Start (5 Steps)

### Step 1: Get API Key
- Go to https://openrouteservice.org/
- Sign up (free)
- Copy your API key

### Step 2: Add API Key
- Open `src/app/services/distance.service.ts`
- Find line: `private readonly API_KEY = 'YOUR_OPENROUTESERVICE_API_KEY';`
- Replace with your actual key

### Step 3: Start App
```bash
npm start
```

### Step 4: Click Map Button
- In the distance field, click the **📍 Map** button
- A map modal will open

### Step 5: Select Route
1. Click Point A (origin) on map
2. Click Point B (destination) on map
3. (Optional) Toggle "Round Trip"
4. Click "Calculate Route"
5. Click "Apply Distance"
6. Calculator auto-fills with distance!

## 📊 Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `src/app/services/distance.service.ts` | New | OpenRouteService integration |
| `src/app/components/map.component.ts` | New | Interactive Leaflet map |
| `src/app/app.ts` | Modified | Added map modal control |
| `src/app/app.html` | Modified | Added map button and modal |
| `src/app/app-module.ts` | Modified | Added HttpClientModule |

## 🎮 Features

✅ **Click-to-Select Map** - Choose origin/destination
✅ **Distance Calculation** - Via OpenRouteService API
✅ **Round Trip Mode** - Double the distance automatically
✅ **Real-time Integration** - Distance auto-populates calculator
✅ **Beautiful UI** - Gradient headers, color-coded markers
✅ **Error Handling** - Helpful error messages
✅ **SSR Compatible** - Works with server-side rendering

## 🔧 Configuration

### Development (Simple)
```typescript
// src/app/services/distance.service.ts
private readonly API_KEY = 'sk_abc123def456...';
```

### Production (Secure - Using Environment Variables)
```typescript
// environment.ts
export const environment = {
  openrouteServiceKey: process.env['OPENROUTESERVICE_API_KEY']
};

// distance.service.ts
import { environment } from '../../environments/environment';
private readonly API_KEY = environment.openrouteServiceKey;
```

## 📍 How It Works

```
User clicks 📍 Map
       ↓
Map modal opens
       ↓
User clicks 2 points
       ↓
"Calculate Route" clicked
       ↓
OpenRouteService calculates distance
       ↓
Distance shown in map
       ↓
"Apply Distance" clicked
       ↓
Calculator input filled ✨
       ↓
Fare calculated automatically
```

## 🎨 Map Features

| Feature | Details |
|---------|---------|
| **Markers** | Green (origin), Red (destination) |
| **Route Line** | Dashed blue line |
| **Auto-Fit** | Map zooms to show full route |
| **Coordinates** | Displayed in info grid |
| **Round Trip** | Checkbox to 2x distance |

## ⚙️ API Details

### Main Method
```typescript
distanceService.calculateDistance(): Observable<DistanceResult>
```

### Result Object
```typescript
{
  distance: number,      // in kilometers
  duration: number,      // in seconds
  routeGeometry: any     // GeoJSON geometry
}
```

### Signals (Real-time State)
```typescript
distanceService.pointA()           // Selected origin
distanceService.pointB()           // Selected destination
distanceService.calculatedDistance // Calculated distance (km)
distanceService.isRoundTrip()      // Round trip enabled?
distanceService.isLoading()        // Calculating?
distanceService.errorMessage()     // Error text
```

## 🐛 Troubleshooting

### Map not loading?
- ✓ Check internet connection
- ✓ Clear browser cache
- ✓ Check browser console for errors

### "API key is invalid"?
- ✓ Verify key is copied exactly
- ✓ Check for extra spaces
- ✓ Get new key from OpenRouteService dashboard

### Distance calculation fails?
- ✓ Ensure both points are selected
- ✓ Try with major cities first
- ✓ Check if area is covered by OpenRouteService

### "Rate limit exceeded"?
- ✓ Wait 1 minute (40 requests/min limit on free tier)
- ✓ Upgrade to paid plan for higher limits

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| `DISTANCE_SERVICE_GUIDE.md` | Full feature documentation |
| `OPENROUTESERVICE_SETUP.md` | API key setup guide |
| `IMPLEMENTATION_SUMMARY.md` | Complete implementation details |

## 💡 Pro Tips

1. **Free Tier Limits**: 40 requests/minute
2. **Coverage**: Works best in major cities
3. **Round Trip**: Automatically 2x the calculated distance
4. **Backend Proxy**: Use backend endpoint for production (see `OPENROUTESERVICE_SETUP.md`)
5. **Error Messages**: User-friendly messages in map component

## 🔐 Security

⚠️ **Never commit API keys to Git**

Use `.gitignore`:
```
.env
.env.local
*.key
environment.prod.ts
```

For production, always use backend proxy (see `OPENROUTESERVICE_SETUP.md`).

## 🎯 Next Steps

1. ✅ Add API key
2. 🔄 Test map feature
3. 📊 Use distances in calculations
4. 🚀 Deploy to production

## 📞 Need Help?

1. Check the relevant documentation file
2. Review error messages in browser console
3. Verify API key is valid
4. Check OpenRouteService coverage

## 🚀 Deployment

### CSR (Client-Side Rendering)
```bash
npm run build
# Deploy dist/ folder
```

### SSR (Server-Side Rendering)
```bash
npm run build:ssr
npm run serve:ssr
```

## 📋 Git Commits

Recent commits for this feature:
```
a8e7a78 - Add implementation summary
9a0ffb2 - Fix SSR compatibility with platform detection
d170df3 - Add OpenRouteService setup guide
32b0872 - Add OpenRouteService distance calculator with map
```

---

**Status**: ✅ Ready to Use
**Version**: 1.0.0
**Date**: April 4, 2026
