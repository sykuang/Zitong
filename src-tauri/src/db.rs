use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

// ============================================
// Database Models
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub model: String,
    pub provider_id: String,
    pub system_prompt: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_archived: bool,
    pub folder_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub model: Option<String>,
    pub token_count: Option<i64>,
    pub created_at: i64,
    pub parent_id: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: String,
    pub message_id: String,
    pub file_name: String,
    pub file_path: String,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    #[serde(rename = "type")]
    pub provider_type: String,
    pub name: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub default_model: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptTemplate {
    pub id: String,
    pub name: String,
    pub content: String,
    pub category: String,
    pub variables: Vec<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub default_model: String,
    pub default_provider_id: String,
    pub default_system_prompt: String,
    pub global_hotkey: String,
    pub send_on_enter: bool,
    pub stream_responses: bool,
    pub font_size: i64,
    pub accent_color: String,
    pub font_family: String,
    pub chat_bubble_style: String,
    pub code_theme: String,
    pub compact_mode: bool,
    pub launch_at_login: bool,
    pub start_as_background: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Assistant {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub description: String,
    pub system_prompt: String,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i64>,
    pub is_default: bool,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCommand {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub behavior: String,
    pub system_prompt: String,
    pub provider_id: Option<String>,
    pub model: Option<String>,
    pub output_language: String,
    pub keyboard_shortcut: Option<String>,
    pub enabled: bool,
    pub sort_order: i64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            default_model: "gpt-4o".to_string(),
            default_provider_id: "openai".to_string(),
            default_system_prompt: "You are a helpful assistant.".to_string(),
            global_hotkey: "CommandOrControl+Shift+Space".to_string(),
            send_on_enter: true,
            stream_responses: true,
            font_size: 14,
            accent_color: "blue".to_string(),
            font_family: "system".to_string(),
            chat_bubble_style: "minimal".to_string(),
            code_theme: "oneDark".to_string(),
            compact_mode: false,
            launch_at_login: false,
            start_as_background: false,
        }
    }
}

// ============================================
// Database Manager
// ============================================

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS conversations (
                id              TEXT PRIMARY KEY,
                title           TEXT NOT NULL DEFAULT 'New Chat',
                model           TEXT NOT NULL,
                provider_id     TEXT NOT NULL,
                system_prompt   TEXT,
                created_at      INTEGER NOT NULL,
                updated_at      INTEGER NOT NULL,
                is_archived     INTEGER NOT NULL DEFAULT 0,
                folder_id       TEXT
            );

            CREATE TABLE IF NOT EXISTS messages (
                id              TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role            TEXT NOT NULL,
                content         TEXT NOT NULL,
                model           TEXT,
                token_count     INTEGER,
                created_at      INTEGER NOT NULL,
                parent_id       TEXT,
                sort_order      INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS attachments (
                id              TEXT PRIMARY KEY,
                message_id      TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
                file_name       TEXT NOT NULL,
                file_path       TEXT NOT NULL,
                mime_type       TEXT,
                file_size       INTEGER,
                created_at      INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS providers (
                id              TEXT PRIMARY KEY,
                provider_type   TEXT NOT NULL,
                name            TEXT NOT NULL,
                api_key         TEXT,
                base_url        TEXT,
                default_model   TEXT,
                enabled         INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS prompt_templates (
                id              TEXT PRIMARY KEY,
                name            TEXT NOT NULL,
                content         TEXT NOT NULL,
                category        TEXT NOT NULL DEFAULT 'general',
                variables       TEXT NOT NULL DEFAULT '[]',
                created_at      INTEGER NOT NULL,
                updated_at      INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS folders (
                id              TEXT PRIMARY KEY,
                name            TEXT NOT NULL,
                parent_id       TEXT,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                created_at      INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key             TEXT PRIMARY KEY,
                value           TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS assistants (
                id              TEXT PRIMARY KEY,
                name            TEXT NOT NULL,
                icon            TEXT NOT NULL DEFAULT '🤖',
                description     TEXT NOT NULL DEFAULT '',
                system_prompt   TEXT NOT NULL DEFAULT '',
                provider_id     TEXT,
                model           TEXT,
                temperature     REAL,
                max_tokens      INTEGER,
                is_default      INTEGER NOT NULL DEFAULT 0,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                created_at      INTEGER NOT NULL,
                updated_at      INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ai_commands (
                id              TEXT PRIMARY KEY,
                label           TEXT NOT NULL,
                icon            TEXT NOT NULL DEFAULT '⚡',
                behavior        TEXT NOT NULL DEFAULT 'answer_in_new',
                system_prompt   TEXT NOT NULL DEFAULT '',
                provider_id     TEXT,
                model           TEXT,
                output_language TEXT NOT NULL DEFAULT 'default',
                keyboard_shortcut TEXT,
                enabled         INTEGER NOT NULL DEFAULT 1,
                sort_order      INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
                ON messages(conversation_id, sort_order);

            CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
                ON conversations(updated_at DESC);

            CREATE INDEX IF NOT EXISTS idx_attachments_message_id
                ON attachments(message_id);

            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
        ",
        )?;

        // --- Column migrations for existing databases ---
        // Add default_model to providers if it doesn't exist yet
        let has_default_model: bool = conn
            .prepare("SELECT default_model FROM providers LIMIT 0")
            .is_ok();
        if !has_default_model {
            conn.execute_batch("ALTER TABLE providers ADD COLUMN default_model TEXT;")?;
        }

        // Drop the lock before calling seed methods that also acquire it
        drop(conn);

        // Seed default AI commands if table is empty
        self.seed_ai_commands()?;
        // Seed default assistants if table is empty
        self.seed_assistants()?;

        Ok(())
    }

    fn seed_ai_commands(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM ai_commands", [], |row| row.get(0)
        )?;
        if count > 0 { return Ok(()); }

        let seeds = vec![
            ("improve_writing", "Improve writing", "✏️", "replace_selection", "Improve the writing quality of the following text. Fix grammar, enhance clarity, and improve flow while preserving the original meaning."),
            ("expand_writing", "Expand my writing", "⚡", "insert_after", "Expand and elaborate on the following text with more detail, examples, and depth."),
            ("fix_spelling", "Fix spelling and grammar", "⚡", "replace_selection", "Fix all spelling and grammar errors in the following text. Only correct errors, do not change the style or meaning."),
            ("simplify", "Simplify my writing", "⚡", "insert_after", "Simplify the following text. Use shorter sentences, simpler words, and clearer structure."),
            ("explain", "Explain this", "❓", "answer_in_new", "Explain the following text or concept in clear, simple terms."),
            ("key_takeaways", "List key takeaways", "⚡", "answer_in_new", "List the key takeaways and main points from the following text."),
            ("summarize", "Summarize", "⚡", "answer_in_new", "Provide a concise summary of the following text."),
            ("summarize_long", "Summarize (long)", "⚡", "answer_in_new", "Provide a detailed, comprehensive summary of the following text."),
            ("rewrite_friendly", "Rewrite in friendly tone", "⚡", "insert_after", "Rewrite the following text in a warm, friendly, and approachable tone."),
            ("rewrite_professional", "Rewrite in professional tone", "⚡", "insert_after", "Rewrite the following text in a professional, formal tone suitable for business communication."),
            ("rewrite_persuasive", "Rewrite in persuasive tone", "⚡", "insert_after", "Rewrite the following text in a persuasive, compelling tone."),
            ("rewrite_instructional", "Rewrite in instructional tone", "⚡", "insert_after", "Rewrite the following text as clear, step-by-step instructions."),
        ];

        for (i, (id, label, icon, behavior, prompt)) in seeds.iter().enumerate() {
            conn.execute(
                "INSERT INTO ai_commands (id, label, icon, behavior, system_prompt, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, label, icon, behavior, prompt, i as i64],
            )?;
        }

        Ok(())
    }

    fn seed_assistants(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM assistants", [], |row| row.get(0)
        )?;
        if count > 0 { return Ok(()); }

        let now = chrono::Utc::now().timestamp_millis();
        let seeds = vec![
            ("general_assistant", "General Assistant", "🤖", "A helpful, general-purpose AI assistant.", "You are a helpful AI assistant. Answer questions clearly and concisely."),
            ("creative_writer", "Creative Writer", "✍️", "Specializes in creative writing and storytelling.", "You are a creative writing assistant. Help with stories, poems, scripts and creative content. Be imaginative and expressive."),
            ("code_helper", "Code Helper", "💻", "Expert programmer and code reviewer.", "You are an expert programmer. Help write, debug, and review code. Explain technical concepts clearly. Always provide working code examples."),
            ("research_analyst", "Research Analyst", "🔍", "Thorough researcher and fact-checker.", "You are a research analyst. Provide well-researched, factual answers with attention to detail. Cite sources when possible and present balanced perspectives."),
            ("writing_editor", "Writing Editor", "📝", "Professional editor for polishing text.", "You are a professional editor. Help improve writing quality, grammar, clarity, and style. Provide specific suggestions and explain your edits."),
        ];

        for (i, (id, name, icon, desc, prompt)) in seeds.iter().enumerate() {
            conn.execute(
                "INSERT INTO assistants (id, name, icon, description, system_prompt, is_default, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![id, name, icon, desc, prompt, if i == 0 { 1i64 } else { 0i64 }, i as i64, now, now],
            )?;
        }

        Ok(())
    }

    // ============================================
    // Conversation CRUD
    // ============================================

    pub fn create_conversation(
        &self,
        id: &str,
        title: &str,
        model: &str,
        provider_id: &str,
        system_prompt: Option<&str>,
        folder_id: Option<&str>,
    ) -> Result<Conversation> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();

        conn.execute(
            "INSERT INTO conversations (id, title, model, provider_id, system_prompt, created_at, updated_at, folder_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, title, model, provider_id, system_prompt, now, now, folder_id],
        )?;

        Ok(Conversation {
            id: id.to_string(),
            title: title.to_string(),
            model: model.to_string(),
            provider_id: provider_id.to_string(),
            system_prompt: system_prompt.map(|s| s.to_string()),
            created_at: now,
            updated_at: now,
            is_archived: false,
            folder_id: folder_id.map(|s| s.to_string()),
        })
    }

    pub fn list_conversations(&self) -> Result<Vec<Conversation>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, model, provider_id, system_prompt, created_at, updated_at, is_archived, folder_id
             FROM conversations
             WHERE is_archived = 0
             ORDER BY updated_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                provider_id: row.get(3)?,
                system_prompt: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                is_archived: row.get::<_, i64>(7)? != 0,
                folder_id: row.get(8)?,
            })
        })?;

        rows.collect()
    }

    pub fn get_conversation(&self, id: &str) -> Result<Conversation> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, title, model, provider_id, system_prompt, created_at, updated_at, is_archived, folder_id
             FROM conversations WHERE id = ?1",
            params![id],
            |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    model: row.get(2)?,
                    provider_id: row.get(3)?,
                    system_prompt: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                    is_archived: row.get::<_, i64>(7)? != 0,
                    folder_id: row.get(8)?,
                })
            },
        )
    }

    pub fn update_conversation_title(&self, id: &str, title: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, id],
        )?;
        Ok(())
    }

    pub fn delete_conversation(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn archive_conversation(&self, id: &str, archived: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE conversations SET is_archived = ?1, updated_at = ?2 WHERE id = ?3",
            params![archived as i64, now, id],
        )?;
        Ok(())
    }

    pub fn search_conversations(&self, query: &str) -> Result<Vec<Conversation>> {
        let conn = self.conn.lock().unwrap();
        let pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT DISTINCT c.id, c.title, c.model, c.provider_id, c.system_prompt, c.created_at, c.updated_at, c.is_archived, c.folder_id
             FROM conversations c
             LEFT JOIN messages m ON m.conversation_id = c.id
             WHERE c.title LIKE ?1 OR m.content LIKE ?1
             ORDER BY c.updated_at DESC",
        )?;

        let rows = stmt.query_map(params![pattern], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                model: row.get(2)?,
                provider_id: row.get(3)?,
                system_prompt: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                is_archived: row.get::<_, i64>(7)? != 0,
                folder_id: row.get(8)?,
            })
        })?;

        rows.collect()
    }

    // ============================================
    // Message CRUD
    // ============================================

    pub fn create_message(
        &self,
        id: &str,
        conversation_id: &str,
        role: &str,
        content: &str,
        model: Option<&str>,
        token_count: Option<i64>,
        sort_order: i64,
    ) -> Result<Message> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();

        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, model, token_count, created_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, conversation_id, role, content, model, token_count, now, sort_order],
        )?;

        // Update conversation's updated_at
        conn.execute(
            "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
            params![now, conversation_id],
        )?;

        Ok(Message {
            id: id.to_string(),
            conversation_id: conversation_id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
            model: model.map(|s| s.to_string()),
            token_count,
            created_at: now,
            parent_id: None,
            sort_order,
        })
    }

    pub fn get_messages(&self, conversation_id: &str) -> Result<Vec<Message>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, conversation_id, role, content, model, token_count, created_at, parent_id, sort_order
             FROM messages
             WHERE conversation_id = ?1
             ORDER BY sort_order ASC",
        )?;

        let rows = stmt.query_map(params![conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                model: row.get(4)?,
                token_count: row.get(5)?,
                created_at: row.get(6)?,
                parent_id: row.get(7)?,
                sort_order: row.get(8)?,
            })
        })?;

        rows.collect()
    }

    pub fn get_message_count(&self, conversation_id: &str) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT COUNT(*) FROM messages WHERE conversation_id = ?1",
            params![conversation_id],
            |row| row.get(0),
        )
    }

    pub fn delete_message(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM messages WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ============================================
    // Provider CRUD
    // ============================================

    pub fn save_provider(&self, provider: &Provider) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO providers (id, provider_type, name, api_key, base_url, default_model, enabled)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                provider.id,
                provider.provider_type,
                provider.name,
                provider.api_key,
                provider.base_url,
                provider.default_model,
                provider.enabled as i64,
            ],
        )?;
        Ok(())
    }

    pub fn list_providers(&self) -> Result<Vec<Provider>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, provider_type, name, api_key, base_url, default_model, enabled FROM providers ORDER BY name",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Provider {
                id: row.get(0)?,
                provider_type: row.get(1)?,
                name: row.get(2)?,
                api_key: row.get(3)?,
                base_url: row.get(4)?,
                default_model: row.get(5)?,
                enabled: row.get::<_, i64>(6)? != 0,
            })
        })?;

        rows.collect()
    }

    pub fn get_provider(&self, id: &str) -> Result<Provider> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, provider_type, name, api_key, base_url, default_model, enabled FROM providers WHERE id = ?1",
            params![id],
            |row| {
                Ok(Provider {
                    id: row.get(0)?,
                    provider_type: row.get(1)?,
                    name: row.get(2)?,
                    api_key: row.get(3)?,
                    base_url: row.get(4)?,
                    default_model: row.get(5)?,
                    enabled: row.get::<_, i64>(6)? != 0,
                })
            },
        )
    }

    pub fn delete_provider(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM providers WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ============================================
    // Settings
    // ============================================

    pub fn get_settings(&self) -> Result<AppSettings> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let rows: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        let mut settings = AppSettings::default();
        for (key, value) in rows {
            match key.as_str() {
                "theme" => settings.theme = value,
                "default_model" => settings.default_model = value,
                "default_provider_id" => settings.default_provider_id = value,
                "default_system_prompt" => settings.default_system_prompt = value,
                "global_hotkey" => settings.global_hotkey = value,
                "send_on_enter" => settings.send_on_enter = value == "true",
                "stream_responses" => settings.stream_responses = value == "true",
                "font_size" => settings.font_size = value.parse().unwrap_or(14),
                "accent_color" => settings.accent_color = value,
                "font_family" => settings.font_family = value,
                "chat_bubble_style" => settings.chat_bubble_style = value,
                "code_theme" => settings.code_theme = value,
                "compact_mode" => settings.compact_mode = value == "true",
                "launch_at_login" => settings.launch_at_login = value == "true",
                "start_as_background" => settings.start_as_background = value == "true",
                _ => {}
            }
        }

        Ok(settings)
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let pairs = vec![
            ("theme", settings.theme.clone()),
            ("default_model", settings.default_model.clone()),
            ("default_provider_id", settings.default_provider_id.clone()),
            ("default_system_prompt", settings.default_system_prompt.clone()),
            ("global_hotkey", settings.global_hotkey.clone()),
            ("send_on_enter", settings.send_on_enter.to_string()),
            ("stream_responses", settings.stream_responses.to_string()),
            ("font_size", settings.font_size.to_string()),
            ("accent_color", settings.accent_color.clone()),
            ("font_family", settings.font_family.clone()),
            ("chat_bubble_style", settings.chat_bubble_style.clone()),
            ("code_theme", settings.code_theme.clone()),
            ("compact_mode", settings.compact_mode.to_string()),
            ("launch_at_login", settings.launch_at_login.to_string()),
            ("start_as_background", settings.start_as_background.to_string()),
        ];

        for (key, value) in pairs {
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                params![key, value],
            )?;
        }

        Ok(())
    }

    // ============================================
    // Prompt Templates
    // ============================================

    pub fn list_prompt_templates(&self) -> Result<Vec<PromptTemplate>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, content, category, variables, created_at, updated_at
             FROM prompt_templates ORDER BY name",
        )?;

        let rows = stmt.query_map([], |row| {
            let variables_json: String = row.get(4)?;
            let variables: Vec<String> =
                serde_json::from_str(&variables_json).unwrap_or_default();

            Ok(PromptTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                content: row.get(2)?,
                category: row.get(3)?,
                variables,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;

        rows.collect()
    }

    pub fn save_prompt_template(&self, template: &PromptTemplate) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let variables_json = serde_json::to_string(&template.variables).unwrap_or_default();

        conn.execute(
            "INSERT OR REPLACE INTO prompt_templates (id, name, content, category, variables, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                template.id,
                template.name,
                template.content,
                template.category,
                variables_json,
                template.created_at,
                template.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_prompt_template(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM prompt_templates WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ============================================
    // Folders
    // ============================================

    pub fn list_folders(&self) -> Result<Vec<Folder>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, parent_id, sort_order, created_at FROM folders ORDER BY sort_order",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                sort_order: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        rows.collect()
    }

    pub fn create_folder(&self, id: &str, name: &str) -> Result<Folder> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();

        conn.execute(
            "INSERT INTO folders (id, name, created_at) VALUES (?1, ?2, ?3)",
            params![id, name, now],
        )?;

        Ok(Folder {
            id: id.to_string(),
            name: name.to_string(),
            parent_id: None,
            sort_order: 0,
            created_at: now,
        })
    }

    pub fn delete_folder(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM folders WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ============================================
    // AI Commands
    // ============================================

    pub fn list_ai_commands(&self) -> Result<Vec<AiCommand>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, label, icon, behavior, system_prompt, provider_id, model, output_language, keyboard_shortcut, enabled, sort_order
             FROM ai_commands ORDER BY sort_order",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(AiCommand {
                id: row.get(0)?,
                label: row.get(1)?,
                icon: row.get(2)?,
                behavior: row.get(3)?,
                system_prompt: row.get(4)?,
                provider_id: row.get(5)?,
                model: row.get(6)?,
                output_language: row.get(7)?,
                keyboard_shortcut: row.get(8)?,
                enabled: row.get::<_, i64>(9)? != 0,
                sort_order: row.get(10)?,
            })
        })?;

        rows.collect()
    }

    pub fn save_ai_command(&self, cmd: &AiCommand) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO ai_commands (id, label, icon, behavior, system_prompt, provider_id, model, output_language, keyboard_shortcut, enabled, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                cmd.id,
                cmd.label,
                cmd.icon,
                cmd.behavior,
                cmd.system_prompt,
                cmd.provider_id,
                cmd.model,
                cmd.output_language,
                cmd.keyboard_shortcut,
                cmd.enabled as i64,
                cmd.sort_order,
            ],
        )?;
        Ok(())
    }

    pub fn delete_ai_command(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM ai_commands WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ============================================
    // Assistant CRUD
    // ============================================

    pub fn list_assistants(&self) -> Result<Vec<Assistant>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, icon, description, system_prompt, provider_id, model, temperature, max_tokens, is_default, sort_order, created_at, updated_at
             FROM assistants ORDER BY sort_order",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Assistant {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                description: row.get(3)?,
                system_prompt: row.get(4)?,
                provider_id: row.get(5)?,
                model: row.get(6)?,
                temperature: row.get(7)?,
                max_tokens: row.get(8)?,
                is_default: row.get::<_, i64>(9)? != 0,
                sort_order: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        rows.collect()
    }

    pub fn save_assistant(&self, a: &Assistant) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();

        // If setting as default, clear other defaults first
        if a.is_default {
            conn.execute("UPDATE assistants SET is_default = 0", [])?;
        }

        conn.execute(
            "INSERT OR REPLACE INTO assistants (id, name, icon, description, system_prompt, provider_id, model, temperature, max_tokens, is_default, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, COALESCE((SELECT created_at FROM assistants WHERE id = ?1), ?12), ?13)",
            params![
                a.id,
                a.name,
                a.icon,
                a.description,
                a.system_prompt,
                a.provider_id,
                a.model,
                a.temperature,
                a.max_tokens,
                a.is_default as i64,
                a.sort_order,
                now,
                now,
            ],
        )?;
        Ok(())
    }

    pub fn delete_assistant(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM assistants WHERE id = ?1", params![id])?;
        Ok(())
    }
}
