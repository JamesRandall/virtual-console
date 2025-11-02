import { config } from './config.js';
import { createAppServer } from './server.js';
import { initializeSocketServer } from './websocket/socketServer.js';

async function main() {
  try {
    // Validate configuration
    config.validate();

    console.log('🚀 Starting DevKit API Server...');

    // Create HTTP server
    const { httpServer } = createAppServer();

    // Initialize WebSocket server
    initializeSocketServer(httpServer);

    // Start listening
    httpServer.listen(config.port, () => {
      console.log(`✅ Server running on port ${config.port}`);
      console.log(`📡 WebSocket ready for connections`);
      console.log(`🤖 AI Provider: ${config.aiProvider}`);
      if (config.aiProvider === 'anthropic') {
        console.log(`   Model: ${config.anthropicModel}`);
      } else if (config.aiProvider === 'bedrock') {
        console.log(`   Region: ${config.bedrockRegion}`);
        console.log(`   Model: ${config.bedrockModelId}`);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

main();
