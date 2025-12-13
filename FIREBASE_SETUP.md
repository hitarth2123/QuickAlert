# Firebase Authentication Setup

QuickAlert uses Firebase for phone OTP and Google Sign-In authentication.

## Quick Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Enter project name and follow the steps

### 2. Enable Authentication
1. Go to **Authentication > Sign-in method**
2. Enable:
   - ✅ **Phone** - For SMS OTP verification
   - ✅ **Google** - For one-click sign in

### 3. Add Web App
1. Go to **Project Settings > General**
2. Under "Your apps", click **Add app > Web**
3. Register app and copy config values

### 4. Configure Frontend
Update `client/.env`:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 5. Configure Backend (Optional)
For server-side token verification, add to `server/.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Get these from **Project Settings > Service accounts > Generate new private key**

## Authentication Methods

| Method | Description |
|--------|-------------|
| 📧 Email | Traditional email/password with OTP verification |
| 📱 Phone | Firebase SMS OTP (free tier: 10K/month) |
| 🔵 Google | One-click Google account sign in |

## Free Tier Limits

- **Phone Auth**: 10,000 verifications/month
- **All other auth**: Unlimited

## Troubleshooting

**Phone OTP not working?**
- Ensure phone number includes country code: `+1234567890`
- Check if Phone auth is enabled in Firebase Console

**Google Sign-In popup blocked?**
- Add your domain to authorized domains in Firebase Console
- Check browser popup blocker settings
