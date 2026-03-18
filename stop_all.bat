@echo off
echo =======================================================
echo          MultiShield - Stopping All Services
echo =======================================================

echo [1/3] Stopping Docker Infrastructure (Compose)...
docker compose down

echo.
echo [2/3] Stopping ML Risk Service container...
docker stop multishield-ml >nul 2>&1
docker rm -f multishield-ml >nul 2>&1

echo.
echo [3/3] Terminating Frontend Processes (Vite)...
:: Terminate any running Node processes that might be Vite/Frontend
taskkill /F /IM node.exe /T >nul 2>&1

echo.
echo Everything has been stopped successfully!
echo =======================================================
pause
