from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from pydantic import BaseModel, Field
from typing import TypedDict, List, AsyncIterator
from urllib.parse import urlparse
import os
from dotenv import load_dotenv

load_dotenv()

# ── Structured Output Schema ───────────────────────────
class ResearchAnswer(BaseModel):
    headline: str = Field(description="One sentence direct answer to the question")
    summary: str = Field(description="5-6 sentence detailed explanation")
    key_points: List[str] = Field(description="3 to 5 bullet point key findings")
    follow_up: str = Field(description="One suggested follow-up question the user might want to ask")

# ── Agent State ────────────────────────────────────────
class AgentState(TypedDict):
    query: str
    refined_query: str
    resolved_query: str
    intent: str
    chat_history: List
    search_results: str
    raw_sources: List
    scored_sources: List
    confidence: int
    final_answer: dict
    quality: str
    attempts: int

llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
llm_structured = llm.with_structured_output(ResearchAnswer)

# ── Domain Credibility Scores ──────────────────────────
DOMAIN_SCORES = {
    "reuters.com": 98, "apnews.com": 97, "bbc.com": 96, "bbc.co.uk": 96,
    "nature.com": 96, "science.org": 95, "nejm.org": 95, "who.int": 95,
    "nasa.gov": 95, "gov": 93, "edu": 92,
    "nytimes.com": 88, "theguardian.com": 87, "washingtonpost.com": 86,
    "economist.com": 88, "ft.com": 87, "bloomberg.com": 86,
    "aljazeera.com": 82, "cnbc.com": 80, "forbes.com": 78,
    "techcrunch.com": 78, "wired.com": 78, "arxiv.org": 85,
    "wikipedia.org": 72, "investopedia.com": 75,
    "medium.com": 55, "substack.com": 52, "quora.com": 48,
    "reddit.com": 45, "stackoverflow.com": 70,
}

def get_domain_score(url: str) -> tuple:
    try:
        domain = urlparse(url).netloc.replace("www.", "")
        if domain in DOMAIN_SCORES:
            return domain, DOMAIN_SCORES[domain]
        tld = domain.split(".")[-1]
        if tld in DOMAIN_SCORES:
            return domain, DOMAIN_SCORES[tld]
        return domain, 55
    except:
        return url, 50

def score_label(score: int) -> str:
    if score >= 90: return "Very High"
    if score >= 75: return "High"
    if score >= 60: return "Medium"
    return "Low"

# ── Classify Intent ────────────────────────────────────
def classify_intent(query: str, chat_history: list) -> str:
    history_text = ""
    if chat_history:
        last = chat_history[-2:]
        history_text = "\n".join([f"{m['role']}: {m['content'][:100]}" for m in last])

    prompt = f"""Classify this user query into exactly one of these categories:

- factual: General knowledge, concepts, definitions, how things work
- news: Current events, latest updates, recent news, ongoing situations
- followup: Refers to previous conversation, uses words like "that", "it", "more", "explain further", "what about"

Recent conversation:
{history_text if history_text else "No previous conversation"}

User query: {query}

Reply with ONLY one word: factual, news, or followup"""

    response = llm.invoke([HumanMessage(content=prompt)])
    intent = response.content.strip().lower()
    return intent if intent in ["factual", "news", "followup"] else "factual"

# ── Search + Score ─────────────────────────────────────
def search_and_score(query: str, intent: str, chat_history: list) -> dict:
    if intent == "news":
        search_query = f"{query} latest 2026"
        search_tool = TavilySearchResults(max_results=5)
    elif intent == "followup" and chat_history:
        recent = chat_history[-4:]
        context = " | ".join([m["content"][:80] for m in recent])
        search_query = f"{context} {query}"
        search_tool = TavilySearchResults(max_results=3)
    else:
        search_query = query
        search_tool = TavilySearchResults(max_results=7)

    results = search_tool.invoke(search_query)
    formatted = "\n\n".join([f"Source: {r['url']}\n{r['content']}" for r in results])

    scored = []
    total = 0
    for r in results:
        domain, score = get_domain_score(r["url"])
        scored.append({
            "url": r["url"], "domain": domain,
            "score": score, "label": score_label(score),
            "preview": r["content"][:200]
        })
        total += score

    confidence = int(total / len(scored)) if scored else 50
    return {
        "search_results": formatted,
        "scored_sources": scored,
        "confidence": confidence
    }

# ── Stream Answer ──────────────────────────────────────
async def stream_answer(query: str, intent: str, search_results: str, chat_history: list) -> AsyncIterator[str]:
    messages = [
        SystemMessage(content="""You are a helpful research assistant.
Use the web results and conversation history to answer the question.
Structure your response EXACTLY like this with these exact labels:

HEADLINE: [one sentence direct answer]

SUMMARY: [6-7 sentence explanation]

KEY POINTS:
- [point 1]
- [point 2]
- [point 3]
- [point 4]
- [point 5]

FOLLOW-UP: [one suggested follow-up question]""")
    ]

    for msg in chat_history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            content = msg["content"]
            if isinstance(content, dict):
                content = content.get("headline", "") + " " + content.get("summary", "")
            messages.append(AIMessage(content=content))

    messages.append(HumanMessage(content=f"""Question: {query}
Intent: {intent}

Web results:
{search_results}"""))

    async for chunk in llm.astream(messages):
        if chunk.content:
            yield chunk.content

# ── Non-streaming agent (kept for fallback) ────────────
def build_agent():
    class S(TypedDict):
        query: str
        refined_query: str
        resolved_query: str
        intent: str
        chat_history: List
        search_results: str
        raw_sources: List
        scored_sources: List
        confidence: int
        final_answer: dict
        quality: str
        attempts: int

    def classify_node(state):
        intent = classify_intent(state["query"], state["chat_history"])
        return {"intent": intent}

    def search_node(state):
        result = search_and_score(
            state.get("refined_query") or state["query"],
            state.get("intent", "factual"),
            state["chat_history"]
        )
        return {
            "search_results": result["search_results"],
            "scored_sources": result["scored_sources"],
            "confidence": result["confidence"],
            "raw_sources": []
        }

    def answer_node(state):
        messages = [SystemMessage(content="You are a helpful research assistant. Use web results and chat history.")]
        for msg in state["chat_history"]:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            else:
                content = msg["content"]
                if isinstance(content, dict):
                    content = content.get("headline", "") + " " + content.get("summary", "")
                messages.append(AIMessage(content=content))
        messages.append(HumanMessage(content=f"Question: {state['query']}\n\nWeb results:\n{state['search_results']}"))
        response = llm_structured.invoke(messages)
        return {"final_answer": response.dict()}

    def evaluate_node(state):
        answer = state["final_answer"]
        answer_text = f"{answer.get('headline','')} {answer.get('summary','')}"
        prompt = f"Question: {state['query']}\nAnswer: {answer_text}\n\nIs this GOOD or WEAK? Reply one word only."
        response = llm.invoke([HumanMessage(content=prompt)])
        quality = "GOOD" if "GOOD" in response.content.upper() else "WEAK"
        return {"quality": quality}

    def refine_node(state):
        answer = state["final_answer"]
        prompt = f"Weak answer for query: {state['query']}\nAnswer: {answer.get('headline','')}\n\nGive a better search query. Reply only with the query."
        response = llm.invoke([HumanMessage(content=prompt)])
        return {"refined_query": response.content.strip(), "attempts": state.get("attempts", 0) + 1}

    def should_retry(state):
        if state.get("quality") == "GOOD": return "end"
        if state.get("attempts", 0) >= 2: return "end"
        return "retry"

    graph = StateGraph(S)
    graph.add_node("classify", classify_node)
    graph.add_node("search", search_node)
    graph.add_node("answer", answer_node)
    graph.add_node("evaluate", evaluate_node)
    graph.add_node("refine_query", refine_node)
    graph.set_entry_point("classify")
    graph.add_edge("classify", "search")
    graph.add_edge("search", "answer")
    graph.add_edge("answer", "evaluate")
    graph.add_conditional_edges("evaluate", should_retry, {"end": END, "retry": "refine_query"})
    graph.add_edge("refine_query", "search")
    return graph.compile()

agent = build_agent()

def run_agent(query: str, chat_history: list = []) -> dict:
    result = agent.invoke({
        "query": query, "refined_query": "", "resolved_query": "",
        "intent": "", "chat_history": chat_history,
        "search_results": "", "raw_sources": [], "scored_sources": [],
        "confidence": 0, "final_answer": {}, "quality": "", "attempts": 0
    })
    return {
        "answer": result["final_answer"],
        "sources": result["scored_sources"],
        "confidence": result["confidence"],
        "attempts": result.get("attempts", 0) + 1,
        "intent": result.get("intent", "factual")
    }