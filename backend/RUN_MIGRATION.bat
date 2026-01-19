@echo off
echo ========================================
echo  ERP System - Data Migration to Supabase
echo ========================================
echo.
echo 1. Testing Supabase connection...
node backend/test_supabase.js
echo.
echo 2. If connection successful, press any key to continue with migration...
pause
echo.
echo 3. Running migration from SQLite to Supabase...
node backend/migrate_data.js
echo.
echo 4. Migration completed!
echo ========================================
pause
