# Image Upload Route 404 Solution

## Problem

When trying to upload an image, the following error appeared:

```
GET /api/api/upload 404
```

This means the frontend was making a request to `/api/api/upload`, but the backend does not have this route, resulting in a 404 Not Found error.

## Root Cause

- The upload URL was being constructed as `${VITE_API_URL}/api/upload`.
- The `.env` file had `VITE_API_URL` set to `http://localhost:3000/api` (or `/api`), so the final URL became `/api/api/upload`.
- The backend expects the upload route to be `/api/upload`, not `/api/api/upload`.

## Solution

**Step 1:**
Set `VITE_API_URL` to an empty string in your `.env` file:

```env
VITE_API_URL=
```

**Step 2:**
Restart your frontend development server to apply the new environment variable.

**Step 3:**
Now, the upload URL will correctly resolve to `/api/upload` and the backend will handle the request as expected.

## Summary Table

| Before                | After           |
|-----------------------|----------------|
| VITE_API_URL=/api     | VITE_API_URL=  |
| Uploads to /api/api/upload | Uploads to /api/upload |
| 404 Not Found         | ✅ Works!       |

## Additional Notes
- If you deploy to production, ensure your environment variables are set correctly for your deployment environment.
- If you use a proxy in `vite.config.js`, you can keep `VITE_API_URL` empty for all API calls that start with `/api`.

---

**This fix ensures that image uploads work and the correct backend route is called.**
