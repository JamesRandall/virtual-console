# Virtual Console DevKit with AI Assistant

A development environment for writing and debugging 8-bit assembly code for the Virtual Console, enhanced with an AI assistant powered by Claude (via Anthropic API or AWS Bedrock).

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
- **One of the following**:
  - An Anthropic API key (get one at https://console.anthropic.com/), OR
  - AWS account with Bedrock enabled and Claude Sonnet 4.5 access

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

3. **Choose your AI provider** in `api/.env`:

   ### Option A: Anthropic (Direct API)
   ```env
   AI_PROVIDER=anthropic
   ANTHROPIC_API_KEY=your_api_key_here
   ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
   ```

   ### Option B: AWS Bedrock
   ```env
   AI_PROVIDER=bedrock
   BEDROCK_REGION=eu-west-2
   BEDROCK_MODEL_ID=arn:aws:bedrock:eu-west-2:YOUR_ACCOUNT:inference-profile/eu.anthropic.claude-sonnet-4-5-20250929-v1:0
   ```

   **Note**: AWS credentials should be configured via AWS CLI or environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).

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

## AI Provider Selection

The system supports two AI providers:

### Anthropic (Direct API)
- **Pros**: Direct access, simpler setup
- **Cons**: Rate limits may apply
- **Setup**: Just need an API key from Anthropic

### AWS Bedrock
- **Pros**: Better rate limits, enterprise features, regional deployment
- **Cons**: Requires AWS account and Bedrock access
- **Setup**: Need AWS credentials and Bedrock model access

Switch between providers by changing `AI_PROVIDER` in the `.env` file.

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
│  │  AI Provider Abstraction Layer         │ │
│  │  - Anthropic Provider                  │ │
│  │  - Bedrock Provider                    │ │
│  └────────────────────────────────────────┘ │
└──────────┬──────────┬────────────────────────┘
           │          │
           ▼          ▼
    ┌──────────┐  ┌──────────────────┐
    │Anthropic │  │  AWS Bedrock     │
    │   API    │  │  (eu-west-2)     │
    └──────────┘  └──────────────────┘
```

## Project Structure

```
devkit/
├── api/                    # Node.js API server
│   ├── src/
│   │   ├── ai/
│   │   │   ├── providers/  # AI provider abstraction
│   │   │   │   ├── interface.ts
│   │   │   │   ├── anthropic.ts
│   │   │   │   ├── bedrock.ts
│   │   │   │   └── factory.ts
│   │   │   ├── agentService.ts
│   │   │   └── systemPrompts.ts
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
- **Anthropic SDK** or **AWS SDK** for AI
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
2. Verify your AI provider configuration in `api/.env`
3. For Bedrock: Ensure AWS credentials are configured
4. Check the browser console for connection errors

### Bedrock access issues

If using AWS Bedrock:
1. Verify your AWS credentials are configured (`aws configure`)
2. Check that you have access to Claude in your region
3. Verify the model ARN matches your account and region
4. Check IAM permissions for Bedrock access

### Port already in use

If ports 3001 or 5173 are already in use, you can change them:
- API port: Edit `api/.env` and set `PORT=<new_port>`
- Client port: Edit `client/vite.config.ts`

### Module not found errors

Run `npm run install:all` to ensure all dependencies are installed.

## License

MIT
