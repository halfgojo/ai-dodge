#!/bin/bash
set -e

echo "======================================"
echo " Starting Dodge AI (Local Unified app)"
echo "======================================"

# Ensure frontend is built
if [ ! -d "frontend/dist" ]; then
    echo "Building frontend..."
    cd frontend
    npm install
    npm run build
    cd ..
fi

echo "Starting backend server (which also serves the frontend)..."
cd backend
source venv/bin/activate
python3 main.py
