import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

export const CLAUDE_CONFIG = {
  model: config.claudeModel,
  max_tokens: config.claudeMaxTokens,
  temperature: config.claudeTemperature,
} as const;
