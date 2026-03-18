@echo off
echo =======================================================
echo          MultiShield - Zero Trust Architecture
echo =======================================================

echo [1/3] Starting Docker Infrastructure (Keycloak, API Gateway, Banking Backend)...
docker-compose up -d --build

echo.
echo [2/3] Starting ML Risk Scoring Microservice...
:: Remove old container if it exists to prevent naming conflicts
docker rm -f multishield-ml >nul 2>&1
docker run -d --name multishield-ml --network multishield-zta -p 8000:8000 multi_shield_og-ml-service

echo.
echo [3/3] Launching Frontends...
echo Starting Banking System Frontend (Port 5173)...
start cmd /k "cd dummy-banking-system\frontend && npm run dev"

echo Starting Security Platform Frontend (Port 5174)...
start cmd /k "cd security-platform\frontend && npm run dev"

echo.
echo All services are starting up! Please wait a few seconds for Keycloak to initialize.
echo =======================================================
echo Keycloak Admin: http://localhost:8080 (admin/admin)
echo Banking Portal: http://localhost:5173
echo Admin Center:   http://localhost:5174
echo ML Service:     http://localhost:8000
echo =======================================================
pause
