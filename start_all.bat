@echo off
echo =======================================================
echo          MultiShield - Zero Trust Architecture
echo =======================================================

echo [1/2] Starting Docker Infrastructure (Keycloak, ML Service, ZTA Gateway, Banking Backend)...
docker-compose up -d --build

echo.
echo [2/2] Launching Frontends (Managed by Docker)...
echo MultiShield Security Dashboard: http://localhost:5174
echo Dummy Banking Portal:           http://localhost:5173

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
