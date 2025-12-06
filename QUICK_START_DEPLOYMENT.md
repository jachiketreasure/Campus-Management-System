# ⚡ Quick Start: Deploy Your CMS in 30 Minutes

This is a condensed version of the full hosting guide. Follow these steps in order.

## 🎯 Recommended Setup: Vercel + Railway + MongoDB Atlas

---

## Step 1: MongoDB Atlas (5 minutes)

1. Go to https://www.mongodb.com/cloud/atlas → Sign up
2. Create **FREE M0 cluster** (choose closest region)
3. **Database Access:** Create user `cms-admin` with password (SAVE IT!)
4. **Network Access:** Click "Allow Access from Anywhere"
5. **Connect:** Copy connection string, replace `<password>` and `<dbname>`
   - Example: `mongodb+srv://cms-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/cms?retryWrites=true&w=majority`

✅ **You now have:** `DATABASE_URL`

---

## Step 2: Generate Secret (1 minute)

Run in terminal:
```bash
openssl rand -base64 32
```

Or visit: https://generate-secret.vercel.app/32

✅ **You now have:** `NEXTAUTH_SECRET`

---

## Step 3: Deploy Backend to Railway (10 minutes)

1. Go to https://railway.app → Sign up with GitHub
2. **New Project** → **Deploy from GitHub repo** → Select your repo
3. **Add Service** → Select your repo again
4. **Settings:**
   - Root Directory: `apps/api`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
5. **Variables tab** → Add:
   ```
   NODE_ENV=production
   PORT=4000
   DATABASE_URL=your_mongodb_connection_string
   NEXTAUTH_SECRET=your_generated_secret
   NEXTAUTH_URL=https://placeholder.vercel.app (update later)
   CORS_ORIGIN=https://placeholder.vercel.app (update later)
   ```
6. Wait for deployment → Copy the **public URL**

✅ **You now have:** Backend URL (e.g., `https://your-api.railway.app`)

---

## Step 4: Deploy Frontend to Vercel (10 minutes)

1. Go to https://vercel.com → Sign up with GitHub
2. **Add New** → **Project** → Import your repo
3. **Configure:**
   - Framework Preset: Next.js
   - Root Directory: `apps/web`
   - Build Command: `npm install && npm run build`
4. **Environment Variables:**
   ```
   NODE_ENV=production
   NEXTAUTH_URL=https://your-project.vercel.app (will update after deploy)
   NEXTAUTH_SECRET=same_secret_as_backend
   NEXT_PUBLIC_API_BASE_URL=https://your-api.railway.app
   DATABASE_URL=your_mongodb_connection_string
   ```
5. Click **Deploy** → Wait 5-10 minutes → Copy the **URL**

✅ **You now have:** Frontend URL (e.g., `https://your-project.vercel.app`)

---

## Step 5: Update Configuration (5 minutes)

### Update Backend (Railway):
1. Go back to Railway → Your backend service → Variables
2. Update:
   - `NEXTAUTH_URL` = your Vercel frontend URL
   - `CORS_ORIGIN` = your Vercel frontend URL
3. Railway will auto-redeploy

### Update Frontend (Vercel):
1. Go to Vercel → Your project → Settings → Environment Variables
2. Update:
   - `NEXTAUTH_URL` = your Vercel frontend URL
3. Redeploy (or wait for auto-redeploy)

---

## Step 6: Test Everything ✅

1. **Visit your frontend URL** → Should see login page
2. **Try to register/login** → Should work
3. **Check browser console** → No errors
4. **Test attendance features** → Should work
5. **Check Railway logs** → No errors

---

## 🎉 Done!

Your CMS is now live! Share the frontend URL with your users.

---

## 📚 Need More Details?

- **Full Guide:** See `HOSTING_GUIDE.md`
- **Checklist:** See `DEPLOYMENT_CHECKLIST.md`
- **Environment Variables:** See `ENV_VARIABLES_REFERENCE.md`

---

## 🆘 Troubleshooting

**"Can't connect to database"**
→ Check MongoDB Atlas network access allows all IPs

**"CORS error"**
→ Verify `CORS_ORIGIN` in backend matches frontend URL exactly

**"Build fails"**
→ Check build logs for specific errors

**"API calls fail"**
→ Verify `NEXT_PUBLIC_API_BASE_URL` is correct

---

## 💰 Cost Estimate

- **MongoDB Atlas:** FREE (up to 512MB)
- **Vercel:** FREE (hobby plan)
- **Railway:** FREE trial, then ~$5/month
- **Total:** ~$5/month or FREE (with free tier limits)

---

## 🔄 Alternative: Everything on Railway

If you prefer one platform:

1. Follow Step 1 (MongoDB)
2. Deploy backend to Railway (Step 3)
3. Deploy frontend to Railway (same as backend, but root = `apps/web`)
4. Update variables with Railway URLs
5. Done!

Same process, just use Railway for both services.
