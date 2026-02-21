import { invoke } from "@tauri-apps/api/core";
import type {
  Conversation,
  Message,
  CreateConversationRequest,
  Provider,
  AppSettings,
  PromptTemplate,
  Folder,
  ModelInfo,
  DeviceCodeResponse,
  AiCommand,
  Assistant,
} from "@/types";

// ============================================
// Conversation Commands
// ============================================

export async function createConversation(
  req: CreateConversationRequest
): Promise<Conversation> {
  return invoke("create_conversation", { req });
}

export async function listConversations(): Promise<Conversation[]> {
  return invoke("list_conversations");
}

export async function getConversation(id: string): Promise<Conversation> {
  return invoke("get_conversation", { id });
}

export async function updateConversationTitle(
  id: string,
  title: string
): Promise<void> {
  return invoke("update_conversation_title", { id, title });
}

export async function deleteConversation(id: string): Promise<void> {
  return invoke("delete_conversation", { id });
}

export async function archiveConversation(
  id: string,
  archived: boolean
): Promise<void> {
  return invoke("archive_conversation", { id, archived });
}

export async function searchConversations(
  query: string
): Promise<Conversation[]> {
  return invoke("search_conversations", { query });
}

// ============================================
// Message Commands
// ============================================

export async function getMessages(
  conversationId: string
): Promise<Message[]> {
  return invoke("get_messages", { conversationId });
}

export async function deleteMessage(id: string): Promise<void> {
  return invoke("delete_message", { id });
}

// ============================================
// Provider Commands
// ============================================

export async function listProviders(): Promise<Provider[]> {
  return invoke("list_providers");
}

export async function saveProvider(provider: Provider): Promise<void> {
  return invoke("save_provider", { provider });
}

export async function deleteProvider(id: string): Promise<void> {
  return invoke("delete_provider", { id });
}

export async function testProviderConnection(
  id: string
): Promise<{ success: boolean; error?: string }> {
  return invoke("test_provider_connection", { id });
}

export async function listModels(
  providerId: string
): Promise<ModelInfo[]> {
  return invoke("list_models", { providerId });
}

// ============================================
// GitHub Copilot OAuth Commands
// ============================================

export async function copilotStartDeviceFlow(): Promise<DeviceCodeResponse> {
  return invoke("copilot_start_device_flow");
}

export async function copilotPollAuth(
  deviceCode: string
): Promise<string> {
  return invoke("copilot_poll_auth", { deviceCode });
}

export async function copilotExchangeToken(
  githubToken: string
): Promise<{ token: string; baseUrl: string }> {
  return invoke("copilot_exchange_token", { githubToken });
}

// ============================================
// Settings Commands
// ============================================

export async function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}

// ============================================
// Prompt Template Commands
// ============================================

export async function listPromptTemplates(): Promise<PromptTemplate[]> {
  return invoke("list_prompt_templates");
}

export async function savePromptTemplate(
  template: PromptTemplate
): Promise<void> {
  return invoke("save_prompt_template", { template });
}

export async function deletePromptTemplate(id: string): Promise<void> {
  return invoke("delete_prompt_template", { id });
}

// ============================================
// Folder Commands
// ============================================

export async function listFolders(): Promise<Folder[]> {
  return invoke("list_folders");
}

export async function createFolder(name: string): Promise<Folder> {
  return invoke("create_folder", { name });
}

export async function deleteFolder(id: string): Promise<void> {
  return invoke("delete_folder", { id });
}

// ============================================
// AI Command Commands
// ============================================

export async function listAiCommands(): Promise<AiCommand[]> {
  return invoke("list_ai_commands");
}

export async function saveAiCommand(command: AiCommand): Promise<void> {
  return invoke("save_ai_command", { command });
}

export async function deleteAiCommand(id: string): Promise<void> {
  return invoke("delete_ai_command", { id });
}

export async function executeAiCommand(req: {
  selectedText: string;
  systemPrompt: string;
  providerId?: string;
  model?: string;
}): Promise<string> {
  return invoke("execute_ai_command", { req });
}

// ============================================
// Assistant Commands
// ============================================

export async function listAssistants(): Promise<Assistant[]> {
  return invoke("list_assistants");
}

export async function saveAssistant(assistant: Assistant): Promise<void> {
  return invoke("save_assistant", { assistant });
}

export async function deleteAssistant(id: string): Promise<void> {
  return invoke("delete_assistant", { id });
}

// ============================================
// Autostart Commands
// ============================================

export async function setLaunchAtLogin(enabled: boolean): Promise<void> {
  return invoke("set_launch_at_login", { enabled });
}

export async function getLaunchAtLogin(): Promise<boolean> {
  return invoke("get_launch_at_login");
}
