# QuickAlert Backend - Environment Setup Guide

This guide will help you set up all the required environment variables for the QuickAlert backend API.

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MongoDB (local or cloud)
- Cloudinary account (free tier available)

---

## 🚀 Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Follow the sections below to fill in each variable.

---

## 🔐 Authentication Keys

These keys are generated locally using Node.js crypto module. **Do not share these keys publicly.**

### Generate All Keys at Once

Run this command in your terminal:

```bash
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"
echo "JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"
echo "ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo "HMAC_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
```

### Individual Key Generation

| Variable | Command | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | Used for signing JWT access tokens |
| `JWT_REFRESH_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | Used for signing JWT refresh tokens |
| `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | AES-256 encryption key (64 hex characters) |
| `HMAC_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Used for data integrity verification |

---

## 🗄️ MongoDB Setup

### Option 1: Local MongoDB

If you have MongoDB installed locally:

```env
MONGODB_URI=mongodb://localhost:27017/quickalert
```

### Option 2: MongoDB Atlas (Cloud - Free Tier)

1. **Create Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
   - Sign up for a free account

2. **Create a Cluster**
   - Click "Build a Database"
   - Select "FREE" tier (M0 Sandbox)
   - Choose your preferred cloud provider and region
   - Click "Create Cluster"

3. **Set Up Database Access**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Create a username and password (save these!)
   - Set privileges to "Read and write to any database"

4. **Set Up Network Access**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add your specific server IP

5. **Get Connection String**
   - Go to "Database" → Click "Connect" on your cluster
   - Select "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `myFirstDatabase` with `quickalert`

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/quickalert?retryWrites=true&w=majority
```

---

## 📸 Cloudinary Setup (Image/Video Uploads)

Cloudinary provides free tier with 25GB storage and 25GB bandwidth/month.

### Steps to Get Credentials

1. **Create Account**
   - Go to [Cloudinary Sign Up](https://cloudinary.com/users/register_free)
   - Sign up with email or Google/GitHub

2. **Access Dashboard**
   - After login, go to [Cloudinary Dashboard](https://cloudinary.com/console)
   - You'll see your credentials displayed:

   ![Cloudinary Dashboard](https://res.cloudinary.com/demo/image/upload/v1/docs/cloudinary_dashboard.png)

3. **Copy Credentials**
   
   | Variable | Location on Dashboard |
   |----------|----------------------|
   | `CLOUDINARY_CLOUD_NAME` | "Cloud Name" field |
   | `CLOUDINARY_API_KEY` | "API Key" field |
   | `CLOUDINARY_API_SECRET` | "API Secret" field (click to reveal) |

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz
```

---

## ⚙️ Server Configuration

These are basic configuration values:

```env
# Server Configuration
NODE_ENV=development          # Options: development, production, test
PORT=5000                     # Server port

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000    # Your frontend URL

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000         # 15 minutes in milliseconds
RATE_LIMIT_MAX_REQUESTS=100         # Max requests per window

# Logging
LOG_LEVEL=info                      # Options: error, warn, info, debug
```

---

## 📝 Complete .env Example

Here's a complete example with placeholder values:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/quickalert

# JWT Configuration
JWT_SECRET=your-generated-jwt-secret-here
JWT_REFRESH_SECRET=your-generated-refresh-secret-here
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# Encryption (AES-256)
ENCRYPTION_KEY=your-generated-64-char-hex-key-here
ENCRYPTION_SALT=quickalert-encryption-salt

# HMAC Secret (for data integrity)
HMAC_SECRET=your-generated-hmac-secret-here

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Client URL (for CORS)
CLIENT_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

---

## 🔗 Quick Links

| Service | Sign Up | Dashboard |
|---------|---------|-----------|
| MongoDB Atlas | [Register](https://www.mongodb.com/cloud/atlas/register) | [Dashboard](https://cloud.mongodb.com/) |
| Cloudinary | [Register](https://cloudinary.com/users/register_free) | [Console](https://cloudinary.com/console) |

---

## ✅ Verification

After setting up your `.env` file, verify the setup:

```bash
# Install dependencies (if not done)
npm install

# Start the server
npm run dev

# You should see:
# ╔══════════════════════════════════════════════╗
# ║   QuickAlert API Server                      ║
# ║   Running on port 5000                       ║
# ║   Environment: development                   ║
# ╚══════════════════════════════════════════════╝
# MongoDB Connected: localhost (or your Atlas cluster)
```

Test the health endpoint:
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "success": true,
  "message": "QuickAlert API is running",
  "timestamp": "2024-12-13T...",
  "environment": "development"
}
```

---

## 🔒 Security Notes

1. **Never commit `.env` to version control** - It's already in `.gitignore`
2. **Use different keys for production** - Generate new keys for each environment
3. **Restrict MongoDB network access** - In production, only allow your server's IP
4. **Rotate keys periodically** - Especially if you suspect they've been compromised

---

## ❓ Troubleshooting

### MongoDB Connection Failed
- Check if MongoDB is running locally: `mongod --version`
- Verify your Atlas IP whitelist includes your current IP
- Ensure username/password are correct (no special characters issues)

### Cloudinary Upload Failed
- Verify all three credentials are correct
- Check if your Cloudinary account is active
- Ensure you haven't exceeded free tier limits

### JWT Errors
- Make sure `JWT_SECRET` is set and not empty
- Ensure the secret is the same across server restarts

---

## 📞 Support

If you encounter issues:
1. Check the [GitHub Issues](https://github.com/hitarth2123/QuickAlert/issues)
2. Create a new issue with your error logs (remove sensitive data!)
