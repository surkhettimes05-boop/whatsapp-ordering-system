Write-Host "================================" -ForegroundColor Cyan
Write-Host "Pushing WhatsApp Ordering System to GitHub" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Step 1: Adding all files..." -ForegroundColor Yellow
git add .

Write-Host ""
Write-Host "Step 2: Committing changes..." -ForegroundColor Yellow
git commit -m "Add launch control system and fix deployment configuration - Ready for production"

Write-Host ""
Write-Host "Step 3: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Go to https://render.com" -ForegroundColor White
Write-Host "2. Create new Blueprint service" -ForegroundColor White
Write-Host "3. Connect to: https://github.com/surkhettimes05-boop/whatsapp-ordering-system" -ForegroundColor White
Write-Host "4. Set environment variables (see deploy-to-render.md)" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to continue"