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

# llama.cpp configuration
LLAMACPP_MODEL="$HOME/models/qwen2.5-coder-32b-instruct-q4_k_m.gguf"
LLAMACPP_PORT=8080

# Check if using llamacpp provider
if grep -q "AI_PROVIDER=llamacpp" api/.env 2>/dev/null; then
    echo -e "${YELLOW}🦙 Starting llama.cpp server...${NC}"

    # Check if model exists
    if [ ! -f "$LLAMACPP_MODEL" ]; then
        echo -e "${RED}❌ Error: llama.cpp model not found at $LLAMACPP_MODEL${NC}"
        exit 1
    fi

    # Check if llama-server is installed
    if ! command -v llama-server &> /dev/null; then
        echo -e "${RED}❌ Error: llama-server not found. Install with: brew install llama.cpp${NC}"
        exit 1
    fi

    # Start llama.cpp server
    # 64GB M4 Max can handle large context with 32B Q4 model (~20GB)
    llama-server \
        --model "$LLAMACPP_MODEL" \
        --port $LLAMACPP_PORT \
        --ctx-size 65536 \
        --n-gpu-layers 99 \
        --chat-template chatml &
    LLAMACPP_PID=$!

    # Wait for llama.cpp to be ready
    echo -e "${YELLOW}⏳ Waiting for llama.cpp server to be ready...${NC}"
    sleep 5

    # Check if llama.cpp is running
    if ! kill -0 $LLAMACPP_PID 2>/dev/null; then
        echo -e "${RED}❌ llama.cpp server failed to start${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ llama.cpp server running on port $LLAMACPP_PORT${NC}"
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
if [ -n "$LLAMACPP_PID" ]; then
    echo -e "${GREEN}   llama.cpp: http://localhost:$LLAMACPP_PORT${NC}"
fi
echo -e "${GREEN}   API Server: http://localhost:3001${NC}"
echo -e "${GREEN}   DevKit UI: http://localhost:5173${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"

# Trap to kill all processes on exit
cleanup() {
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $CLIENT_PID 2>/dev/null
    kill $API_PID 2>/dev/null
    if [ -n "$LLAMACPP_PID" ]; then
        kill $LLAMACPP_PID 2>/dev/null
    fi
    exit
}
trap cleanup SIGINT SIGTERM

# Wait for all processes
wait
