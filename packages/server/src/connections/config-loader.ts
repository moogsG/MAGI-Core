/**
 * Configuration loader that merges config.json with environment variables
 * 
 * This module provides utilities to load configuration from both config.json
 * and environment variables, with env vars taking precedence.
 */

interface HelperConfig {
  name: string;
  module: string;
  config: Record<string, unknown>;
}

interface Config {
  helpers: HelperConfig[];
}

/**
 * Load Slack connector configuration from environment variables
 */
function loadSlackConfigFromEnv(): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  // Parse allowed channels from comma-separated string
  if (process.env.SLACK_ALLOWED_CHANNELS) {
    const channels = process.env.SLACK_ALLOWED_CHANNELS
      .split(',')
      .map(ch => ch.trim())
      .filter(ch => ch.length > 0);
    if (channels.length > 0) {
      config.allow_channels = channels;
    }
  }

  // User ID for priority detection
  if (process.env.SLACK_USER_ID) {
    config.user = process.env.SLACK_USER_ID;
  }

  // Sweeper interval
  if (process.env.SLACK_SWEEPER_MINUTES) {
    const minutes = parseInt(process.env.SLACK_SWEEPER_MINUTES, 10);
    if (!isNaN(minutes) && minutes > 0) {
      config.sweeper_minutes = minutes;
    }
  }

  // TODO detection
  if (process.env.SLACK_ENABLE_TODO_DETECTION !== undefined) {
    config.enable_todo_detection = process.env.SLACK_ENABLE_TODO_DETECTION === 'true';
  }

  // Background services
  if (process.env.SLACK_ENABLE_BACKGROUND_SERVICES !== undefined) {
    config.enable_background_services = process.env.SLACK_ENABLE_BACKGROUND_SERVICES === 'true';
  }

  return config;
}

/**
 * Load Echo/Template connector configuration from environment variables
 */
function loadEchoConfigFromEnv(): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  if (process.env.ECHO_GREETING) {
    config.greeting = process.env.ECHO_GREETING;
  }

  return config;
}

/**
 * Load Microsoft 365 connector configuration from environment variables
 */
function loadMsConfigFromEnv(): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  // Polling interval
  if (process.env.MS_POLL_MINUTES) {
    const minutes = parseInt(process.env.MS_POLL_MINUTES, 10);
    if (!isNaN(minutes) && minutes > 0) {
      config.poll_minutes = minutes;
    }
  }

  // Mail folders
  if (process.env.MS_MAIL_FOLDERS) {
    const folders = process.env.MS_MAIL_FOLDERS
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);
    if (folders.length > 0) {
      config.mail_folders = folders;
    }
  }

  return config;
}

/**
 * Merge environment variables into helper configuration
 * Environment variables take precedence over config.json values
 */
function mergeEnvIntoHelperConfig(helper: HelperConfig): HelperConfig {
  let envConfig: Record<string, unknown> = {};

  // Load env config based on helper name
  switch (helper.name) {
    case 'slack':
      envConfig = loadSlackConfigFromEnv();
      break;
    case 'echo':
      envConfig = loadEchoConfigFromEnv();
      break;
    case 'ms':
    case 'outlook':
      envConfig = loadMsConfigFromEnv();
      break;
    default:
      // No env config for unknown helpers
      break;
  }

  // Merge env config into helper config (env takes precedence)
  return {
    ...helper,
    config: {
      ...helper.config,
      ...envConfig
    }
  };
}

/**
 * Load and merge configuration from config.json and environment variables
 * 
 * @param baseConfig - Configuration loaded from config.json
 * @returns Merged configuration with env vars applied
 */
export function mergeConfigWithEnv(baseConfig: Config): Config {
  if (!baseConfig.helpers || !Array.isArray(baseConfig.helpers)) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    helpers: baseConfig.helpers.map(mergeEnvIntoHelperConfig)
  };
}
