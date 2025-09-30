# Volcano SDK Documentation

This directory contains the comprehensive documentation for Volcano SDK.

## Viewing the Documentation

Open `index.html` in your browser, or serve it with a static file server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

## Structure

The documentation is organized into separate pages:

- **index.html** - Getting Started (introduction, installation, quick start, core concepts)
- **providers.html** - LLM Providers (OpenAI, Anthropic, Mistral, Llama, Bedrock, Vertex, Azure)
- **patterns.html** - Advanced Patterns (parallel, branching, loops, sub-agents)
- **features.html** - Features (streaming, retries, hooks, errors, MCP tools)
- **api.html** - API Reference (agent(), step types, results)
- **styles.css** - Beautiful, modern styling similar to AI SDK docs
- **script.js** - Interactive features (navigation, syntax highlighting, copy buttons)

## Features

- ✨ Clean, modern design with white background
- 📱 Fully responsive (mobile, tablet, desktop)
- 🎨 Syntax highlighting for code examples
- 🔍 Active section highlighting in navigation
- 📋 Copy buttons on all code blocks
- ⌨️ Keyboard navigation support
- 🎯 Smooth scrolling
- 📊 Interactive examples and API references
- 🔗 Multi-page navigation with consistent sidebar
- 📱 Mobile hamburger menu

## Page Structure

Each page follows the same structure:
- **Sidebar Navigation** - Persistent navigation across all pages
- **Main Content** - Section-specific content with examples
- **Interactive Features** - Copy buttons, smooth scrolling, active highlighting

## Coverage

### Getting Started (index.html)
- Introduction with feature highlights
- Installation instructions
- Quick start examples
- Core concepts (agents, steps, context)

### Providers (providers.html)
- OpenAI configuration and models
- Anthropic (Claude) with tool calling
- Mistral cloud API
- Llama local setup with Ollama
- AWS Bedrock enterprise authentication
- Google Vertex Studio Gemini models
- Azure AI OpenAI Service

### Advanced Patterns (patterns.html)
- Parallel execution (array & dictionary modes)
- Conditional branching (if/else & switch/case)
- Loops (while, forEach, retryUntil)
- Sub-agent composition
- Combined pattern examples

### Features (features.html)
- Streaming workflows
- Retries & timeouts (immediate, delayed, exponential)
- Step hooks (pre/post execution)
- Error handling with typed errors
- MCP tools (automatic & explicit)

### API Reference (api.html)
- agent() function with all options
- Step types (LLM-only, automatic MCP, explicit MCP)
- StepResult types with metrics
- RetryConfig types
- Utility functions

## Contributing

To update the documentation:

1. Edit the appropriate HTML page (`index.html`, `providers.html`, etc.)
2. Update `styles.css` for styling changes
3. Modify `script.js` for interactive features
4. Keep navigation consistent across all pages
5. Test locally before committing

## Design Inspiration

The design is inspired by the [AI SDK documentation](https://ai-sdk.dev/docs) with:
- Clean white background
- Clear typography with Inter font
- Well-organized sidebar navigation
- Comprehensive code examples
- Professional color scheme
- Multi-page structure for better organization
