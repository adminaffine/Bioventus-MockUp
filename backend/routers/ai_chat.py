import json
import os
import urllib.error
import urllib.request
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.ai_context_builder import get_context_for_chat

router = APIRouter(prefix="/api", tags=["ai"])


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    upload_session_id: str | None = None  # when set, AI uses uploaded data context instead of baseline
    active_route: str | None = None
    stream: bool = False


class ChatResponse(BaseModel):
    reply: str
    usage: dict | None = None


def _build_system_prompt(context: str, active_route: str | None = None) -> str:
    route_context = f"Active application screen route: {active_route}" if active_route else "Active application screen route: unknown"
    return (
        "You are AI Insights Assistant for Bioventus (BV), a Life Sciences and Medical Devices company. "
        "You support data quality, regulatory compliance, commercial intelligence, and risk mitigation decisions.\n\n"
        "Response policy:\n"
        "1) Always prioritize the user's active screen context first.\n"
        "2) Then broaden to the full application context if needed.\n"
        "3) Provide concise insights with concrete counts, impacted records, and risks.\n"
        "4) Include recommended actions and specific app drill-down routes when useful.\n"
        "5) If data is unavailable, say so explicitly; do not invent numbers.\n\n"
        f"{route_context}\n\n"
        "--- CONTEXT START ---\n"
        f"{context}\n"
        "--- CONTEXT END ---"
    )


def _call_provider(user_message: str, context: str, history: list[dict], active_route: str | None) -> str:
    provider = os.getenv("AI_PROVIDER", "ollama").strip().lower()
    if provider not in {"ollama", "azure", "openai", "auto"}:
        provider = "ollama"

    if provider == "ollama":
        return _call_ollama(user_message, context, history, active_route)
    if provider == "azure":
        return _call_azure(user_message, context, history, active_route)
    if provider == "openai":
        return _call_openai_standard(user_message, context, history, active_route)
    # auto mode keeps explicit order but does not silently fallback from a chosen provider
    for candidate in (_call_ollama, _call_azure, _call_openai_standard):
        reply = candidate(user_message, context, history, active_route)
        if not reply.startswith("AI provider error:"):
            return reply
    return "AI provider error: No configured AI provider is currently reachable."


def _call_azure(user_message: str, context: str, history: list[dict], active_route: str | None) -> str:
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    if endpoint and azure_key:
        return _call_azure_openai(user_message, context, history, endpoint, azure_key, active_route)
    return "AI provider error: Azure OpenAI is not configured."


def _call_azure_openai(
    user_message: str, context: str, history: list[dict],
    endpoint: str, api_key: str, active_route: str | None,
) -> str:
    from openai import AzureOpenAI
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_GPT4O", "hc-gpt-4o-mini")
    client = AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version=api_version,
    )
    system = _build_system_prompt(context, active_route)
    messages = [{"role": "system", "content": system}]
    for h in history[-10:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")[:2000]})
    messages.append({"role": "user", "content": user_message[:2000]})
    try:
        resp = client.chat.completions.create(
            model=deployment,
            messages=messages,
            max_tokens=800,
            temperature=0.3,
        )
        return resp.choices[0].message.content or ""
    except Exception as e:
        return f"AI provider error: Azure OpenAI call failed ({str(e)})."


def _call_openai_standard(user_message: str, context: str, history: list[dict], active_route: str | None) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "AI provider error: OpenAI is not configured."
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    system = _build_system_prompt(context, active_route)
    messages = [{"role": "system", "content": system}]
    for h in history[-10:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")[:2000]})
    messages.append({"role": "user", "content": user_message[:2000]})
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=800,
            temperature=0.3,
        )
        return resp.choices[0].message.content or ""
    except Exception as e:
        return f"AI provider error: OpenAI call failed ({str(e)})."


def _call_ollama(user_message: str, context: str, history: list[dict], active_route: str | None) -> str:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct")
    timeout_sec = int(os.getenv("OLLAMA_TIMEOUT_SEC", "90"))
    prompt = _build_system_prompt(context, active_route)

    convo = []
    for h in history[-10:]:
        role = h.get("role", "user")
        if role not in {"user", "assistant"}:
            role = "user"
        convo.append({"role": role, "content": str(h.get("content", ""))[:2000]})
    convo.append({"role": "user", "content": user_message[:2000]})

    payload = {
        "model": model,
        "stream": False,
        "messages": [{"role": "system", "content": prompt}, *convo],
    }
    req = urllib.request.Request(
        url=f"{base_url}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            message = body.get("message", {})
            return str(message.get("content", "")).strip()
    except urllib.error.URLError as e:
        return f"AI provider error: Ollama not reachable at {base_url} ({e})."
    except Exception as e:
        return f"AI provider error: Ollama call failed ({e})."


def _stream_ollama(user_message: str, context: str, history: list[dict], active_route: str | None):
    base_url = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
    model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct")
    timeout_sec = int(os.getenv("OLLAMA_TIMEOUT_SEC", "120"))
    prompt = _build_system_prompt(context, active_route)
    convo = []
    for h in history[-10:]:
        role = h.get("role", "user")
        if role not in {"user", "assistant"}:
            role = "user"
        convo.append({"role": role, "content": str(h.get("content", ""))[:2000]})
    convo.append({"role": "user", "content": user_message[:2000]})
    payload = {
        "model": model,
        "stream": True,
        "messages": [{"role": "system", "content": prompt}, *convo],
    }
    req = urllib.request.Request(
        url=f"{base_url}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            for raw in resp:
                if not raw:
                    continue
                line = raw.decode("utf-8").strip()
                if not line:
                    continue
                obj = json.loads(line)
                chunk = (obj.get("message") or {}).get("content", "")
                if chunk:
                    yield f"data: {json.dumps({'delta': chunk})}\n\n"
                if obj.get("done"):
                    break
            yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': f'Ollama streaming failed: {e}'})}\n\n"
        yield "data: [DONE]\n\n"


@router.post("/ai/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    """GPT-4o chat. Use upload_session_id to answer about uploaded data; otherwise uses baseline."""
    try:
        context = get_context_for_chat(upload_session_id=req.upload_session_id, active_route=req.active_route)
        reply = _call_provider(req.message, context, req.history or [], req.active_route)
        return ChatResponse(reply=reply)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ChatResponse(
            reply=f"Backend error: {str(e)}. Check server logs for details."
        )


@router.post("/ai/chat/stream")
def chat_stream(req: ChatRequest):
    context = get_context_for_chat(upload_session_id=req.upload_session_id, active_route=req.active_route)
    provider = os.getenv("AI_PROVIDER", "ollama").strip().lower()
    if provider != "ollama":
        def _single_shot():
            reply = _call_provider(req.message, context, req.history or [], req.active_route)
            yield f"data: {json.dumps({'delta': reply})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(_single_shot(), media_type="text/event-stream")
    return StreamingResponse(
        _stream_ollama(req.message, context, req.history or [], req.active_route),
        media_type="text/event-stream",
    )
