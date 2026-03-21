#!/bin/bash

# MultiShield - Zero Trust Architecture
# Native Linux Startup Script

echo "======================================================="
echo "         MultiShield - Zero Trust Architecture"
echo "======================================================="

# Function to start a service in a subshell
start_service() {
    local dir=$1
    local cmd=$2
    local log=$3
    echo "Starting $dir..."
    (cd "$dir" && $cmd > "../../$log" 2>&1) &
}

# Stop existing processes on ports 3001, 3002, 5173, 5174
if [ -f "stop_all.sh" ]; then
    ./stop_all.sh
else
    echo "Cleaning up existing processes..."
    for port in 3001 3002 5173 5174; do
        pid=$(lsof -t -i :$port)
        [ ! -z "$pid" ] && kill -9 $pid 2>/dev/null
    done
fi

echo ""
echo "[1/2] Starting Backends..."
start_service "dummy-banking-system/backend" "npm start" "banking_backend.log"
start_service "security-platform/backend" "npm start" "security_backend.log"

echo ""
echo "[2/2] Starting Frontends..."
start_service "dummy-banking-system/frontend" "npm run dev" "banking_frontend.log"
start_service "security-platform/frontend" "npm run dev" "security_frontend.log"

echo ""
echo "======================================================="
echo "All services are starting up in the background!"
echo "Logs are available in *.log files."
echo ""
echo "Banking Portal: http://localhost:5173"
echo "Admin Center:   http://localhost:5174"
echo "======================================================="
echo "Use ./stop_all.sh to shut down."
echo "======================================================="
