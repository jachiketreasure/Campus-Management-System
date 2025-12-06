# Fix Prisma Generate Permission Error on Windows

## Problem
Windows file locking prevents Prisma from generating the client because a Node.js process has the query engine file locked.

## Solution Steps

### Option 1: Manual Fix (Recommended)
1. **Close all running dev servers:**
   - Stop any `npm run dev:web` or `npm run dev:api` processes
   - Close Cursor/VS Code if it's running the app
   - Close any terminal windows running Node processes

2. **Try generating again:**
   ```bash
   cd packages/database
   npx prisma generate
   ```

### Option 2: Force Clean and Regenerate
1. **Stop all Node processes:**
   - Open Task Manager (Ctrl+Shift+Esc)
   - End all Node.js processes

2. **Delete Prisma cache:**
   ```powershell
   cd "C:\Users\HomePC\Desktop\Campus-Management-System(CMS)"
   Remove-Item -Path "node_modules\.prisma" -Recurse -Force
   ```

3. **Generate Prisma client:**
   ```bash
   npm run generate --workspace @cms/database
   ```

### Option 3: Run as Administrator
1. Right-click PowerShell/Command Prompt
2. Select "Run as Administrator"
3. Navigate to your project
4. Run: `npm run generate --workspace @cms/database`

### Option 4: After Schema Changes (If Above Doesn't Work)
If you just updated the schema and need to push changes:

1. **Push schema to database (skips generation):**
   ```bash
   cd packages/database
   npx prisma db push
   ```

2. **Then generate client:**
   ```bash
   npx prisma generate
   ```

## After Successful Generation

Once Prisma generates successfully, run:
```bash
cd packages/database
npx prisma db push
```

This will apply your new schema changes (ExamIntegrity, ExamAttempt, ExamNotification models) to MongoDB.

