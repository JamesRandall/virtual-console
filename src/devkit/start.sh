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
DEFAULT_MODEL="$HOME/models/qwen2.5-coder-32b-instruct-q4_k_m.gguf"
LLAMACPP_CHAT_MODEL="${LLAMACPP_CHAT_MODEL:-$DEFAULT_MODEL}"
LLAMACPP_CODEGEN_MODEL="${LLAMACPP_CODEGEN_MODEL:-$DEFAULT_MODEL}"
LLAMACPP_CHAT_PORT=8080      # Fast chat with small context
LLAMACPP_CODEGEN_PORT=8081   # Code generation with large context

# Check if using llamacpp provider (default if AI_PROVIDER is not set)
AI_PROVIDER=$(grep "^AI_PROVIDER=" api/.env 2>/dev/null | cut -d'=' -f2)
if [ -z "$AI_PROVIDER" ] || [ "$AI_PROVIDER" = "llamacpp" ]; then
    # Check if chat model exists
    if [ ! -f "$LLAMACPP_CHAT_MODEL" ]; then
        echo -e "${RED}❌ Error: llama.cpp chat model not found at $LLAMACPP_CHAT_MODEL${NC}"
        exit 1
    fi

    # Check if codegen model exists
    if [ ! -f "$LLAMACPP_CODEGEN_MODEL" ]; then
        echo -e "${RED}❌ Error: llama.cpp codegen model not found at $LLAMACPP_CODEGEN_MODEL${NC}"
        exit 1
    fi

    # Check if llama-server is installed
    if ! command -v llama-server &> /dev/null; then
        echo -e "${RED}❌ Error: llama-server not found. Install with: brew install llama.cpp${NC}"
        exit 1
    fi

    # Start llama.cpp chat server (small context, fast)
    echo -e "${YELLOW}🦙 Starting llama.cpp chat server (port $LLAMACPP_CHAT_PORT)...${NC}"
    echo -e "${YELLOW}   Model: $LLAMACPP_CHAT_MODEL${NC}"
    llama-server \
        --model "$LLAMACPP_CHAT_MODEL" \
        --port $LLAMACPP_CHAT_PORT \
        --ctx-size 8192 \
        --n-gpu-layers 99 \
        --flash-attn on \
        --chat-template chatml &
    LLAMACPP_CHAT_PID=$!

    # Start llama.cpp code generation server (large context)
    echo -e "${YELLOW}🦙 Starting llama.cpp codegen server (port $LLAMACPP_CODEGEN_PORT)...${NC}"
    echo -e "${YELLOW}   Model: $LLAMACPP_CODEGEN_MODEL${NC}"
    llama-server \
        --model "$LLAMACPP_CODEGEN_MODEL" \
        --port $LLAMACPP_CODEGEN_PORT \
        --ctx-size 32768 \
        --n-gpu-layers 99 \
        --flash-attn on \
        --chat-template chatml &
    LLAMACPP_CODEGEN_PID=$!

    # Wait for servers to be ready
    echo -e "${YELLOW}⏳ Waiting for llama.cpp servers to be ready...${NC}"
    sleep 8

    # Check if chat server is running
    if ! kill -0 $LLAMACPP_CHAT_PID 2>/dev/null; then
        echo -e "${RED}❌ llama.cpp chat server failed to start${NC}"
        kill $LLAMACPP_CODEGEN_PID 2>/dev/null
        exit 1
    fi

    # Check if codegen server is running
    if ! kill -0 $LLAMACPP_CODEGEN_PID 2>/dev/null; then
        echo -e "${RED}❌ llama.cpp codegen server failed to start${NC}"
        kill $LLAMACPP_CHAT_PID 2>/dev/null
        exit 1
    fi

    echo -e "${GREEN}✅ llama.cpp chat server running on port $LLAMACPP_CHAT_PORT (8k context)${NC}"
    echo -e "${GREEN}✅ llama.cpp codegen server running on port $LLAMACPP_CODEGEN_PORT (32k context)${NC}"
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
if [ -n "$LLAMACPP_CHAT_PID" ]; then
    echo -e "${GREEN}   llama.cpp chat: http://localhost:$LLAMACPP_CHAT_PORT${NC}"
    echo -e "${GREEN}   llama.cpp codegen: http://localhost:$LLAMACPP_CODEGEN_PORT${NC}"
fi
echo -e "${GREEN}   API Server: http://localhost:3001${NC}"
echo -e "${GREEN}   DevKit UI: http://localhost:5173${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"

# Trap to kill all processes on exit
cleanup() {
    echo -e "${YELLOW}Shutting down...${NC}"
    kill $CLIENT_PID 2>/dev/null
    kill $API_PID 2>/dev/null
    if [ -n "$LLAMACPP_CHAT_PID" ]; then
        kill $LLAMACPP_CHAT_PID 2>/dev/null
    fi
    if [ -n "$LLAMACPP_CODEGEN_PID" ]; then
        kill $LLAMACPP_CODEGEN_PID 2>/dev/null
    fi
    exit
}
trap cleanup SIGINT SIGTERM

# Wait for all processes
wait
