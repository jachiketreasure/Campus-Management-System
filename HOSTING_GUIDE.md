# 🚀 Campus Management System - Hosting Guide

This guide provides step-by-step instructions for hosting your CMS application. We'll cover the **recommended approach** and alternative options.

## 📋 Prerequisites

- GitHub account (for code repository)
- MongoDB Atlas account (free tier available)
- Domain name (optional, but recommended)

---

## 🎯 **RECOMMENDED: Option 1 - Vercel (Frontend) + Railway (Backend)**

This is the **easiest and most reliable** option for production.

### **Part A: MongoDB Atlas Setup** (Required for all options)

1. **Create MongoDB Atlas Account**
   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for a free account
   - Create a new organization (or use default)

2. **Create a Cluster**
   - Click "Build a Database"
   - Choose **FREE (M0)** tier
   - Select a cloud provider and region (choose closest to your users)
   - Click "Create"

3. **Configure Database Access**
   - Go to "Database Access" → "Add New Database User"
   - Choose "Password" authentication
   - Username: `cms-admin` (or your choice)
   - Password: Generate a strong password (SAVE THIS!)
   - Database User Privileges: "Atlas admin"
   - Click "Add User"

4. **Configure Network Access**
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Or add specific IPs for production
   - Click "Confirm"

5. **Get Connection String**
   - Go to "Database" → "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with your database name (e.g., `cms`)
   - Example: `mongodb+srv://cms-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/cms?retryWrites=true&w=majority`
   - **SAVE THIS** - you'll need it!

---

### **Part B: Deploy Backend API to Railway**

1. **Prepare Your Code**
   ```bash
   # Make sure your code is pushed to GitHub
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub
   - Authorize Railway to access your repositories

3. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will detect your project

4. **Configure Backend Service**
   - Railway should detect `apps/api` folder
   - If not, click "Add Service" → "GitHub Repo" → Select your repo
   - Set **Root Directory** to `apps/api`
   - Set **Build Command** to: `npm install && npm run build`
   - Set **Start Command** to: `npm start`

5. **Add Environment Variables**
   - Go to your service → "Variables" tab
   - Add these variables:
   
   ```
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=your_mongodb_connection_string_from_atlas
   NEXTAUTH_SECRET=generate_a_random_secret_here
   NEXTAUTH_URL=https://your-frontend-domain.vercel.app
   CORS_ORIGIN=https://your-frontend-domain.vercel.app
   ```
   
   **Generate NEXTAUTH_SECRET:**
   ```bash
   # Run this in terminal:
   openssl rand -base64 32
   ```
   
   Or use: https://generate-secret.vercel.app/32

6. **Deploy**
   - Railway will automatically deploy
   - Wait for deployment to complete
   - Copy the **public URL** (e.g., `https://your-api.railway.app`)
   - **SAVE THIS URL** - you'll need it for frontend!

---

### **Part C: Deploy Frontend to Vercel**

1. **Create Vercel Account**
   - Go to https://vercel.com
   - Sign up with GitHub
   - Authorize Vercel to access your repositories

2. **Import Project**
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

3. **Configure Project Settings**
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/web`
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install`

4. **Add Environment Variables**
   - Go to "Environment Variables"
   - Add these variables:
   
   ```
   NODE_ENV=production
   NEXTAUTH_URL=https://your-project.vercel.app
   NEXTAUTH_SECRET=same_secret_as_backend
   NEXT_PUBLIC_API_BASE_URL=https://your-api.railway.app
   NEXT_PUBLIC_API_URL=https://your-api.railway.app/api
   DATABASE_URL=your_mongodb_connection_string
   ```
   
   **Important:** Use the **same NEXTAUTH_SECRET** as your backend!

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (5-10 minutes)
   - Your site will be live at `https://your-project.vercel.app`

6. **Update Backend CORS**
   - Go back to Railway
   - Update `CORS_ORIGIN` to your Vercel URL
   - Redeploy backend if needed

---

## 🔄 **Alternative: Option 2 - Railway (Everything)**

Deploy both frontend and backend on Railway.

### Steps:

1. **Follow Part A** (MongoDB Atlas setup)

2. **Deploy Backend** (same as Part B above)

3. **Deploy Frontend on Railway**
   - In Railway, click "New Service"
   - Select your GitHub repo
   - Set **Root Directory** to `apps/web`
   - Set **Build Command** to: `npm install && npm run build`
   - Set **Start Command** to: `npm start`
   - Add environment variables (same as Vercel)
   - Railway will give you a URL for frontend

4. **Update Environment Variables**
   - Update `NEXTAUTH_URL` to Railway frontend URL
   - Update `CORS_ORIGIN` in backend to Railway frontend URL

---

## 🔄 **Alternative: Option 3 - Render (Everything)**

Similar to Railway but different platform.

### Steps:

1. **Follow Part A** (MongoDB Atlas setup)

2. **Create Render Account**
   - Go to https://render.com
   - Sign up with GitHub

3. **Deploy Backend**
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     - **Name:** `cms-api`
     - **Root Directory:** `apps/api`
     - **Environment:** Node
     - **Build Command:** `npm install && npm run build`
     - **Start Command:** `npm start`
   - Add environment variables (same as Railway)
   - Click "Create Web Service"

4. **Deploy Frontend**
   - Click "New" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     - **Name:** `cms-web`
     - **Root Directory:** `apps/web`
     - **Environment:** Node
     - **Build Command:** `npm install && npm run build`
     - **Start Command:** `npm start`
   - Add environment variables
   - Click "Create Web Service"

---

## ✅ **Post-Deployment Checklist**

After deployment, verify:

1. **Frontend is accessible**
   - Visit your Vercel/Railway/Render URL
   - Should see login page

2. **Backend is accessible**
   - Visit `https://your-api-url/health` (if you have health endpoint)
   - Should return 200 OK

3. **Database Connection**
   - Try logging in
   - Check if data is being saved

4. **Environment Variables**
   - Verify all variables are set correctly
   - Check logs for any missing variables

---

## 🔧 **Troubleshooting**

### Issue: "Database connection failed"
- **Solution:** Check MongoDB Atlas connection string
- Verify network access allows your hosting IPs
- Check database user credentials

### Issue: "CORS error"
- **Solution:** Update `CORS_ORIGIN` in backend to match frontend URL exactly
- Include protocol (https://) and no trailing slash

### Issue: "NEXTAUTH_SECRET missing"
- **Solution:** Ensure same secret is set in both frontend and backend
- Generate new secret if needed

### Issue: "Build fails"
- **Solution:** Check build logs for specific errors
- Ensure all dependencies are in package.json
- Verify Node.js version compatibility

### Issue: "API calls fail"
- **Solution:** Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- Check backend logs for errors
- Ensure backend is running and accessible

---

## 📝 **Environment Variables Reference**

### Backend (Railway/Render)
```
NODE_ENV=production
PORT=4000
DATABASE_URL=mongodb+srv://...
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=https://your-frontend-url
CORS_ORIGIN=https://your-frontend-url
```

### Frontend (Vercel/Railway/Render)
```
NODE_ENV=production
NEXTAUTH_URL=https://your-frontend-url
NEXTAUTH_SECRET=same_as_backend
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url
NEXT_PUBLIC_API_URL=https://your-backend-url/api
DATABASE_URL=mongodb+srv://...
```

---

## 🎉 **You're Done!**

Your Campus Management System should now be live and accessible to users worldwide!

**Next Steps:**
- Set up custom domain (optional)
- Configure SSL certificates (usually automatic)
- Set up monitoring and alerts
- Configure backups for database

---

## 📞 **Need Help?**

If you encounter issues:
1. Check deployment logs
2. Verify all environment variables
3. Test database connection
4. Check CORS settings
5. Review error messages in browser console
