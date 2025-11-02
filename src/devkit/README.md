# Virtual Console DevKit with AI Assistant

A development environment for writing and debugging 8-bit assembly code for the Virtual Console, enhanced with an AI assistant powered by Claude.

## Features

- **Monaco Code Editor** with custom assembly language support
- **Real-time Debugger** with breakpoints, step execution, and CPU state inspection
- **Memory Viewer** for inspecting and monitoring memory contents
- **AI Assistant** powered by Claude Sonnet 4.5 that can:
  - Read and understand your assembly code
  - Help debug issues by inspecting CPU state and memory
  - Write assembly programs based on requirements
  - Control the debugger (step, run, breakpoints)
  - Explain CPU architecture and instruction behavior

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- An Anthropic API key (get one at https://console.anthropic.com/)

## Setup

1. **Install dependencies**:
   ```bash
   npm run install:all
   ```

2. **Configure the API server**:
   ```bash
   cd api
   cp .env.example .env
   ```

3. **Add your Anthropic API key** to `api/.env`:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

## Running the DevKit

From the `devkit` directory:

```bash
npm start
```

This will start:
- **API Server** on http://localhost:3001
- **DevKit UI** on http://localhost:5173

The AI Assistant will connect automatically when you open the DevKit UI.

## Manual Start (for development)

To run the API and client separately:

```bash
# Terminal 1 - API Server
npm run dev:api

# Terminal 2 - Client
npm run dev:client
```

## Using the AI Assistant

The AI Assistant appears in the right panel of the DevKit. You can:

- **Ask questions** about assembly code, CPU architecture, or debugging
- **Request code generation** for specific tasks
- **Debug issues** by having the AI inspect CPU and memory state
- **Learn** about the virtual console hardware

### Example Prompts

- "Explain what this code does"
- "Help me find the bug in my code"
- "Write a program that draws a square on the screen"
- "What's the value in register R0?"
- "Set a breakpoint at line 10 and step through the code"
- "What's in memory at address 0x1234?"

### AI Capabilities

The AI has access to tools that let it:
- Read your current source code
- Update the source code
- Read CPU state (registers, PC, SP, flags, cycle count)
- Read memory contents
- Set/clear breakpoints
- Step through execution
- Run/pause the debugger
- Reset the console
- Assemble and load code

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (DevKit UI)                        │
│  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Editor     │  │  AI Chat Panel       │ │
│  │  Debugger   │  │  (Right Sidebar)     │ │
│  └─────────────┘  └──────────────────────┘ │
└──────────┬──────────────────────────────────┘
           │ WebSocket
           ▼
┌──────────────────────────────────────────────┐
│  Node.js API Server                          │
│  ┌────────────────────────────────────────┐ │
│  │  Claude Agent Service                  │ │
│  │  - Streaming responses                 │ │
│  │  - Tool execution                      │ │
│  └────────────────────────────────────────┘ │
└──────────┬───────────────────────────────────┘
           │ HTTPS
           ▼
┌──────────────────────────────────────────────┐
│  Anthropic Claude API                        │
│  (claude-sonnet-4-5-20250929)                │
└──────────────────────────────────────────────┘
```

## Project Structure

```
devkit/
├── api/                    # Node.js API server
│   ├── src/
│   │   ├── ai/            # Claude integration
│   │   ├── tools/         # DevKit tools for Claude
│   │   ├── websocket/     # WebSocket server
│   │   └── index.ts       # Entry point
│   ├── .env               # API keys (not in git)
│   └── package.json
├── client/                # React DevKit UI
│   ├── src/
│   │   ├── application/   # UI components
│   │   ├── services/      # WebSocket client
│   │   ├── stores/        # Zustand state
│   │   └── main.tsx
│   └── package.json
├── start.sh              # Startup script
└── package.json          # Root package
```

## Development

### API Server

The API server uses:
- **Express** for HTTP endpoints
- **Socket.io** for WebSocket communication
- **Anthropic SDK** for Claude integration
- **TypeScript** for type safety

### Client

The client uses:
- **React** for UI components
- **Zustand** for state management
- **Monaco Editor** for code editing
- **Socket.io-client** for WebSocket
- **Tailwind CSS** for styling

## Troubleshooting

### AI Assistant not connecting

1. Check that the API server is running on port 3001
2. Verify your Anthropic API key is set in `api/.env`
3. Check the browser console for connection errors

### Port already in use

If ports 3001 or 5173 are already in use, you can change them:
- API port: Edit `api/.env` and set `PORT=<new_port>`
- Client port: Edit `client/vite.config.ts`

### Module not found errors

Run `npm run install:all` to ensure all dependencies are installed.

## License

MIT
