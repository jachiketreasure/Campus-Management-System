# Prisma Windows File Lock Issue - Resolution Guide

## Problem
When running `npm run generate` in `packages/database`, you may encounter:
```
EPERM: operation not permitted, rename '...query_engine-windows.dll.node.tmp...' -> '...query_engine-windows.dll.node'
```

This happens because Windows Defender, antivirus, or your IDE (Cursor/VS Code) is locking the Prisma query engine DLL file.

## Quick Solutions (Try in Order)

### Solution 1: Use Existing Client (If Schema Unchanged)
If you haven't changed the Prisma schema, the existing client may still work. Try using your application first.

### Solution 2: Close Cursor/IDE Temporarily
1. Close Cursor completely
2. Run: `cd packages/database && npm run generate`
3. Reopen Cursor

### Solution 3: Exclude from Windows Defender
1. Open Windows Security
2. Go to Virus & threat protection → Manage settings
3. Under Exclusions, add folder:
   `C:\Users\HomePC\Desktop\Campus-Management-System(CMS)\node_modules\.prisma`
4. Try generating again

### Solution 4: Run PowerShell as Administrator
1. Right-click PowerShell → Run as Administrator
2. Navigate to project: `cd "C:\Users\HomePC\Desktop\Campus-Management-System(CMS)\packages\database"`
3. Run: `npm run generate`

### Solution 5: Use the Workaround Script
Run the provided PowerShell script:
```powershell
cd packages/database
powershell -ExecutionPolicy Bypass -File generate-prisma.ps1
```

### Solution 6: Manual Workaround
If all else fails:
1. Run `npm run generate` (it will fail but create a temp file)
2. Find the `.tmp*` file in `node_modules\.prisma\client\`
3. Manually rename it to `query_engine-windows.dll.node` after closing Cursor

## Prevention
- Add `node_modules\.prisma` to your antivirus exclusions
- Configure Cursor to ignore `node_modules` in file watchers
- Consider using WSL2 for development if issues persist








