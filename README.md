# Zitong

A modern, cross-platform AI chat client built with Tauri 2 and React 19. Zitong provides a beautiful, native desktop experience for interacting with multiple AI providers, featuring GitHub Copilot integration, customizable assistants, and advanced prompt management.

## ✨ Features

- **Multi-Provider Support**: Connect to 10+ AI providers including:
  - OpenAI (ChatGPT)
  - Anthropic (Claude)
  - Google Gemini
  - GitHub Copilot (with OAuth)
  - Ollama (local models)
  - Mistral AI
  - Groq
  - DeepSeek
  - OpenRouter
  - xAI

- **Smart Conversations**: 
  - Multiple conversation threads with folders
  - Inline conversation renaming
  - Search and archive capabilities
  - Auto-save with SQLite database

- **Customizable Assistants**: 
  - Create custom AI personas with specific system prompts
  - Configure temperature, max tokens, and preferred models
  - 5 pre-configured assistants included

- **Prompt Templates**: 
  - Reusable prompt templates with variable substitution
  - Category organization
  - Variable detection with `{{variable}}` syntax

- **AI Commands**: 
  - 12 built-in commands for common tasks
  - Customizable behavior, provider, model, and language settings
  - Keyboard shortcut support

- **Modern UI**:
  - Light/dark/system theme support
  - 7 accent color options
  - Customizable font family and size
  - Code syntax highlighting with theme selection
  - Compact mode for efficient screen usage
  - Chat bubble or plain message styles

- **Developer-Friendly**:
  - Global keyboard shortcuts
  - Code block copying with clipboard integration
  - Markdown rendering with GitHub Flavored Markdown
  - Stream responses in real-time

- **Native Experience**:
  - macOS overlay support above fullscreen apps
  - System tray integration
  - Auto-start capability
  - Cross-platform (macOS, Windows, Linux)

## 🛠️ Tech Stack

### Backend
- **Tauri 2.x**: Rust-based desktop application framework
- **Rust**: Systems programming language
- **SQLite**: Local database (rusqlite with bundled SQLite)
- **reqwest**: HTTP client with streaming support
- **Tokio**: Async runtime

### Frontend
- **React 19**: Modern UI library
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool and dev server
- **Tailwind CSS 4**: Utility-first CSS framework
- **Lucide React**: Beautiful icon library
- **React Markdown**: Markdown rendering
- **React Syntax Highlighter**: Code syntax highlighting

### Tauri Plugins
- Global Shortcuts
- Clipboard Manager
- Dialog
- Opener
- Auto-start
- tauri-nspanel (macOS overlay)

## 📋 Prerequisites

- **Node.js** (v18 or later)
- **pnpm** (package manager)
- **Rust** (latest stable)
- **Operating System**: macOS 10.15+, Windows 10+, or Linux

## 🚀 Installation

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/sykuang/Zitong.git
   cd Zitong
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Run in development mode**
   ```bash
   pnpm tauri dev
   ```

### Building for Production

1. **Build the application**
   ```bash
   pnpm tauri build
   ```

2. **Install the built application**
   
   **macOS:**
   ```bash
   pnpm run install:dmg
   ```
   This will mount the DMG and copy the app to your Applications folder.

   **Windows/Linux:**
   The installer will be in `src-tauri/target/release/bundle/`

## 🎯 Usage

### First Run

1. Launch Zitong
2. Click the settings icon (⚙️) in the sidebar
3. Navigate to the **Providers** tab
4. Add your API keys for the AI providers you want to use

### GitHub Copilot Setup

1. Go to Settings → Providers
2. Select "GitHub Copilot"
3. Click "Authenticate with GitHub"
4. Complete the OAuth flow in your browser
5. Once authenticated, your models will be available

### Creating Conversations

1. Click "New Chat" in the sidebar
2. Select an assistant (optional)
3. Choose your AI model from the dropdown
4. Start chatting!

### Using Assistants

1. Go to Settings → Assistants
2. Create or edit an assistant
3. Set a system prompt, icon, and default model
4. Use the assistant selector in the chat header

### Prompt Templates

1. Go to Settings → Templates
2. Create a new template with `{{variable}}` placeholders
3. Use templates in your conversations by selecting them

### AI Commands

1. Go to Settings → Commands
2. Review or create custom commands
3. Configure behavior, provider, model, and shortcuts
4. Use commands for quick text processing tasks

## ⌨️ Keyboard Shortcuts

- **Global Hotkey**: Customizable (Settings → Shortcuts)
- **New Chat**: `Cmd/Ctrl + N`
- **Settings**: `Cmd/Ctrl + ,`
- **Toggle Sidebar**: `Cmd/Ctrl + \`
- **Search**: `Cmd/Ctrl + F`
- **Send Message**: `Enter` (configurable)

## 🗄️ Data Storage

Zitong stores all data locally in a SQLite database:

- **macOS**: `~/Library/Application Support/com.primattek.zitong/zitong.db`
- **Windows**: `%APPDATA%\com.primattek.zitong\zitong.db`
- **Linux**: `~/.local/share/com.primattek.zitong/zitong.db`

The database includes:
- Conversations and messages
- AI provider configurations
- Settings and preferences
- Prompt templates
- Custom assistants
- AI commands

## 🔧 Development

### Project Structure

```
Zitong/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── context/           # React context providers
│   ├── commands/          # Tauri IPC wrappers
│   └── types/             # TypeScript types
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands.rs    # Tauri command handlers
│   │   ├── providers.rs   # AI provider implementations
│   │   ├── db.rs          # SQLite database layer
│   │   ├── panel.rs       # macOS overlay support
│   │   └── lib.rs         # Main entry point
│   └── Cargo.toml         # Rust dependencies
├── package.json           # Node.js dependencies
└── vite.config.ts         # Vite configuration
```

### Running Tests

```bash
# Frontend tests
pnpm test

# Rust tests
cd src-tauri
cargo test
```

### Code Style

- **Frontend**: ESLint + Prettier
- **Backend**: rustfmt + clippy

```bash
# Format Rust code
cd src-tauri
cargo fmt

# Lint Rust code
cargo clippy
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Inspired by [BoltAI](https://boltai.com/)
- Icons from [Lucide](https://lucide.dev/)

## 📧 Contact

- GitHub: [@sykuang](https://github.com/sykuang)
- Project Link: [https://github.com/sykuang/Zitong](https://github.com/sykuang/Zitong)

---

**Note**: This is an early-stage project under active development. Some features may be incomplete or experimental.
