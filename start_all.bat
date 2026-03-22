@echo off
echo =======================================================
echo          MultiShield - Zero Trust Architecture
echo =======================================================

echo [1/2] Starting Docker Infrastructure (Keycloak, ML Service, ZTA Gateway, Banking Backend)...
docker-compose up -d --build

echo.
echo [2/2] Launching Frontends...
echo Starting Banking System Frontend (Port 5173)...
start cmd /k "cd dummy-banking-system\frontend && npm run dev"

echo Starting Security Platform Frontend (Port 5174)...
start cmd /k "cd security-platform\frontend && npm run dev"

echo.
echo All services are starting up!
echo IMPORTANT: Please wait ~45 seconds for Keycloak to initialize before logging in.
echo 🛡️  ZTA Health Check: http://localhost:3002/api/health
echo =======================================================
echo Keycloak Admin: http://localhost:8080 (admin/admin)
echo Banking Portal: http://localhost:5173
echo Admin Center:   http://localhost:5174
echo ML Service:     http://localhost:8000/health
echo =======================================================
echo Use 'docker logs -f multishield-banking-ui' to see logs if needed.
pause
