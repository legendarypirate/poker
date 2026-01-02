# Production Debugging Guide for Google Sign-In Errors

## Overview
This guide helps you debug the "Google нэвтрэх амжилтгүй" (Google login failed) error that appears in production.

## Error Flow

The Google Sign-In process has two main steps:
1. **Firebase Authentication** - User authenticates with Google via Firebase
2. **Backend API Call** - User data is sent to your backend server

## How to Debug

### 1. Check Browser Console

Open the browser's Developer Tools (F12) and check the Console tab. You'll see detailed error logs:

```
[FIREBASE_AUTH] Error Details: { ... }
or
[BACKEND_API] Error Details: { ... }
```

### 2. Identify Which Step Failed

The error logs will show which step failed:

- **`step: 'firebase_auth'`** - Firebase authentication failed
- **`step: 'backend_api'`** - Backend API call failed
- **`step: 'unknown'`** - Unknown error

### 3. Common Firebase Auth Errors

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `auth/popup-closed-by-user` | User closed the popup | Normal behavior, no action needed |
| `auth/popup-blocked` | Browser blocked the popup | User needs to allow popups |
| `auth/unauthorized-domain` | Domain not authorized in Firebase | Add domain to Firebase Console |
| `auth/operation-not-allowed` | Google sign-in not enabled | Enable in Firebase Console |
| `auth/network-request-failed` | Network error | Check internet connection |
| `auth/account-exists-with-different-credential` | Email exists with different provider | User needs to use original sign-in method |

### 4. Common Backend API Errors

Check the error log for:
- **`error.response.status`** - HTTP status code (400, 401, 500, etc.)
- **`error.response.data`** - Backend error message
- **`error.config.url`** - Which API endpoint was called

Common issues:
- **401 Unauthorized** - Token or authentication issue
- **500 Internal Server Error** - Backend server error
- **Network Error** - Backend server is down or unreachable

### 5. Production Error Tracking

Errors are automatically logged with:
- Timestamp
- User agent (browser info)
- Current URL
- Error details (code, message, stack trace)
- Step that failed
- Firebase user ID (if available)

### 6. Backend Error Logging (Optional)

If you want to track errors on your backend, you can add an endpoint:

```javascript
// Backend endpoint: POST /api/logs/error
app.post('/api/logs/error', (req, res) => {
  const errorData = req.body;
  // Save to database or logging service
  console.error('Client Error:', errorData);
  res.status(200).json({ success: true });
});
```

### 7. Debugging Checklist

When the error appears in production:

- [ ] Check browser console for detailed error logs
- [ ] Identify which step failed (Firebase vs Backend)
- [ ] Check Firebase Console for domain authorization
- [ ] Verify Firebase Google Sign-In is enabled
- [ ] Check backend server logs
- [ ] Verify backend API endpoint is accessible
- [ ] Check network tab in DevTools for failed requests
- [ ] Verify CORS settings on backend
- [ ] Check if user's email domain is allowed (if restricted)

### 8. Quick Debug Commands

In browser console, you can check:

```javascript
// Check if Firebase is initialized
console.log('Firebase Auth:', window.firebase?.auth());

// Check current user
console.log('Current User:', window.firebase?.auth()?.currentUser);

// Check API URL
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
```

### 9. Environment Variables

Make sure these are set correctly in production:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_API_URL=...
```

### 10. Testing in Production

To test without affecting users:

1. Open browser DevTools
2. Go to Network tab
3. Filter by "XHR" or "Fetch"
4. Try Google Sign-In
5. Check which request fails
6. Inspect the failed request for details

## Getting Help

When reporting the issue, include:
1. Browser console error logs
2. Network tab screenshot of failed request
3. Which step failed (Firebase or Backend)
4. Error code (if available)
5. User's browser and OS
6. Timestamp of the error

