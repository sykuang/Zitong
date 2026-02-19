// ============================================
// Core types for the Zitong AI Chat Client
// ============================================

// --- Permissions types ---

export interface PermissionsStatus {
  accessibilityOk: boolean;
  automationOk: boolean;
  canCopy: boolean;
  details: string | null;
  isBundled: boolean;
  executablePath: string;
}

// --- Provider & Model types ---

export type ProviderType =
  | "openai"
  | "anthropic"
  | "gemini"
  | "ollama"
  | "github_copilot"
  | "mistral"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "xai"
  | "openai_compatible";

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
}

export interface Model {
  id: string;
  name: string;
  providerId: string;
  providerType: ProviderType;
  supportsVision: boolean;
  supportsStreaming: boolean;
  maxTokens: number;
  contextWindow: number;
}

// --- Conversation types ---

export interface Conversation {
  id: string;
  title: string;
  model: string;
  providerId: string;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
  isArchived: boolean;
  folderId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  tokenCount?: number;
  createdAt: number;
  parentId?: string;
  sortOrder: number;
}

export interface Attachment {
  id: string;
  messageId: string;
  fileName: string;
  filePath: string;
  mimeType?: string;
  fileSize?: number;
  createdAt: number;
}

// --- Prompt Template types ---

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  variables: string[];
  createdAt: number;
  updatedAt: number;
}

// --- Folder types ---

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  sortOrder: number;
  createdAt: number;
}

// --- Settings types ---

export interface AppSettings {
  theme: "light" | "dark" | "system";
  defaultModel: string;
  defaultProviderId: string;
  defaultSystemPrompt: string;
  globalHotkey: string;
  sendOnEnter: boolean;
  streamResponses: boolean;
  fontSize: number;
  accentColor: string;
  fontFamily: string;
  chatBubbleStyle: string;
  codeTheme: string;
  compactMode: boolean;
  launchAtLogin: boolean;
  startAsBackground: boolean;
}

// --- AI Command types ---

export interface AiCommand {
  id: string;
  label: string;
  icon: string;
  behavior: "replace_selection" | "insert_after" | "answer_in_new";
  systemPrompt: string;
  providerId?: string;
  model?: string;
  outputLanguage: string;
  keyboardShortcut?: string;
  enabled: boolean;
  sortOrder: number;
}

// --- Assistant types ---

export interface Assistant {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  providerId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  isDefault: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

// --- Stream event types (from Rust backend) ---

export type StreamEvent =
  | { event: "started"; data: { messageId: string } }
  | { event: "delta"; data: { content: string } }
  | { event: "done"; data: { totalTokens: number } }
  | { event: "error"; data: { message: string } };

// --- API request/response types ---

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  model: string;
  providerId: string;
  attachments?: string[]; // file paths
  systemPrompt?: string;
}

export interface CreateConversationRequest {
  title?: string;
  model: string;
  providerId: string;
  systemPrompt?: string;
  folderId?: string;
}
