import dotenv from 'dotenv';
import type { ProviderType } from './ai/providers/factory.js';

// Load environment variables
dotenv.config();

export const config = {
  // AI Provider selection
  aiProvider: (process.env.AI_PROVIDER || 'anthropic') as ProviderType,

  // Anthropic API
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',

  // AWS Bedrock
  bedrockRegion: process.env.BEDROCK_REGION || 'eu-west-2',
  bedrockModelId: process.env.BEDROCK_MODEL_ID || '',
  bedrockMaxRetries: parseInt(process.env.BEDROCK_MAX_RETRIES || '5', 10),
  bedrockBaseDelayMs: parseInt(process.env.BEDROCK_BASE_DELAY_MS || '1000', 10),

  // llama.cpp configuration
  llamacppHost: process.env.LLAMACPP_HOST || 'http://localhost:8080',
  llamacppGrammarPath: process.env.LLAMACPP_GRAMMAR_PATH || './src/ai/grammars/vc-asm.gbnf',

  // Model configuration
  maxTokens: parseInt(process.env.MAX_TOKENS || '20000', 10),
  temperature: parseFloat(process.env.TEMPERATURE || '1'),

  // Server configuration
  port: parseInt(process.env.PORT || '3001', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Validate required config
  validate(): void {
    if (this.aiProvider === 'anthropic') {
      if (!this.anthropicApiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY is required when using Anthropic provider.\n' +
          'Copy .env.example to .env and add your API key.'
        );
      }
    } else if (this.aiProvider === 'bedrock') {
      if (!this.bedrockModelId) {
        throw new Error(
          'BEDROCK_MODEL_ID is required when using Bedrock provider.\n' +
          'Set BEDROCK_MODEL_ID in .env file (e.g., arn:aws:bedrock:eu-west-2:551004122490:inference-profile/eu.anthropic.claude-sonnet-4-5-20250929-v1:0)'
        );
      }
    } else if (this.aiProvider === 'llamacpp') {
      // llamacpp has defaults, no required config
      console.log(`Using llama.cpp provider at ${this.llamacppHost}`);
    } else {
      throw new Error(
        `Unsupported AI_PROVIDER: ${this.aiProvider}\n` +
        'Supported providers: anthropic, bedrock, llamacpp'
      );
    }
  }
};
