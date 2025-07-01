@echo off
echo ========================================
echo  إعداد نظام تحليل الجفر الذكي
echo ========================================

:: Check if Node.js is installed
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo خطأ: يرجى تثبيت Node.js (الإصدار 16 أو أحدث) أولاً
    echo يمكنك تحميله من: https://nodejs.org/
    pause
    exit /b 1
)

:: Install dependencies
echo.
echo جاري تثبيت الحزم المطلوبة...
npm install

if %ERRORLEVEL% neq 0 (
    echo.
    echo حدث خطأ أثناء تثبيت الحزم المطلوبة
    pause
    exit /b 1
)

:: Create .env file if it doesn't exist
if not exist .env (
    echo.
    echo جاري إنشاء ملف الإعدادات...
    echo PORT=3000 > .env
    echo NODE_ENV=development >> .env
    echo # قم بإضافة مفاتيح API الأخرى هنا >> .env
    echo تم إنشاء ملف .env بنجاح
)

echo.
echo ========================================
echo تم إعداد النظام بنجاح!
echo.
echo لبدء التطبيق، قم بتشغيل:
echo    npm run dev
echo.
echo ثم افتح المتصفح على العنوان:
echo    http://localhost:3000
echo.
echo ========================================
pause
