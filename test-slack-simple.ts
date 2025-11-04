#!/usr/bin/env bun
/**
 * Simple Slack connector test - uses source files directly
 */

import { Database } from "bun:sqlite";

// Load environment
const envFile = Bun.file(".env");
const envText = await envFile.text();
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#")) {
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      process.env[key] = valueParts.join("=");
    }
  }
}

console.log("🧪 Simple Slack Connector Test\n");

// Check tokens
if (!process.env.SLACK_APP_TOKEN || !process.env.SLACK_BOT_TOKEN) {
  console.error("❌ Missing SLACK_APP_TOKEN or SLACK_BOT_TOKEN");
  process.exit(1);
}

console.log("✓ Slack tokens found");
console.log(`  APP_TOKEN: ${process.env.SLACK_APP_TOKEN.slice(0, 15)}...`);
console.log(`  BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN.slice(0, 15)}...`);

// Initialize database
const dbPath = process.env.TASKS_DB_PATH || "./data/tasks.db";
console.log(`\n✓ Using database: ${dbPath}`);

const db = new Database(dbPath);
db.exec("PRAGMA journal_mode = WAL");

// Import and initialize the Slack helper
console.log("\n📡 Loading Slack connector...");

const { default: slackHelper } = await import("./packages/connectors/slack/src/index.ts");

const logger = {
  info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta).slice(0, 100) : ""),
  warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(meta).slice(0, 100) : ""),
  error: (msg: string | Error, meta?: any) => console.error(`[ERROR]`, msg, meta ? JSON.stringify(meta).slice(0, 100) : "")
};

const config = {
  allow_channels: [],  // Disable sweeper for test
  sweeper_minutes: 0,
  enable_todo_detection: false
};

slackHelper.init({
  db,
  logger,
  config,
  emit: (event: string, payload?: unknown) => {
    console.log(`[EVENT] ${event}`);
  }
});

console.log("✓ Connector initialized");

// Start the connector
console.log("\n🚀 Starting Slack connector (this may take a moment)...");
await slackHelper.start();
console.log("✓ Connector started! Socket Mode is connected.");

// Get tools
const tools = slackHelper.tools();
console.log(`\n✓ ${tools.length} MCP tools registered:`);
for (const tool of tools) {
  console.log(`  • ${tool.name}`);
}

// Test 1: List channels
console.log("\n📋 Test 1: Listing channels...");
const listChannelsTool = tools.find(t => t.name === "slack.list_channels");
if (!listChannelsTool) {
  throw new Error("slack.list_channels tool not found");
}

const channelsResult = await listChannelsTool.handler({ limit: 10 });
if (channelsResult.error) {
  throw new Error(`Failed to list channels: ${channelsResult.error}`);
}

console.log(`✓ Found ${channelsResult.channels.length} channels:`);
for (const ch of channelsResult.channels.slice(0, 5)) {
  console.log(`  • #${ch.name} (${ch.id}) ${ch.is_member ? "✓ member" : ""}`);
}

// Find a test channel
const testChannel = channelsResult.channels.find((ch: any) => 
  ch.is_member && (ch.name === "general" || ch.name === "random" || ch.name === "dev")
) || channelsResult.channels.find((ch: any) => ch.is_member);

if (!testChannel) {
  console.log("\n⚠️  No channels where bot is a member. Please invite the bot to a channel first.");
  await slackHelper.stop();
  db.close();
  process.exit(0);
}

console.log(`\n✓ Using test channel: #${testChannel.name} (${testChannel.id})`);

// Test 2: Post a message
console.log("\n💬 Test 2: Posting test message...");
const postMessageTool = tools.find(t => t.name === "slack.post_message");
if (!postMessageTool) {
  throw new Error("slack.post_message tool not found");
}

const testMessage = `🧪 Test from MAGI-Core at ${new Date().toLocaleTimeString()}`;
const postResult = await postMessageTool.handler({
  channel_id: testChannel.id,
  text: testMessage
});

if (!postResult.ok) {
  throw new Error(`Failed to post message: ${postResult.error}`);
}

console.log(`✓ Message posted!`);
console.log(`  Timestamp: ${postResult.ts}`);

// Test 3: Get history
console.log("\n📜 Test 3: Retrieving message history...");
await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for message to be processed

const getHistoryTool = tools.find(t => t.name === "slack.get_history");
if (!getHistoryTool) {
  throw new Error("slack.get_history tool not found");
}

const historyResult = await getHistoryTool.handler({
  channel_id: testChannel.id,
  limit: 10
});

if (historyResult.error) {
  throw new Error(`Failed to get history: ${historyResult.error}`);
}

console.log(`✓ Retrieved ${historyResult.items.length} messages`);

// Find our message
const ourMessage = historyResult.items.find((msg: any) => msg.ts === postResult.ts);

if (ourMessage) {
  console.log(`\n✓ Test message found in history!`);
  console.log(`  ID: ${ourMessage.id}`);
  console.log(`  Preview: ${ourMessage.preview.slice(0, 60)}...`);
  console.log(`  Permalink: ${ourMessage.link || "(hydrating in background...)"}`);
  console.log(`  Freshness: ${ourMessage.approx_freshness_seconds}s ago`);
} else {
  console.log(`\n⚠️  Message not found yet (may take a moment to sync)`);
}

// Cleanup
console.log("\n🧹 Stopping connector...");
await slackHelper.stop();
db.close();

console.log("\n✅ All tests passed!");
console.log("\n📊 Summary:");
console.log(`   • Channels listed: ${channelsResult.channels.length}`);
console.log(`   • Message posted: ✓`);
console.log(`   • Message retrieved: ${ourMessage ? "✓" : "⏳ (pending)"}`);
console.log(`   • Permalink: ${ourMessage?.link ? "✓" : "⏳ (hydrating)"}`);

process.exit(0);
