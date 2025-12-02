import type { AIProvider } from './interface.js';
import { AnthropicProvider } from './anthropic.js';
import { BedrockProvider } from './bedrock.js';
import { LlamaCppProvider } from './llamacpp.js';

export type ProviderType = 'anthropic' | 'bedrock' | 'llamacpp';

export interface ProviderConfig {
  type: ProviderType;
  // Anthropic config
  anthropicApiKey?: string;
  anthropicModel?: string;
  // Bedrock config
  bedrockRegion?: string;
  bedrockModelId?: string;
  bedrockMaxRetries?: number;
  bedrockBaseDelayMs?: number;
  // llama.cpp config
  llamacppHost?: string;
}

export function createAIProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case 'anthropic':
      if (!config.anthropicApiKey || !config.anthropicModel) {
        throw new Error('Anthropic API key and model are required');
      }
      return new AnthropicProvider(config.anthropicApiKey, config.anthropicModel);

    case 'bedrock':
      if (!config.bedrockRegion || !config.bedrockModelId) {
        throw new Error('Bedrock region and model ID are required');
      }
      return new BedrockProvider(
        config.bedrockRegion,
        config.bedrockModelId,
        config.bedrockMaxRetries,
        config.bedrockBaseDelayMs
      );

    case 'llamacpp':
      if (!config.llamacppHost) {
        throw new Error('llama.cpp host is required');
      }
      return new LlamaCppProvider(config.llamacppHost);

    default:
      throw new Error(`Unsupported provider type: ${config.type}`);
  }
}
