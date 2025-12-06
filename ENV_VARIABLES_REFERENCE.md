# 🔐 Environment Variables Reference

Complete reference for all environment variables needed for deployment.

## 📋 Quick Reference

### Backend (Railway/Render)
```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/cms?retryWrites=true&w=majority
NEXTAUTH_SECRET=your_generated_secret_here
NEXTAUTH_URL=https://your-frontend.vercel.app
CORS_ORIGIN=https://your-frontend.vercel.app
```

### Frontend (Vercel/Railway/Render)
```bash
NODE_ENV=production
NEXTAUTH_URL=https://your-frontend.vercel.app
NEXTAUTH_SECRET=same_as_backend_secret
NEXT_PUBLIC_API_BASE_URL=https://your-backend.railway.app
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/cms?retryWrites=true&w=majority
```

---

## 🔑 Variable Descriptions

### `NODE_ENV`
- **Required:** Yes
- **Value:** `production`
- **Description:** Sets Node.js environment to production mode
- **Where:** Both frontend and backend

### `PORT`
- **Required:** Backend only
- **Value:** `4000` (or auto-assigned by platform)
- **Description:** Port for backend API server
- **Where:** Backend only

### `DATABASE_URL`
- **Required:** Yes
- **Format:** `mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority`
- **Description:** MongoDB Atlas connection string
- **Where:** Both frontend and backend
- **How to get:** MongoDB Atlas → Connect → Connect your application

### `NEXTAUTH_SECRET`
- **Required:** Yes
- **Format:** Random base64 string (minimum 32 characters)
- **Description:** Secret key for NextAuth session encryption
- **Where:** Both frontend and backend (MUST BE IDENTICAL)
- **How to generate:**
  ```bash
  openssl rand -base64 32
  ```
  Or visit: https://generate-secret.vercel.app/32

### `NEXTAUTH_URL`
- **Required:** Yes
- **Format:** `https://your-frontend-domain.com`
- **Description:** Public URL of your frontend application
- **Where:** Both frontend and backend
- **Note:** No trailing slash!

### `NEXT_PUBLIC_API_BASE_URL`
- **Required:** Yes (Frontend only)
- **Format:** `https://your-backend-domain.com`
- **Description:** Public URL of your backend API
- **Where:** Frontend only
- **Note:** No trailing slash, no `/api` suffix

### `NEXT_PUBLIC_API_URL`
- **Required:** Optional (Frontend only)
- **Format:** `https://your-backend-domain.com/api`
- **Description:** Alternative API URL format
- **Where:** Frontend only
- **Note:** Only if your code uses this variable

### `CORS_ORIGIN`
- **Required:** Yes (Backend only)
- **Format:** `https://your-frontend-domain.com`
- **Description:** Allowed origin for CORS requests
- **Where:** Backend only
- **Note:** Must match frontend URL exactly

---

## 🚀 Deployment Order

1. **Deploy Backend First**
   - Set all backend variables
   - Get backend URL
   - Test backend is accessible

2. **Deploy Frontend Second**
   - Use backend URL in `NEXT_PUBLIC_API_BASE_URL`
   - Set frontend URL in `NEXTAUTH_URL`
   - Get frontend URL

3. **Update Backend**
   - Update `CORS_ORIGIN` with frontend URL
   - Update `NEXTAUTH_URL` with frontend URL
   - Redeploy backend

---

## ✅ Verification Checklist

After setting variables, verify:

- [ ] All variables are set (no empty values)
- [ ] `NEXTAUTH_SECRET` is identical in both
- [ ] URLs have no trailing slashes
- [ ] URLs use `https://` (not `http://`)
- [ ] `DATABASE_URL` includes password
- [ ] `CORS_ORIGIN` matches frontend URL exactly

---

## 🔒 Security Notes

1. **Never commit `.env` files to git**
2. **Use different secrets for development and production**
3. **Rotate secrets periodically**
4. **Use strong database passwords**
5. **Limit MongoDB network access to hosting IPs in production**

---

## 🆘 Common Issues

### "NEXTAUTH_SECRET missing"
- Ensure variable is set in both frontend and backend
- Check for typos in variable name
- Verify it's the same value in both

### "CORS error"
- Verify `CORS_ORIGIN` matches frontend URL exactly
- Check for trailing slashes
- Ensure protocol matches (`https://`)

### "Database connection failed"
- Verify `DATABASE_URL` is correct
- Check MongoDB Atlas network access
- Verify database user credentials

### "API calls fail"
- Check `NEXT_PUBLIC_API_BASE_URL` is correct
- Verify backend is running
- Check backend logs for errors
