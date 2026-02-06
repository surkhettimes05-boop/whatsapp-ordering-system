param(
    [Parameter(Mandatory=$true)]
    [string]$RepoUrl
)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Pushing to New GitHub Repository" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Repository URL: $RepoUrl" -ForegroundColor Yellow
Write-Host ""

# Remove existing remote if it exists
Write-Host "Step 1: Removing old remote (if exists)..." -ForegroundColor Yellow
git remote remove new-repo 2>$null

# Add new remote
Write-Host "Step 2: Adding new remote..." -ForegroundColor Yellow
git remote add new-repo $RepoUrl

# Commit any pending changes
Write-Host "Step 3: Committing latest changes..." -ForegroundColor Yellow
git add .
git commit -m "Complete WhatsApp ordering system with launch control - Ready for production" 2>$null

# Push to new repository
Write-Host "Step 4: Pushing to new repository..." -ForegroundColor Yellow
git push new-repo main --force

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ Successfully pushed to new repository!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "1. Go to Render.com" -ForegroundColor White
Write-Host "2. Create new Web Service (NOT Blueprint)" -ForegroundColor White
Write-Host "3. Connect to your new GitHub repository" -ForegroundColor White
Write-Host "4. Configure build settings:" -ForegroundColor White
Write-Host "   - Root Directory: backend" -ForegroundColor Cyan
Write-Host "   - Build Command: npm install && npx prisma generate" -ForegroundColor Cyan
Write-Host "   - Start Command: npx prisma migrate deploy && node src/app.js" -ForegroundColor Cyan
Write-Host "5. Set environment variables (see deploy-to-render.md)" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to continue"