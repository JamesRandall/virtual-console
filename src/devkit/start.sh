#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Virtual Console DevKit...${NC}"

# Check if .env exists in API directory
if [ ! -f "api/.env" ]; then
    echo -e "${RED}❌ Error: api/.env file not found${NC}"
    echo -e "${YELLOW}Please copy api/.env.example to api/.env and add your Anthropic API key${NC}"
    exit 1
fi

# Start API server in background
echo -e "${YELLOW}📡 Starting API server...${NC}"
cd api
npm run dev &
API_PID=$!
cd ..

# Wait for API to be ready
echo -e "${YELLOW}⏳ Waiting for API server to be ready...${NC}"
sleep 3

# Check if API is still running
if ! kill -0 $API_PID 2>/dev/null; then
    echo -e "${RED}❌ API server failed to start${NC}"
    exit 1
fi

# Start DevKit client in background
echo -e "${YELLOW}🖥️  Starting DevKit client...${NC}"
cd client
npm run dev &
CLIENT_PID=$!
cd ..

# Wait for client to be ready
sleep 2

# Check if client is still running
if ! kill -0 $CLIENT_PID 2>/dev/null; then
    echo -e "${RED}❌ DevKit client failed to start${NC}"
    kill $API_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ DevKit is running!${NC}"
echo -e "${GREEN}   API Server: http://localhost:3001${NC}"
echo -e "${GREEN}   DevKit UI: http://localhost:5173${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"

# Trap to kill both processes on exit
trap "echo -e '${YELLOW}Shutting down...${NC}'; kill $API_PID $CLIENT_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for both processes
wait
