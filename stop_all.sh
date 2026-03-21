#!/bin/bash

# MultiShield - Zero Trust Architecture
# Native Linux Shutdown Script

echo "======================================================="
echo "         MultiShield - Zero Trust Architecture"
echo "                Shutdown Utility"
echo "======================================================="

# Function to kill process on a port
kill_port() {
    local port=$1
    local pid=$(lsof -t -i :$port)
    if [ ! -z "$pid" ]; then
        echo "Stopping process $pid on port $port..."
        kill -15 $pid 2>/dev/null || kill -9 $pid 2>/dev/null
    fi
}

echo "Stopping services..."
kill_port 3001
kill_port 3002
kill_port 5173
kill_port 5174

# Also stop docker if running
if command -v docker-compose &> /dev/null; then
    if [ -f "docker-compose.yml" ]; then
        echo "Stopping Docker services..."
        docker-compose down 2>/dev/null
    fi
fi

echo ""
echo "All MultiShield services have been stopped."
echo "======================================================="
