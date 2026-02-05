@echo off
echo ================================
echo Pushing WhatsApp Ordering System to GitHub
echo ================================

echo.
echo Step 1: Adding all files...
git add .

echo.
echo Step 2: Committing changes...
git commit -m "Add launch control system and fix deployment configuration - Ready for production"

echo.
echo Step 3: Pushing to GitHub...
git push origin main

echo.
echo ================================
echo ✅ Successfully pushed to GitHub!
echo ================================
echo.
echo Next steps:
echo 1. Go to https://render.com
echo 2. Create new Blueprint service
echo 3. Connect to: https://github.com/surkhettimes05-boop/whatsapp-ordering-system
echo 4. Set environment variables (see deploy-to-render.md)
echo.
pause