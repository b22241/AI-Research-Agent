# 🤖 AI Research Agent

A production-grade agentic research assistant that autonomously searches the web, scores source credibility, streams answers in real time, and remembers conversation context — built with LangGraph, FastAPI, and React.

> **Inspired by Perplexity AI** — but built from scratch with a full agentic pipeline, structured outputs, and self-healing retry logic.

---

## 🌐 Live Demo

| Service | URL |
|---|---|
| **Frontend** | http://ai-research-agent-frontend.s3-website.ap-south-1.amazonaws.com |
| **Backend Health** | http://13.126.31.239:8000/health |

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔍 **Web Search** | Fetches real-time results using Tavily API |
| 🧠 **LLM Answer Generation** | Groq + LLaMA 3.3 70B generates structured answers |
| 💬 **Conversation Memory** | Remembers full chat history across follow-up questions |
| 🔄 **Multi-step Reasoning** | Agent self-evaluates and retries with a refined query if the answer is weak |
| 🏷️ **Query Intent Classifier** | Classifies queries as `factual`, `news`, or `followup` — each uses a different search strategy |
| 📊 **Source Credibility Scoring** | Rates each source domain (0–100) with an overall confidence % |
| 🧱 **Structured Output** | Every answer returns a typed Pydantic schema: headline, summary, key points, follow-up suggestion |
| ⚡ **Streaming Responses** | Tokens stream in real time via Server-Sent Events — just like ChatGPT |
| 📄 **Export to PDF** | Download the full chat with sources and scores as a formatted PDF |
| 🕐 **Timestamps + Copy** | Every message has a timestamp and a one-click copy button |
| 🎨 **Eye-soothing UI** | Sage green + warm cream palette with smooth fade animations |
| 🚀 **CI/CD Pipeline** | GitHub Actions auto-deploys frontend to S3 and backend to EC2 on every push |

---

## 🏗️ Architecture

```
User (React UI — AWS S3)
      │
      │  HTTP POST /ask/stream  (Server-Sent Events)
      ▼
FastAPI Server (AWS EC2 — Python)
      │
      ├── classify_intent()      → factual / news / followup
      ├── search_and_score()     → Tavily web search + domain credibility scoring
      └── stream_answer()        → Groq LLaMA 3.3 streams tokens via SSE
            │
            ▼
     LangGraph Agent  (/ask endpoint)
            ├── classify node      → intent detection
            ├── search node        → Tavily API (strategy based on intent)
            ├── score_sources node → domain reputation scoring
            ├── answer node        → Groq API (Pydantic structured output)
            ├── evaluate node      → GOOD / WEAK quality check
            └── refine_query node  → retries with better query if WEAK (max 2x)
```

### Query Intent → Search Strategy

| Intent | Trigger | Search Query | Max Sources |
|---|---|---|---|
| `factual` | definitions, concepts, how things work | original query | 3 |
| `news` | latest, current, recent, today | query + "latest 2025" | 5 |
| `followup` | that, it, more, explain further | chat context + query | 3 |

### Self-Retry Agentic Loop

```
search → score → answer → evaluate ── GOOD ──→ END
                               │
                             WEAK
                               ↓
                         refine_query → search  (max 2 retries)
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Python 3.12 | Core language |
| FastAPI | REST API + SSE streaming |
| LangGraph | Agentic graph orchestration with conditional edges |
| LangChain | LLM + tool integration |
| Groq (LLaMA 3.3 70B) | Ultra-fast LLM inference |
| Tavily | AI-native web search API |
| Pydantic | Structured output schema validation |
| Uvicorn | ASGI server |
| PM2 | Process manager on EC2 |

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework |
| jsPDF | PDF export |
| Native Fetch API | SSE token-by-token streaming |
| CSS animations | Smooth fade-up message effects |

### Infrastructure
| Service | Purpose |
|---|---|
| AWS EC2 t3.micro | Backend hosting |
| AWS S3 | Frontend static website hosting |
| GitHub Actions | CI/CD pipeline |
| PM2 | Auto-restart on EC2 reboot |

---

## 📁 Project Structure

```
AI-Research-Agent/
├── .github/
│   └── workflows/
│       ├── frontend.yml      # Build React + deploy to S3
│       └── backend.yml       # SSH into EC2 + git pull + pm2 restart
├── backend/
│   ├── agent.py              # LangGraph agent, intent classifier, search, streaming
│   ├── main.py               # FastAPI routes: /ask, /ask/stream, /health
│   ├── requirements.txt      # Python dependencies
│   └── .env                  # API keys (gitignored)
├── frontend/
│   ├── src/
│   │   └── App.jsx           # Full React UI with streaming, sources, PDF export
│   ├── .env                  # VITE_API_URL (gitignored)
│   ├── index.html
│   └── vite.config.js
├── .gitignore
├── README.md
└── DEPLOYMENT.md             # Full AWS deployment guide
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Python 3.10+
- Node.js 20+
- [Groq API key](https://console.groq.com) — free
- [Tavily API key](https://app.tavily.com) — free

### 1. Clone the repo

```bash
git clone https://github.com/b22241/ai-research-agent.git
cd ai-research-agent
```

### 2. Setup backend

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install langgraph langchain langchain-community langchain-groq langchain-core tavily-python fastapi uvicorn python-dotenv pydantic
```

Create `backend/.env`:

```env
GROQ_API_KEY=your_groq_key_here
TAVILY_API_KEY=your_tavily_key_here
```

Start backend:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 3. Setup frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Start frontend:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) 🚀

---

## 🔌 API Reference

### `POST /ask`
Standard (non-streaming) query endpoint.

**Request:**
```json
{
  "query": "What is LangGraph?",
  "chat_history": [
    { "role": "user", "content": "Tell me about AI agents" },
    { "role": "assistant", "content": "AI agents are..." }
  ]
}
```

**Response:**
```json
{
  "answer": {
    "headline": "LangGraph is a library for building stateful multi-actor LLM applications.",
    "summary": "LangGraph extends LangChain by enabling cyclic graph structures...",
    "key_points": [
      "Supports cyclic graphs for agent workflows",
      "Built on top of LangChain",
      "Enables multi-agent coordination"
    ],
    "follow_up": "How does LangGraph compare to AutoGen?"
  },
  "sources": [
    {
      "url": "https://langchain-ai.github.io/langgraph/",
      "domain": "langchain-ai.github.io",
      "score": 85,
      "label": "High",
      "preview": "LangGraph is a library for building..."
    }
  ],
  "confidence": 85,
  "attempts": 1,
  "intent": "factual"
}
```

### `POST /ask/stream`
Streaming endpoint using Server-Sent Events. Emits three event types in order:

```
data: {"type": "meta", "intent": "factual", "confidence": 85, "sources": [...]}

data: {"type": "token", "text": "Lang"}
data: {"type": "token", "text": "Graph"}
...

data: {"type": "done"}
```

### `GET /health`
```json
{ "status": "ok" }
```

---

## 📊 Source Credibility Scoring System

Each source URL is scored based on its domain reputation:

| Score | Label | Example Domains |
|---|---|---|
| 90–100 | Very High | reuters.com, bbc.com, apnews.com, nasa.gov, .edu, .gov |
| 75–89 | High | nytimes.com, bloomberg.com, arxiv.org, ft.com, wired.com |
| 60–74 | Medium | wikipedia.org, stackoverflow.com, investopedia.com |
| Below 60 | Low | medium.com, reddit.com, quora.com, substack.com |

The **Confidence %** badge shown in the UI is the average score across all sources returned for that query.

---

## 🔄 CI/CD Pipeline

### How it works

```
You make changes locally
        ↓
git add . && git commit -m "update" && git push
        ↓
GitHub Actions triggers automatically
        ↓
frontend/** changed? → npm install → npm build → aws s3 sync  →  live in ~1 min
backend/**  changed? → SSH into EC2 → git pull → pm2 restart  →  live in ~30 sec
```

### Workflow triggers

| Workflow | File | Triggers when |
|---|---|---|
| Deploy Frontend to S3 | `frontend.yml` | Any file inside `frontend/` changes |
| Deploy Backend to EC2 | `backend.yml` | Any file inside `backend/` changes |

### Required GitHub Secrets

| Secret Name | Value |
|---|---|
| `VITE_API_URL` | `http://YOUR_EC2_IP:8000` |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key |
| `S3_BUCKET_NAME` | `ai-research-agent-frontend` |
| `EC2_HOST` | EC2 public IP address |
| `EC2_SSH_KEY` | Full contents of `.pem` key file |

---

## 🧠 Why This Project Demonstrates AI Engineering Skills

| visl.ai Requirement | How This Project Covers It |
|---|---|
| **LLMs** | Groq + LLaMA 3.3 70B for structured answer generation |
| **Agentic systems** | LangGraph graph with conditional edges, self-retry loop, intent routing |
| **Multimodal** | Architecture ready for Gemini Vision integration |
| **Fine-tuning** | Pydantic structured output acts as prompt engineering + output control |
| **Expert coding** | SSE streaming, Pydantic schemas, async FastAPI, React hooks |
| **Production engineering** | CI/CD pipeline, PM2, AWS S3 + EC2, environment secrets |
| **Startup thinking** | End-to-end product: PDF export, confidence scoring, Perplexity-like UX |

---

## 🗺️ Roadmap

- [ ] Multimodal input — image + question via Gemini Vision
- [ ] User authentication + persistent chat history via MongoDB
- [ ] Docker containerization
- [ ] HTTPS with custom domain via AWS CloudFront
- [ ] Agent memory across sessions using LangGraph persistence
- [ ] RAG pipeline on custom documents

---

## 👤 Author

**Suman (b22241)**
IIT Mandi
[GitHub](https://github.com/b22241)

---

## 📄 License

MIT License — free to use, modify, and distribute.