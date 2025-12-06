# Prisma Generate Workaround Script
# This script handles the Windows file locking issue with Prisma

$ErrorActionPreference = "Continue"

Write-Host "=== Prisma Client Generation Workaround ===" -ForegroundColor Cyan
Write-Host ""

# Check if file already exists and is valid
$targetFile = "..\..\node_modules\.prisma\client\query_engine-windows.dll.node"
if (Test-Path $targetFile) {
    $fileInfo = Get-Item $targetFile
    Write-Host "Existing Prisma client found:" -ForegroundColor Yellow
    Write-Host "  Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Gray
    Write-Host "  Last Modified: $($fileInfo.LastWriteTime)" -ForegroundColor Gray
    Write-Host ""
    $useExisting = Read-Host "Use existing client? (Y/N) [Default: N]"
    if ($useExisting -eq "Y" -or $useExisting -eq "y") {
        Write-Host "`nSkipping generation. Using existing client." -ForegroundColor Green
        exit 0
    }
}

Write-Host "Generating Prisma client..." -ForegroundColor Cyan
Write-Host ""

# Run prisma generate
npm run generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nPrisma generate failed with file lock error." -ForegroundColor Yellow
    Write-Host "Attempting workaround..." -ForegroundColor Yellow
    Write-Host ""
    
    # Find the temporary DLL file
    $tempFiles = Get-ChildItem -Path "..\..\node_modules\.prisma\client\query_engine-windows.dll.node.tmp*" -ErrorAction SilentlyContinue
    
    if ($tempFiles) {
        $tempFile = $tempFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        $targetPath = Resolve-Path "..\..\node_modules\.prisma\client" | Select-Object -ExpandProperty Path
        $targetFile = Join-Path $targetPath "query_engine-windows.dll.node"
        
        Write-Host "Found temporary file: $($tempFile.FullName)" -ForegroundColor Yellow
        Write-Host "Target location: $targetFile" -ForegroundColor Yellow
        Write-Host ""
        
        # Try multiple times with delays
        $maxAttempts = 5
        $attempt = 0
        $success = $false
        
        while ($attempt -lt $maxAttempts -and -not $success) {
            $attempt++
            Write-Host "Attempt $attempt of $maxAttempts..." -ForegroundColor Gray
            
            # Remove existing target if it exists
            if (Test-Path $targetFile) {
                try {
                    Remove-Item -Path $targetFile -Force -ErrorAction Stop
                    Write-Host "  Removed existing file" -ForegroundColor Gray
                } catch {
                    Write-Host "  Could not remove existing file (may be locked)" -ForegroundColor Yellow
                }
            }
            
            Start-Sleep -Milliseconds 1000
            
            # Try to copy temp file to target
            try {
                Copy-Item -Path $tempFile.FullName -Destination $targetFile -Force -ErrorAction Stop
                Start-Sleep -Milliseconds 500
                
                if (Test-Path $targetFile) {
                    $newFile = Get-Item $targetFile
                    if ($newFile.Length -gt 0) {
                        $success = $true
                        Write-Host "  Successfully copied file!" -ForegroundColor Green
                    }
                }
            } catch {
                Write-Host "  Copy failed: $($_.Exception.Message)" -ForegroundColor Red
                if ($attempt -lt $maxAttempts) {
                    Write-Host "  Waiting before retry..." -ForegroundColor Gray
                    Start-Sleep -Seconds 2
                }
            }
        }
        
        if ($success) {
            Write-Host "`n✓ Successfully created Prisma client using workaround!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Recommendations to prevent future issues:" -ForegroundColor Yellow
            Write-Host "  1. Exclude node_modules\.prisma from Windows Defender" -ForegroundColor Gray
            Write-Host "  2. Close Cursor/IDE before generating" -ForegroundColor Gray
            Write-Host "  3. Run PowerShell as Administrator" -ForegroundColor Gray
            exit 0
        } else {
            Write-Host "`n✗ Workaround failed after $maxAttempts attempts." -ForegroundColor Red
            Write-Host ""
            Write-Host "Please try one of these solutions:" -ForegroundColor Yellow
            Write-Host "  1. Close Cursor completely and try again" -ForegroundColor White
            Write-Host "  2. Run PowerShell as Administrator" -ForegroundColor White
            Write-Host "  3. Exclude the project folder from Windows Defender/antivirus" -ForegroundColor White
            Write-Host "  4. See PRISMA_WINDOWS_FIX.md for detailed instructions" -ForegroundColor White
            exit 1
        }
    } else {
        Write-Host "✗ No temporary file found. The error may be different." -ForegroundColor Red
        Write-Host "  Check the error message above for details." -ForegroundColor Gray
        exit 1
    }
} else {
    Write-Host "`n✓ Prisma client generated successfully!" -ForegroundColor Green
    exit 0
}

