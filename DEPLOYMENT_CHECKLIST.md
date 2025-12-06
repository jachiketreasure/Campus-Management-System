# ✅ Deployment Checklist

Use this checklist to ensure everything is configured correctly before and after deployment.

## Pre-Deployment

### Code Preparation
- [ ] All code is committed to GitHub
- [ ] No sensitive data in code (use environment variables)
- [ ] `.env` files are in `.gitignore`
- [ ] All dependencies are in `package.json`
- [ ] Build commands work locally (`npm run build`)

### Database Setup
- [ ] MongoDB Atlas account created
- [ ] Database cluster created
- [ ] Database user created with password
- [ ] Network access configured (IP whitelist)
- [ ] Connection string saved securely

### Environment Variables Prepared
- [ ] `DATABASE_URL` - MongoDB connection string
- [ ] `NEXTAUTH_SECRET` - Generated secure random string
- [ ] `NEXTAUTH_URL` - Frontend URL (update after deployment)
- [ ] `NEXT_PUBLIC_API_BASE_URL` - Backend URL (update after deployment)
- [ ] `CORS_ORIGIN` - Frontend URL for backend

---

## Backend Deployment

### Railway/Render Setup
- [ ] Account created and linked to GitHub
- [ ] New project/service created
- [ ] Root directory set to `apps/api`
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`
- [ ] All environment variables added
- [ ] Deployment successful
- [ ] Backend URL copied and saved

### Backend Verification
- [ ] Backend URL is accessible
- [ ] Health endpoint works (if available)
- [ ] No errors in deployment logs
- [ ] Database connection successful

---

## Frontend Deployment

### Vercel/Railway/Render Setup
- [ ] Account created and linked to GitHub
- [ ] Project imported from GitHub
- [ ] Root directory set to `apps/web`
- [ ] Build command: `npm install && npm run build`
- [ ] All environment variables added
- [ ] `NEXT_PUBLIC_API_BASE_URL` points to backend URL
- [ ] `NEXTAUTH_URL` points to frontend URL
- [ ] Deployment successful
- [ ] Frontend URL copied and saved

### Frontend Verification
- [ ] Frontend URL is accessible
- [ ] Login page loads correctly
- [ ] No console errors
- [ ] API calls work (check Network tab)

---

## Post-Deployment

### Configuration Updates
- [ ] Update backend `CORS_ORIGIN` with frontend URL
- [ ] Update backend `NEXTAUTH_URL` with frontend URL
- [ ] Redeploy backend if needed
- [ ] Verify frontend can communicate with backend

### Functionality Testing
- [ ] User registration works
- [ ] User login works
- [ ] Dashboard loads correctly
- [ ] Attendance features work
- [ ] Database writes/reads work
- [ ] File uploads work (if applicable)
- [ ] Email sending works (if applicable)

### Security Checks
- [ ] HTTPS is enabled (automatic on Vercel/Railway/Render)
- [ ] Environment variables are not exposed
- [ ] Database credentials are secure
- [ ] CORS is properly configured
- [ ] No sensitive data in client-side code

### Performance Checks
- [ ] Page load times are acceptable
- [ ] API response times are good
- [ ] Images/assets load correctly
- [ ] No memory leaks in logs

---

## Monitoring Setup

### Logs
- [ ] Backend logs are accessible
- [ ] Frontend logs are accessible
- [ ] Error tracking is set up (optional)

### Alerts (Optional)
- [ ] Uptime monitoring configured
- [ ] Error alerts set up
- [ ] Performance monitoring enabled

---

## Documentation

### For Team
- [ ] Deployment URLs documented
- [ ] Environment variables documented
- [ ] Access credentials saved securely
- [ ] Deployment process documented

### For Users
- [ ] User guide updated (if applicable)
- [ ] Support contact information available

---

## Backup & Recovery

### Database
- [ ] MongoDB Atlas backups enabled
- [ ] Backup schedule configured
- [ ] Recovery process tested

### Code
- [ ] Code is in version control (GitHub)
- [ ] Important branches protected
- [ ] Deployment rollback process known

---

## Final Verification

- [ ] All features work in production
- [ ] No critical errors in logs
- [ ] Performance is acceptable
- [ ] Security measures in place
- [ ] Team has access to necessary tools
- [ ] Documentation is complete

---

## 🎉 Ready for Production!

Once all items are checked, your application is ready for users!
