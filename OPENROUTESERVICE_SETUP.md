# OpenRouteService API Key Setup

## Quick Start

### Step 1: Create OpenRouteService Account

1. Go to https://openrouteservice.org/
2. Click **Sign Up** (top right)
3. Fill in the registration form:
   - Email
   - Password
   - Confirm password
4. Click **Create Account**
5. Verify your email address

### Step 2: Get Your API Key

1. Log in to your OpenRouteService account
2. Click on **Dashboard** (after login)
3. Look for **API Keys** section
4. Your free API key is automatically generated
5. Copy it (looks like a long alphanumeric string)

### Step 3: Add API Key to Application

Open `src/app/services/distance.service.ts` and replace:

```typescript
private readonly API_KEY = 'YOUR_OPENROUTESERVICE_API_KEY';
```

With your actual API key:

```typescript
private readonly API_KEY = 'sk_abc123def456...';
```

### Step 4: Test the Feature

1. Start the app: `npm start`
2. Navigate to the calculator
3. Click the **📍 Map** button next to Distance field
4. Select two points on the map
5. Click **Calculate Route**
6. Click **Apply Distance**

## Free Tier Benefits

- ✅ 40 requests per minute
- ✅ All routing profiles (driving, walking, cycling, etc.)
- ✅ Full API access
- ✅ No credit card required

## Using Environment Variables (Production)

For production deployments, use environment variables:

**Step 1:** Create `.env` file in project root:
```
OPENROUTESERVICE_API_KEY=your_api_key_here
```

**Step 2:** Update `distance.service.ts`:
```typescript
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DistanceService {
  private readonly API_KEY = environment.openrouteServiceKey;
  // ... rest of service
}
```

**Step 3:** Create `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  openrouteServiceKey: process.env['OPENROUTESERVICE_API_KEY'] || ''
};
```

## Troubleshooting

### "API key is invalid" error
- ✓ Copy the full API key (check for extra spaces)
- ✓ Verify you're using the correct environment file
- ✓ Regenerate a new key from dashboard

### "Rate limit exceeded" error
- ✓ You've exceeded 40 requests/minute
- ✓ Wait a minute before making new requests
- ✓ Upgrade to paid plan for higher limits

### "Route not found" error
- ✓ Coordinates might be in restricted area
- ✓ Try points in major cities first
- ✓ Check if points are too far apart for the service coverage

### Map not loading
- ✓ Check browser console for CORS errors
- ✓ Verify internet connection
- ✓ Try clearing browser cache

## API Key Security

⚠️ **Important Security Notes:**

1. **Never commit API keys** to version control
2. **Use .gitignore** for sensitive files:
   ```
   .env
   .env.local
   environment.*.ts
   ```

3. **Backend Proxy (Recommended for Production):**
   Instead of exposing your API key in frontend, create a backend endpoint:
   
   ```typescript
   // Backend (Node.js/Express)
   app.post('/api/calculate-distance', (req, res) => {
     const { pointA, pointB } = req.body;
     const apiKey = process.env.OPENROUTESERVICE_API_KEY;
     
     fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
       // Use apiKey securely
     }).then(res => res.json())
       .then(data => res.json(data));
   });
   ```

## Support

- **Documentation**: https://openrouteservice.org/dev/#/
- **GitHub Issues**: https://github.com/GIScience/openrouteservice-py/issues
- **Community Forum**: https://community.openrouteservice.org/

## Next Steps

1. ✅ API key configured
2. 🔄 Test with map feature
3. 📊 Use distances in fare calculations
4. 🚀 Deploy to production with environment variables

Enjoy calculating accurate distances! 🎉
