# Zitong

**Your AI, one shortcut away — even above fullscreen apps.**

Zitong is a native desktop AI chat client for macOS, Windows, and Linux. Press a hotkey, select any text in any app, and let AI transform it instantly — no context switching required.

Lightweight, private (all data stored locally), and works with 10+ AI providers.

---

## Why Zitong?

Most AI chat apps are browser tabs. Zitong is different:

- **Instant overlay** — Press `⌘⇧Space` to summon a Spotlight-like command palette that floats above *everything*, including fullscreen apps, across all macOS Spaces.
- **Works on selected text** — Zitong auto-captures your current selection, runs an AI command on it, and gives you the result ready to paste back. No copy-paste dance.
- **10+ providers, one app** — Switch between OpenAI, Claude, Gemini, Copilot, Ollama (local), and more. Mix and match per conversation.
- **100% local data** — Conversations, settings, and templates live in a local SQLite database. Nothing leaves your machine except API calls to your chosen provider.

---

## ✨ Key Features

### 🎯 Overlay Command Palette

The headline feature. A Spotlight-style panel you can invoke from anywhere:

1. **Select text** in any app (browser, editor, terminal, etc.)
2. **Press the global hotkey** (`⌘⇧Space` by default)
3. **Pick an AI command** — Zitong auto-copies your selection, sends it to the LLM with the command's prompt
4. **Act on the result:**
   - **Replace** — puts the AI result in your clipboard, ready to paste over the original
   - **Insert After** — appends the result after your original text
   - **Open in Chat** — continues the conversation in the full chat window
   - **Shorter / Longer** — quick refinements without leaving the overlay
   - **Follow-up** — type a custom instruction to iterate on the result

> Works above fullscreen apps on macOS via NSPanel. On Windows/Linux, the overlay uses a standard always-on-top window.

### 💬 Full Chat Interface

A complete conversation UI when you need more than a quick command:

- **Streaming responses** with real-time token display and stop button
- **Markdown + syntax-highlighted code blocks** (with one-click copy)
- **Switch provider & model mid-conversation** — models are fetched live from each provider's API
- **Auto-generated conversation titles** after the first exchange
- **Token count** per message
- **Multiple chat styles** — Minimal, Bubble, or Card layout

### 🤖 Custom Assistants

Create AI personas tailored to your workflow:

- Define a system prompt, emoji icon, and description
- Override provider, model, temperature (0–2), and max tokens per assistant
- Set a default assistant that's auto-selected on launch
- Switch assistants mid-conversation from the chat header

### 📝 Prompt Templates

Reusable prompts with dynamic variables:

- Use `{{variable}}` syntax — variables are auto-detected and shown in a visual preview
- Organize templates by category (General, Coding, Writing, Analysis, Creative)

### ⚡ AI Commands

Customizable commands that power the overlay palette:

- Configure each command's **behavior** (Replace, Insert After, or Open in Chat)
- Set a **system prompt**, **provider**, **model**, and **output language** per command
- Assign **keyboard shortcuts** for your most-used commands
- Enable/disable and reorder commands

### 🔌 Multi-Provider Support

Connect to any combination of these providers:

| Provider | Auth | Notes |
|---|---|---|
| OpenAI | API key | GPT-4o, GPT-4, etc. |
| Anthropic | API key | Claude 3.5, Claude 3, etc. |
| Google Gemini | API key | |
| GitHub Copilot | **OAuth** | Full device-flow sign-in |
| Ollama | None | Local models, no API key needed |
| Mistral | API key | |
| Groq | API key | |
| DeepSeek | API key | |
| OpenRouter | API key | |
| xAI (Grok) | API key | |
| OpenAI-compatible | API key + base URL | Any compatible endpoint |

Each provider supports: enable/disable toggle, live model fetching, set-as-default, and connection testing.

### 🎨 Appearance & Customization

- **Theme:** System, Light, or Dark
- **Accent colors:** Violet, Blue, Purple, Green, Orange, Red, Pink, Cyan
- **Font:** System Default, Inter, JetBrains Mono, SF Pro (size 12–20px)
- **Code themes:** One Dark, GitHub, Dracula, Solarized
- **Compact mode** for smaller screens

### 🖥️ Native Desktop Experience

- **System tray** — close the window and Zitong keeps running in the background
- **Launch at login** — start hidden, ready for your first hotkey press
- **macOS menu bar** integration with standard Edit/Window menus
- **Separate settings window** — changes sync live to the main app

## 🔍 Comparison with Alternatives

| Feature | Zitong | BoltAI | ChatGPT App | Claude App | Raycast AI | Jan | Msty |
|---|---|---|---|---|---|---|---|
| **Overlay above fullscreen apps** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Auto-capture selected text** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Multi-provider (10+)** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Local models (Ollama)** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **GitHub Copilot support** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Custom AI commands** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Custom assistants** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **Prompt templates with variables** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Cross-platform** | ✅ macOS/Win/Linux | ❌ macOS only | ✅ macOS/Win | ✅ macOS/Win | ❌ macOS only | ✅ macOS/Win/Linux | ✅ macOS/Win/Linux |
| **Open source** | ✅ MIT | ❌ | ❌ | ❌ | ❌ | ✅ AGPL | ❌ |
| **100% local data** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Free** | ✅ | ❌ Paid | ✅ Free tier | ✅ Free tier | ❌ Paid | ✅ | ✅ Free tier |

**In short:** Zitong combines the overlay-driven workflow of BoltAI with cross-platform support, GitHub Copilot integration, and full open-source transparency — at no cost.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Tauri 2.x (Rust backend + webview frontend) |
| **Frontend** | React 19 · TypeScript · Vite · Tailwind CSS 4 |
| **Database** | SQLite (via rusqlite, bundled) |
| **HTTP/Streaming** | reqwest + Tokio async runtime |
| **UI Libraries** | Lucide icons · React Markdown (GFM) · React Syntax Highlighter |
| **Tauri Plugins** | Global Shortcuts · Clipboard Manager · Dialog · Opener · Auto-start · tauri-nspanel (macOS overlay) |

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

### macOS: Bypassing Gatekeeper (Unsigned Build)

Release builds are **not notarized or code-signed**, so macOS Gatekeeper will block the app on first launch. Use one of the methods below to allow it.

#### Option A — Right-click → Open (easiest)

1. Open **Finder** → **Applications**
2. **Right-click** (or Control-click) **Zitong.app**
3. Select **Open** from the context menu
4. In the dialog that appears, click **Open**

You only need to do this once; subsequent launches work normally.

#### Option B — System Settings

1. Try opening Zitong normally (it will be blocked)
2. Go to **System Settings → Privacy & Security**
3. Scroll down — you'll see *"Zitong" was blocked from use because it is not from an identified developer*
4. Click **Open Anyway** and authenticate

#### Option C — Terminal (`xattr`)

```bash
xattr -cr /Applications/Zitong.app
```

This strips the quarantine flag. You can then open the app normally.

## 🎯 Quick Start

### 1. Set up a provider

Launch Zitong → open **Settings** (`⌘,`) → go to **Providers** → add an API key for at least one provider (or connect GitHub Copilot via OAuth, or point to a local Ollama instance).

### 2. Chat

Click **New Chat** in the sidebar or press `⌘N`. Pick a model from the dropdown and start talking.

### 3. Use the overlay

Select text anywhere on your screen → press `⌘⇧Space` → pick a command (e.g., "Fix Grammar", "Explain Code", "Translate") → the result is ready to paste.

### GitHub Copilot Setup

1. Settings → Providers → select **GitHub Copilot**
2. Click **Authenticate with GitHub** — a device code is shown and auto-copied
3. Complete the OAuth flow in your browser
4. Models become available immediately

## ⌨️ Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|---|---|---|
| **Overlay Command Palette** | `⌘⇧Space` (customizable) | `Ctrl+Shift+Space` |
| New Chat | `⌘N` | `Ctrl+N` |
| Toggle Sidebar | `⌘B` | `Ctrl+B` |
| Open Settings | `⌘,` | `Ctrl+,` |
| Search Conversations | `⌘K` | `Ctrl+K` |
| Focus Chat Input | `⌘L` | `Ctrl+L` |
| Delete Conversation | `⌘⇧⌫` | `Ctrl+Shift+Backspace` |

The global hotkey is fully customizable in Settings → Shortcuts with a visual key recorder.

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
