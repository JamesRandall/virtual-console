import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Anthropic API
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  // Claude configuration
  claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  claudeMaxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '20000', 10),
  claudeTemperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '1'),

  // Server configuration
  port: parseInt(process.env.PORT || '3001', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // Validate required config
  validate(): void {
    if (!this.anthropicApiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is required. Please set it in .env file.\n' +
        'Copy .env.example to .env and add your API key.'
      );
    }
  }
};
