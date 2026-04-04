# API Key Setup Guide

## Quick Setup (5 minutes)

### Step 1: Get Your OpenRouteService API Key

1. Go to https://openrouteservice.org/
2. Click **Sign Up** (top right corner)
3. Enter your email and create a password
4. Verify your email
5. Log in to your account
6. Click **Dashboard** in the menu
7. Look for **API Keys** section
8. Copy your API key (long alphanumeric string starting with `sk_`)

### Step 2: Add API Key to Your Local Environment

1. In the project root (`calculate-rent/`), open or create `.env.local`
2. Add your API key:
   ```
   VITE_OPENROUTESERVICE_KEY=sk_your_actual_key_here
   ```
3. Save the file

### Step 3: Restart the Dev Server

If the dev server is running:
1. Press `Ctrl+C` to stop it
2. Run: `npm start`
3. The app will now pick up your API key

## Testing the Feature

1. Open http://localhost:4200/ in your browser
2. Scroll down to the **Select Route on Map** section
3. Click **Set Origin**
4. Click any location on the map to set Point A
5. Click **Set Destination**
6. Click another location on the map to set Point B
7. Click **Calculate Route**
8. The distance should display in the "Distance" field above the map

## Security Notes

- ✅ `.env.local` is in `.gitignore` — your API key won't be committed
- ✅ For production, set the `VITE_OPENROUTESERVICE_KEY` environment variable on your hosting platform (Netlify, Vercel, etc.)
- ❌ Never commit `.env.local` to git
- ❌ Never share your API key publicly

## Free Tier Limits

- ✅ 40 requests per minute
- ✅ All routing profiles (driving, walking, cycling)
- ✅ Full feature access
- ✅ No credit card required

If you exceed the limit, wait a minute before making new requests.

## Troubleshooting

### "API key not configured" error
- Check that `.env.local` exists in the project root
- Verify `VITE_OPENROUTESERVICE_KEY=` has your actual key (not blank)
- Restart the dev server after adding the key

### "Route not found" or "API key is invalid"
- Double-check your API key has no extra spaces
- Verify you copied the entire key from the dashboard
- Try regenerating a new key in the OpenRouteService dashboard

### "Rate limit exceeded"
- You've exceeded 40 requests/minute
- Wait a minute and try again
- Consider upgrading to a paid plan for higher limits

## Environment Variables for Deployment

### Netlify
1. Go to **Site settings** → **Build & deploy** → **Environment**
2. Add new variable:
   - Key: `VITE_OPENROUTESERVICE_KEY`
   - Value: Your API key
3. Redeploy your site

### Vercel
1. Go to **Settings** → **Environment Variables**
2. Add new variable:
   - Name: `VITE_OPENROUTESERVICE_KEY`
   - Value: Your API key
   - Environments: Production, Preview, Development
3. Redeploy

### Other Platforms
Set the environment variable `VITE_OPENROUTESERVICE_KEY` with your API key value.

## Next Steps

- See `DISTANCE_SERVICE_GUIDE.md` for technical details
- See `OPENROUTESERVICE_SETUP.md` for API documentation
