from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from agent import run_agent, classify_intent, search_and_score, stream_answer
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: str

class QueryRequest(BaseModel):
    query: str
    chat_history: List[Message] = []

@app.post("/ask")
def ask(req: QueryRequest):
    history = [{"role": m.role, "content": m.content} for m in req.chat_history]
    result = run_agent(req.query, history)
    return result

@app.post("/ask/stream")
async def ask_stream(req: QueryRequest):
    history = [{"role": m.role, "content": m.content} for m in req.chat_history]

    async def generate():
        # Step 1: classify intent
        intent = classify_intent(req.query, history)

        # Step 2: search + score sources
        prepared = search_and_score(req.query, intent, history)

        # Step 3: send metadata first (sources, confidence, intent)
        meta = {
            "type": "meta",
            "intent": intent,
            "confidence": prepared["confidence"],
            "sources": prepared["scored_sources"]
        }
        yield f"data: {json.dumps(meta)}\n\n"

        # Step 4: stream tokens
        async for token in stream_answer(
            req.query, intent,
            prepared["search_results"],
            history
        ):
            payload = {"type": "token", "text": token}
            yield f"data: {json.dumps(payload)}\n\n"

        # Step 5: signal done
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")

@app.get("/health")
def health():
    return {"status": "ok"}