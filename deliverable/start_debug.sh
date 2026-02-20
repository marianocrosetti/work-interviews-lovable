#!/bin/bash

echo "Building the application..."
# Step 1: Build everything from scratch (no cache)
#docker-compose build --no-cache frontend backend devhost

# Step 2: Start backend only
docker-compose up -d backend

# Step 3: Wait 15 seconds
echo "Waiting for backend to initialize..."
sleep 15

# Step 4: Start frontend and devhost
docker-compose up -d frontend
docker-compose up -d devhost

# Step 5: Final message
echo "I'm ready at http://localhost:3000"
