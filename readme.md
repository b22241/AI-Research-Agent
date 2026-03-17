# 🤖 AI Research Agent

An intelligent, agentic research assistant that autonomously searches the web, evaluates source credibility, streams answers in real time, and remembers conversation context — built with LangGraph, FastAPI, and React.

> **Inspired by Perplexity AI** — but built from scratch with a full agentic pipeline.

---

## 🌐 Live Demo

> **Frontend:** [Coming Soon — S3 Deployment]
> **Backend API:** [Coming Soon — EC2 Deployment]

---

## 📸 Features

| Feature | Description |
|---|---|
| 🔍 **Web Search** | Fetches real-time results from the web using Tavily |
| 🧠 **LLM Answer Generation** | Groq + LLaMA 3.3 70B generates structured answers |
| 💬 **Conversation Memory** | Remembers full chat history across follow-up questions |
| 🔄 **Multi-step Reasoning** | Agent self-evaluates and retries with a refined query if answer is weak |
| 🏷️ **Query Intent Classifier** | Classifies queries as `factual`, `news`, or `followup` — each uses a different search strategy |
| 📊 **Source Credibility Scoring** | Rates each source domain (0–100) with confidence % for the overall answer |
| 🧱 **Structured Output** | Every answer returns a typed Pydantic schema: headline, summary, key points, follow-up suggestion |
| ⚡ **Streaming Responses** | Tokens stream in real time via Server-Sent Events — just like ChatGPT |
| 📄 **Export to PDF** | Download the full chat with sources and scores as a formatted PDF |
| 🕐 **Timestamps + Copy** | Every message has a timestamp and a one-click copy button |

---

## 🏗️ Architecture

```
User (React UI)
      │
      │  HTTP POST /ask/stream (SSE)
      ▼
FastAPI Server (Python)
      │
      ├── classify_intent()     → factual / news / followup
      ├── search_and_score()    → Tavily web search + domain credibility scoring
      └── stream_answer()       → Groq LLaMA 3 streams tokens via SSE
            │
            ▼
     LangGraph Agent (for non-streaming /ask)
            ├── classify node
            ├── search node       → Tavily API
            ├── score_sources node
            ├── answer node       → Groq API (structured Pydantic output)
            ├── evaluate node     → GOOD / WEAK quality check
            └── refine_query node → retries with better query if WEAK
```

### Search Strategy by Intent

| Intent | Search Query | Max Results |
|---|---|---|
| `factual` | Original query | 3 |
| `news` | Query + "latest 2025" | 5 |
| `followup` | Recent chat context + query | 3 |

---

## 🛠️ Tech Stack

**Backend**
- [Python 3.12](https://python.org)
- [FastAPI](https://fastapi.tiangolo.com) — REST API + Server-Sent Events streaming
- [LangGraph](https://langchain-ai.github.io/langgraph/) — Agentic graph orchestration
- [LangChain](https://langchain.com) — LLM + tool integration
- [Groq](https://groq.com) — Ultra-fast LLaMA 3.3 70B inference
- [Tavily](https://tavily.com) — AI-native web search API
- [Pydantic](https://docs.pydantic.dev) — Structured output schema validation

**Frontend**
- [React 18](https://react.dev) + [Vite](https://vitejs.dev)
- [jsPDF](https://github.com/parallax/jsPDF) — PDF export
- Native `fetch` with `ReadableStream` for SSE token streaming

**Infrastructure**
- AWS EC2 (backend) + AWS S3 (frontend)
- GitHub Actions (CI/CD)
- PM2 (process manager)

---

## 📁 Project Structure

```
AI-Research-Agent/
├── backend/
│   ├── agent.py          # LangGraph agent, intent classifier, search, streaming
│   ├── main.py           # FastAPI routes (/ask, /ask/stream, /health)
│   └── .env              # API keys (gitignored)
├── frontend/
│   ├── src/
│   │   └── App.jsx       # Full React UI with streaming, sources, PDF export
│   ├── index.html
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Groq API key](https://console.groq.com) (free)
- [Tavily API key](https://app.tavily.com) (free)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/ai-research-agent.git
cd ai-research-agent
```

### 2. Setup backend

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

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
npm install jspdf axios
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

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
    "headline": "LangGraph is a library for building stateful, multi-actor LLM applications.",
    "summary": "LangGraph extends LangChain...",
    "key_points": ["Supports cyclic graphs", "Built for agent workflows", "..."],
    "follow_up": "How does LangGraph compare to LangChain?"
  },
  "sources": [
    {
      "url": "https://langchain-ai.github.io/langgraph/",
      "domain": "langchain-ai.github.io",
      "score": 85,
      "label": "High",
      "preview": "LangGraph is a library..."
    }
  ],
  "confidence": 85,
  "attempts": 1,
  "intent": "factual"
}
```

### `POST /ask/stream`
Streaming endpoint using Server-Sent Events.

Emits three event types:
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

## 🧠 How the Agentic Loop Works

```
1. classify_node   → decides intent: factual / news / followup
2. search_node     → Tavily search (strategy depends on intent)
3. score_sources   → rates each domain, calculates confidence %
4. answer_node     → Groq LLaMA 3 generates structured Pydantic response
5. evaluate_node   → LLM checks: is this answer GOOD or WEAK?
         ├── GOOD  → END
         └── WEAK  → refine_query_node → back to search (max 2 retries)
```

This is what separates a basic LLM wrapper from a **real agent** — it can detect failure and recover autonomously.

---

## 📊 Source Credibility Scoring

Each source URL is scored based on its domain reputation:

| Score | Label | Example Domains |
|---|---|---|
| 90–100 | Very High | reuters.com, bbc.com, apnews.com, nasa.gov |
| 75–89 | High | nytimes.com, bloomberg.com, arxiv.org |
| 60–74 | Medium | wikipedia.org, stackoverflow.com |
| Below 60 | Low | medium.com, reddit.com, quora.com |

The **Confidence %** shown in the UI is the average score across all sources returned.

---

## 🗺️ Roadmap

- [ ] Multimodal input (image + question via Gemini Vision)
- [ ] User authentication + persistent chat history (MongoDB)
- [ ] Agent memory across sessions
- [ ] Docker containerization
- [ ] Full AWS deployment with CI/CD

---

## 👤 Author

**Suman (b22241)**
IIT Mandi
[GitHub](https://github.com/b22241) · [LinkedIn](https:/linkedin.com/in/suman-deep-52532b268/)

---

## 📄 License

MIT License — free to use, modify, and distribute.