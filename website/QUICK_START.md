# Quick Start Guide - Khaacho Website

## Start the Development Server

### Option 1: Using PowerShell Script
```powershell
cd website
.\start-dev.ps1
```

### Option 2: Manual Start
```powershell
cd website
npm install  # Only needed first time
npm run dev
```

### Option 3: Using Command Prompt
```cmd
cd website
npm install  # Only needed first time
npm run dev
```

## Access the Website

Once the server starts, open your browser and go to:

**Main URL:** http://localhost:3000

## All Available Pages

1. **Home Page:** http://localhost:3000/
2. **How It Works:** http://localhost:3000/how-it-works
3. **For Retailers:** http://localhost:3000/for-retailers
4. **For Wholesalers:** http://localhost:3000/for-wholesalers
5. **Credit & Records:** http://localhost:3000/credit-records
6. **About:** http://localhost:3000/about
7. **Contact:** http://localhost:3000/contact

## Troubleshooting

### If links don't work:

1. **Check if server is running:**
   - Look for "Ready" message in terminal
   - Check for any error messages

2. **Clear cache and restart:**
   ```powershell
   # Stop the server (Ctrl+C)
   # Delete .next folder
   Remove-Item -Recurse -Force .next
   # Restart
   npm run dev
   ```

3. **Check browser console:**
   - Press F12 to open developer tools
   - Look for any JavaScript errors in Console tab

4. **Verify all files exist:**
   - Make sure all page.tsx files are in the app folder
   - Check that components folder has all required files

## Common Issues

### Port 3000 already in use
```powershell
# Find and kill process on port 3000
netstat -ano | findstr :3000
# Use the PID from above command
taskkill /PID <PID> /F
```

### Module not found errors
```powershell
# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install
```

### TypeScript errors
```powershell
# Check for TypeScript errors
npm run lint
```

## Need Help?

If links still don't work:
1. Check the terminal for compilation errors
2. Open browser developer tools (F12) and check Console tab
3. Verify you're accessing http://localhost:3000 (not https)
4. Try a hard refresh (Ctrl+Shift+R or Ctrl+F5)

