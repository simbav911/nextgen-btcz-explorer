#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default port
BACKEND_PORT=3001

echo -e "${GREEN}=========================================================${NC}"
echo -e "${GREEN}    Starting BitcoinZ Modern Explorer${NC}"
echo -e "${GREEN}=========================================================${NC}"

# Check if PostgreSQL is running
echo -e "${BLUE}[1/7]${NC} Checking PostgreSQL connection..."
if command -v pg_isready &> /dev/null; then
  pg_isready > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Warning: PostgreSQL may not be running. Please start PostgreSQL.${NC}"
    echo -e "${YELLOW}We'll try to run in direct RPC mode without database.${NC}"
  else
    echo -e "${GREEN}PostgreSQL is running.${NC}"
  fi
else
  echo -e "${YELLOW}Warning: pg_isready command not found. Cannot check PostgreSQL status.${NC}"
  echo -e "${YELLOW}We'll try to run in direct RPC mode without database.${NC}"
fi

# Try to determine correct PostgreSQL user
echo -e "${BLUE}[2/7]${NC} Checking PostgreSQL user..."
SYSTEM_USER=$(whoami)
echo -e "Your system username is: ${GREEN}${SYSTEM_USER}${NC}"
echo -e "We'll try to use this for PostgreSQL access."

# Update .env file with system username
cd backend
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
  # Replace DB_USER line with system username
  sed -i.bak "s/DB_USER=.*/DB_USER=${SYSTEM_USER}/" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  echo -e "Updated .env file with DB_USER=${SYSTEM_USER}"
else
  echo -e "${YELLOW}Warning: .env file not found. Database connection may fail.${NC}"
fi
cd ..

# Check if ports are available
echo -e "${BLUE}[3/7]${NC} Checking port availability..."
if command -v lsof &> /dev/null; then
  if lsof -i :$BACKEND_PORT -t >/dev/null; then
    echo -e "${YELLOW}Warning: Port $BACKEND_PORT is already in use.${NC}"
    echo -e "Do you want to try to kill the process using port $BACKEND_PORT? [y/N]"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
      PID=$(lsof -i :$BACKEND_PORT -t)
      echo -e "Killing process $PID..."
      kill -9 $PID
      sleep 2
    else
      echo -e "${YELLOW}Please update the PORT in backend/.env and REACT_APP_API_URL in frontend/.env${NC}"
      echo -e "${YELLOW}Then try starting the application again.${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}Port $BACKEND_PORT is available.${NC}"
  fi
else
  echo -e "${YELLOW}Warning: lsof command not found. Cannot check port availability.${NC}"
fi

# Create logs directory
echo -e "${BLUE}[4/7]${NC} Creating logs directory..."
mkdir -p ./backend/logs

# Install backend dependencies
echo -e "${BLUE}[5/7]${NC} Installing backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to install backend dependencies. Exiting.${NC}"
  exit 1
fi

# Start the backend in the background
echo -e "${BLUE}[6/7]${NC} Starting backend service..."
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to start (this may take a minute)..."
for i in {1..30}; do
  sleep 2
  # Check if process is still running
  if ! ps -p $BACKEND_PID > /dev/null; then
    echo -e "${RED}Backend process has stopped unexpectedly. Check logs for errors.${NC}"
    exit 1
  fi
  
  # Try to connect to API
  curl -s http://localhost:$BACKEND_PORT/api > /dev/null
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Backend started successfully (PID: $BACKEND_PID)${NC}"
    break
  fi
  
  # Show progress
  if [ $i -eq 30 ]; then
    echo -e "${YELLOW}Backend might still be starting up. Continuing anyway...${NC}"
  elif [ $((i % 5)) -eq 0 ]; then
    echo "Still waiting for backend to respond..."
  fi
done

# Change to frontend directory and install dependencies
cd ../frontend
echo -e "${BLUE}[7/7]${NC} Installing frontend dependencies..."
npm install --legacy-peer-deps
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to install frontend dependencies. Exiting.${NC}"
  kill $BACKEND_PID
  exit 1
fi

# Start the frontend with warnings disabled
echo -e "${GREEN}Starting frontend service...${NC}"
echo -e "${GREEN}=========================================================${NC}"
echo -e "${GREEN}BitcoinZ Explorer is almost ready!${NC}"
echo -e "${GREEN}* Backend API is available at:${NC} http://localhost:$BACKEND_PORT/api"
echo -e "${GREEN}* Frontend will be available at:${NC} http://localhost:3000"
echo -e "${GREEN}* Press Ctrl+C to stop both services when finished${NC}"
echo -e "${GREEN}=========================================================${NC}"
DISABLE_ESLINT_PLUGIN=true npm start &
FRONTEND_PID=$!

# Function to clean up processes
cleanup() {
    echo -e "${YELLOW}Gracefully stopping services...${NC}"
    echo -e "${BLUE}Stopping frontend (PID: $FRONTEND_PID)...${NC}"
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${BLUE}Stopping backend (PID: $BACKEND_PID) and nodemon...${NC}"
    pkill -P $BACKEND_PID 2>/dev/null  # Kill nodemon child processes
    kill $BACKEND_PID 2>/dev/null
    echo -e "${GREEN}All services stopped successfully.${NC}"
    exit 0
}

# Capture ctrl+c and term signals
trap cleanup INT TERM

# Wait for both processes
wait $FRONTEND_PID $BACKEND_PID

# If we get here naturally (not through ctrl+c), clean up
cleanup
