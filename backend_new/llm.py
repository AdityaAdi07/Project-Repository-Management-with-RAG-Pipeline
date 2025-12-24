"""
LLM client abstractions supporting Ollama, OpenAI, and Gemini backends.
Provides unified interface for chat, similarity scoring, and match analysis.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Iterable, List, Optional

from openai import OpenAI
from .settings import get_settings

try:
    import google.generativeai as genai  # type: ignore
except ImportError:
    genai = None


class LLMConfigurationError(RuntimeError):
    pass


class LLMClient:
    def __init__(self) -> None:
        settings = get_settings()

        self._backend = settings.model_backend.lower()     # ollama / openai / gemini
        self._model_name = settings.model_name

        # ----------------------------
        # OpenAI / Ollama Chat Models
        # ----------------------------
        if self._backend in {"ollama", "openai"}:
            base_url = settings.openai_api_base
            api_key = settings.openai_api_key

            if self._backend == "ollama":
                # Use local Ollama compatibility endpoint
                base_url = base_url or f"{settings.ollama_api_base}/v1"
                api_key = api_key or "ollama"

            kwargs = {}
            if base_url:
                kwargs["base_url"] = base_url
            if api_key:
                kwargs["api_key"] = api_key

            self._client = OpenAI(**kwargs)
            self._mode = "chat"

        # ----------------------------
        # Gemini Backend
        # ----------------------------
        elif self._backend == "gemini":
            if genai is None:
                raise LLMConfigurationError("google-generativeai is required for Gemini backend.")

            if not settings.gemini_api_key:
                raise LLMConfigurationError("GEMINI_API_KEY must be set.")

            genai.configure(api_key=settings.gemini_api_key)
            self._client = genai.GenerativeModel(settings.model_name)
            self._mode = "gemini"

        else:
            raise LLMConfigurationError(f"Unsupported MODEL_BACKEND '{settings.model_backend}'.")



    # ======================================================================
    #  CHAT
    # ======================================================================
    def chat(self, messages: List[dict], temperature: float = 0.0) -> str:
        """
        Unified chat interface for OpenAI/Ollama/Gemini.
        """

        if self._mode == "chat":
            response = self._client.chat.completions.create(
                model=self._model_name,
                messages=messages,
                temperature=temperature,
            )
            return response.choices[0].message.content.strip()

        else:  # Gemini
            prompt = _messages_to_prompt(messages)
            response = self._client.generate_content(prompt)
            return response.text.strip()



    # ======================================================================
    #  SEMANTIC SIMILARITY SCORING
    # ======================================================================
    def score_similarity(self, query_text: str, doc_text: str) -> float:
        """
        Ask LLM to rate similarity from 0-100. Outputs float.
        """
        prompt = (
            "Rate the semantic similarity between the two project descriptions. "
            "Return only an integer 0–100.\n\n"
            "[USER PROJECT]\n"
            f"{query_text}\n\n"
            "[REFERENCE PROJECT]\n"
            f"{doc_text}"
        )

        messages = [
            {"role": "system", "content": "You are a strict semantic similarity evaluator."},
            {"role": "user", "content": prompt},
        ]

        try:
            value = self.chat(messages, temperature=0.0)
            return float(value)
        except Exception:
            return 0.0



    # ======================================================================
    #  MAIN ANALYSIS: MATCH BREAKDOWN + ORIGINALITY SUGGESTIONS
    # ======================================================================
    def analyze_matches(self, synopsis: dict, matches: Iterable[dict]) -> str:
        """
        Generate a structured point-wise academic analysis of top matches.
        """

        payload = {
            "student_synopsis": synopsis,
            "top_matches": list(matches),
        }

        # ======================
        # IMPROVED LLAMA PROMPT
        # ======================
        prompt = """
You are an expert academic evaluator specializing in project similarity analysis and originality enhancement.

Your task is to analyze the student's synopsis and compare it with the top-5 similar projects.  
Then produce a structured, point-wise, deeply informative academic report.

==============================
📌 OUTPUT FORMAT (CARD LAYOUT)
==============================

GROUP THE RESPONSE INTO COMPACT ASCII CARDS.  
EACH CARD MUST FOLLOW THIS STRUCTURE:

╭── [CARD TITLE] ───────────────
│ • Bullet 1
│ • Bullet 2
╰───────────────────────────────

CARDS TO GENERATE (IN ORDER):
1. Student Project Synopsis (summaries of title, tech stack, domain, objective).
2. For EACH of the 5 matched projects create one card with the project name as the title and three grouped sections inside the same card:
   • Why Flagged as Similar (2–3 bullets)  
   • Exact Matching Components (3–5 bullets)  
   • Uniqueness Enhancement Suggestions (2 bullets)  
   Keep them grouped by using inline labels, e.g., "Why: ...".
3. A single card named "General Originality Guidelines" with exactly 5 bullets.

==============================
📌 RULES
==============================
• Keep cards concise yet information rich.  
• No extra blank lines between cards.  
• Do NOT create a separate card for every bullet. Combine related info per card.  
• Maintain academic tone and precision.  
"""

        messages = [
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": "Provide analysis for the following data:\n\n" +
                           json.dumps(payload, ensure_ascii=False, indent=2),
            },
        ]

        try:
            return self.chat(messages, temperature=0.4)
        except Exception as exc:
            return f"LLM analysis unavailable: {exc}"



# =========================================================
#  Utility: Convert Chat Messages → Single Text (for Gemini)
# =========================================================
def _messages_to_prompt(messages: List[dict]) -> str:
    out = []
    for msg in messages:
        role = msg.get("role", "user").upper()
        body = msg.get("content", "")
        out.append(f"[{role}]\n{body}\n")
    return "\n".join(out)



@lru_cache(maxsize=1)
def get_llm_client() -> LLMClient:
    return LLMClient()
