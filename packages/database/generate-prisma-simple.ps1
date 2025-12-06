# Prisma Generate Workaround Script (Non-Interactive)
# This script handles the Windows file locking issue with Prisma

$ErrorActionPreference = "Continue"

Write-Host "=== Prisma Client Generation Workaround ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Generating Prisma client..." -ForegroundColor Cyan
npm run generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nPrisma generate failed. Attempting workaround..." -ForegroundColor Yellow
    
    $tempFiles = Get-ChildItem -Path "..\..\node_modules\.prisma\client\query_engine-windows.dll.node.tmp*" -ErrorAction SilentlyContinue
    
    if ($tempFiles) {
        $tempFile = $tempFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        $targetPath = Resolve-Path "..\..\node_modules\.prisma\client" | Select-Object -ExpandProperty Path
        $targetFile = Join-Path $targetPath "query_engine-windows.dll.node"
        
        Write-Host "Found temp file: $($tempFile.Name)" -ForegroundColor Yellow
        
        $maxAttempts = 5
        $attempt = 0
        $success = $false
        
        while ($attempt -lt $maxAttempts -and -not $success) {
            $attempt++
            Write-Host "Attempt $attempt/$maxAttempts..." -ForegroundColor Gray
            
            if (Test-Path $targetFile) {
                Remove-Item -Path $targetFile -Force -ErrorAction SilentlyContinue
            }
            
            Start-Sleep -Milliseconds 1500
            
            try {
                Copy-Item -Path $tempFile.FullName -Destination $targetFile -Force -ErrorAction Stop
                Start-Sleep -Milliseconds 500
                if ((Test-Path $targetFile) -and ((Get-Item $targetFile).Length -gt 0)) {
                    $success = $true
                    Write-Host "Success!" -ForegroundColor Green
                }
            } catch {
                if ($attempt -lt $maxAttempts) {
                    Start-Sleep -Seconds 2
                }
            }
        }
        
        if ($success) {
            Write-Host "`n✓ Prisma client created successfully!" -ForegroundColor Green
            exit 0
        }
    }
    
    Write-Host "`n✗ Workaround failed." -ForegroundColor Red
    Write-Host "Try: 1) Close Cursor, 2) Run as Admin, 3) Exclude from Windows Defender" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "`n✓ Prisma client generated successfully!" -ForegroundColor Green
    exit 0
}








