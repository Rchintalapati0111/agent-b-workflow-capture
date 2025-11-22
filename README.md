# AI-Powered Workflow Automation System

> Autonomous multi-agent system using GPT-4 Vision to capture and automate web application workflows

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4--Vision-blue.svg)](https://openai.com/)
[![Playwright](https://img.shields.io/badge/Playwright-Latest-orange.svg)](https://playwright.dev/)

## 🎯 Overview

Agent B is an intelligent workflow automation system that uses computer vision and natural language processing to:
- 📸 Automatically capture UI states across web applications
- 🧠 Understand and execute tasks from natural language descriptions
- 📐 Use spatial geometry to locate UI elements by visual position
- 🎨 Work across ANY web app without hardcoded selectors
- 🔄 Handle complex interactions (modals, forms, contenteditable fields)

## ✨ Key Features

- **GPT-4 Vision Integration**: Analyzes screenshots to understand UI structure
- **Spatial Intelligence**: Finds elements using phrases like "under Name field"
- **Smart Focus Detection**: Automatically detects and types into active fields
- **Zero Hardcoding**: No app-specific selectors—100% AI-driven
- **Multi-App Support**: Tested on Linear, Trello (easily extends to others)

## 🏗️ Architecture
```
Task Description (Natural Language)
         ↓
   AI Task Planner (GPT-4)
         ↓
   Vision Analysis (GPT-4 Vision) → Screenshot
         ↓
   Spatial Geometry Engine
         ↓
   Selector Generation + Fallbacks
         ↓
   Playwright Execution
         ↓
   Workflow Capture (Screenshots + Metadata)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key

### Installation
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/agent-b-workflow-capture.git
cd agent-b-workflow-capture

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your OpenAI API key to .env
```

### Usage
```bash
# Run the multi-app demo (Trello + Linear)
node index.js
```

## 📁 Project Structure
```
agent-b-workflow-capture/
├── ai-agent.js              # GPT-4 integration & task planning
├── playwright-executor.js   # Browser automation & spatial engine
├── workflow-capture.js      # Main orchestration logic
├── selector-generator.js    # Dynamic selector generation
├── index.js                 # Multi-app demo runner
└── captured-workflows/      # Output: screenshots + metadata
```

## 🎬 Example Tasks
```javascript
// Linear: Create a project
'Type "AI Automation Project" in the field under "Name", then click the Create project button'

// Trello: Add a card
'In the "This Week" list, click the "Add a card" button, then type "Plan team offsite"'
```

## 🧠 How It Works

### 1. Task Planning
Uses GPT-4 to break down natural language into steps

### 2. Vision Analysis
GPT-4 Vision analyzes screenshots to generate selectors

### 3. Spatial Search
Finds elements by geometric position relative to labels

### 4. Smart Execution
- Detects already-focused fields
- Handles contenteditable divs
- Robust fallback chains

## 📊 Results

- ✅ **5/5 tasks** successfully captured
- ✅ **2 applications** (Linear, Trello)
- ✅ **0% hardcoded** selectors
- ✅ **100% generalizable** to new apps

## 🛠️ Technologies

- **AI/ML**: OpenAI GPT-4, GPT-4 Vision
- **Automation**: Playwright
- **Runtime**: Node.js
- **Architecture**: Multi-agent system with vision-language models

---

Built using GPT-4 Vision and Playwright
