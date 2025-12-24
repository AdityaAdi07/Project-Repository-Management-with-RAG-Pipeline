import chromadb

from chromadb.config import Settings



# Path to your Chroma DB (the folder where embeddings were saved)

CHROMA_PATH = "./chroma_store"   # <-- change if you used a different path



client = chromadb.PersistentClient(path=CHROMA_PATH)



# List all existing collections

collections = client.list_collections()



for c in collections:

    print("Collection Name:", c.name)


# --- Imports ---

import os

import json

import numpy as np

import chromadb

from sentence_transformers import SentenceTransformer

from openai import OpenAI

from dotenv import load_dotenv

from sklearn.metrics.pairwise import cosine_similarity

load_dotenv()



MODEL_BACKEND = os.getenv("MODEL_BACKEND", "ollama")

MODEL_NAME = os.getenv("MODEL_NAME", "llama3.2")

OLLAMA_API_BASE = os.getenv("OLLAMA_API_BASE", "http://localhost:11434")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "ollama")  # default dummy key



# --- Configure OpenAI client depending on backend ---

if MODEL_BACKEND.lower() == "ollama":

    # Point the OpenAI client to Ollama’s local API

    os.environ["OPENAI_API_BASE"] = f"{OLLAMA_API_BASE}/v1"

    os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY

    print(f"🔗 Using Ollama backend at {OLLAMA_API_BASE} with model: {MODEL_NAME}")

else:

    print(f"🔗 Using cloud backend with model: {MODEL_NAME}")



# --- Initialize client ---

client_ai = OpenAI()



# --- Connect to ChromaDB ---

client = chromadb.PersistentClient(path="./chroma_store")

collection = client.get_collection("DBMS-25")



# --- Load Sentence Transformer ---

embedder = SentenceTransformer("all-MiniLM-L6-v2")


# --- Query Configuration ---

query = "web scrapping amazon deals"

TOP_K = 10  # fetch more, then filter unique



query_emb = embedder.encode(query).tolist()


# --- Query Chroma ---

res = collection.query(

    query_embeddings=[query_emb],

    n_results=TOP_K,

    include=["metadatas", "documents", "distances", "embeddings"]

)



ids = res["ids"][0]

docs = res["documents"][0]

metas = res["metadatas"][0]

stored_embs = res["embeddings"][0]

distances = res["distances"][0]


# --- Utility ---

def to_percent(x): return round(float(x) * 100, 2)



# --- Compute Similarities ---

results = []

for i, rid in enumerate(ids):

    meta = metas[i] or {}

    title = meta.get("title", "")

    domain = meta.get("domain", "")

    tech_stack = meta.get("tech_stack", "")

    source = meta.get("source", "")

    desc = docs[i] or ""

    objective = meta.get("objective", "")



    # embeddings

    title_emb = embedder.encode(title).tolist() if title else None

    desc_emb = embedder.encode(desc).tolist() if desc else None

    tech_emb = embedder.encode(tech_stack).tolist() if tech_stack else None

    obj_emb = embedder.encode(objective).tolist() if objective else None



    # sims

    sim_title = cosine_similarity([query_emb], [title_emb])[0][0] if title_emb else 0

    sim_desc = cosine_similarity([query_emb], [desc_emb])[0][0] if desc_emb else 0

    sim_tech = cosine_similarity([query_emb], [tech_emb])[0][0] if tech_emb else 0

    sim_obj = cosine_similarity([query_emb], [obj_emb])[0][0] if obj_emb else 0

    sim_whole = cosine_similarity([query_emb], [stored_embs[i]])[0][0]



    results.append({

        "id": rid,

        "title": title,

        "domain": domain,

        "tech_stack": tech_stack,

        "source": source,

        "sim_whole": sim_whole,

        "sim_title": sim_title,

        "sim_description": sim_desc,

        "sim_tech_stack": sim_tech,

        "sim_objective": sim_obj,

        "doc_snippet": desc[:300]

    })


# --- Deduplicate same titles & take top-5 ---

unique_titles = {}

for r in sorted(results, key=lambda x: x["sim_whole"], reverse=True):

    if r["title"] not in unique_titles:

        unique_titles[r["title"]] = r



final_results = list(unique_titles.values())[:5]



# --- Print in terminal ---

print("\n=== 🎯 Unique Top-5 Results After Deduplication ===\n")

for i, r in enumerate(final_results, start=1):

    print(f"{i}. {r['title']}")

    print(f"   Domain: {r['domain']}")

    print(f"   Source: {r['source']}")

    print(f"   Tech Stack: {r['tech_stack']}")

    print(f"   Whole Similarity: {round(r['sim_whole']*100, 2)}%")

    print(f"   Title Sim: {round(r['sim_title']*100, 2)}%, Desc Sim: {round(r['sim_description']*100, 2)}%")

    print(f"   Snippet: {r['doc_snippet'][:150]}...\n")


# --- Build Prompt for Llama ---

prompt_lines = [

    f"Query: {query}",

    "The system retrieved these 5 most similar student projects:",

    ""

]

for idx, r in enumerate(final_results, start=1):

    prompt_lines.append(f"{idx}. {r['title']}")

    prompt_lines.append(f"   - Domain: {r['domain']}")

    prompt_lines.append(f"   - Similarities: Overall {to_percent(r['sim_whole'])}%, Title {to_percent(r['sim_title'])}%, Desc {to_percent(r['sim_description'])}%, Tech {to_percent(r['sim_tech_stack'])}%")

    prompt_lines.append(f"   - Snippet: {r['doc_snippet']}\n")



prompt_lines.append(

    "Now act as a project evaluation assistant. For each project:\n"

    "1. Explain briefly WHY it matched this query.\n"

    "2. Suggest 2 ways to make the new idea original.\n"

    "End with 3 general originality improvement tips."

)

llama_prompt = "\n".join(prompt_lines)


# --- Generate Summary with Llama3.2 ---

print("\n🧠 Generating synthesized explanation")

completion = client_ai.chat.completions.create(

    model="llama3.2",

    messages=[

        {"role": "system", "content": "You are an academic evaluator and writing assistant."},

        {"role": "user", "content": llama_prompt}

    ],

    temperature=0.5

)

ai_summary = completion.choices[0].message.content.strip()

# --- Display Results ---

print("\n\n=== 🔍 Top-5 Results ===")

for i, r in enumerate(final_results, start=1):

    print(f"\n{i}. {r['title']}")

    print(f"   Domain: {r['domain']} | Whole Sim: {to_percent(r['sim_whole'])}%")

    print(f"   Field Sims -> Title: {to_percent(r['sim_title'])}%, Desc: {to_percent(r['sim_description'])}%, Tech: {to_percent(r['sim_tech_stack'])}%")

    print(f"   Snippet: {r['doc_snippet'][:150]}...")



print("\n\n=== 🧠 AI Explanation & Suggestions ===\n")

print(ai_summary)



# --- Save JSON Report ---

os.makedirs("analysis_reports", exist_ok=True)

file_path = f"analysis_reports/{query.replace(' ', '_')}.json"

with open(file_path, "w", encoding="utf-8") as f:

    json.dump({

        "query": query,

        "results": final_results,

        "ai_analysis": ai_summary

    }, f, indent=4, ensure_ascii=False)



print(f"\n✅ Analysis complete and saved to: {file_path}")

import google.generativeai as genai



# --- Load env variables ---

load_dotenv()

GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")

MODEL_NAME = os.getenv("MODEL_NAME", "gemini-2.5-pro")



# --- Configure Gemini ---

genai.configure(api_key=GOOGLE_API_KEY)

model = genai.GenerativeModel(MODEL_NAME)



# --- Your prompt (already prepared earlier) ---

print("\n🧠 Generating synthesized explanation...")



response = model.generate_content(llama_prompt)   # reuse same prompt structure

ai_summary = response.text.strip()



# --- Display Results ---

print("\n\n=== 🔍 Top-5 Results ===")

for i, r in enumerate(final_results, start=1):

    print(f"\n{i}. {r['title']}")

    print(f"   Domain: {r['domain']} | Whole Sim: {to_percent(r['sim_whole'])}%")

    print(f"   Field Sims → Title: {to_percent(r['sim_title'])}%, "

          f"Desc: {to_percent(r['sim_description'])}%, "

          f"Tech: {to_percent(r['sim_tech_stack'])}%")

    print(f"   Snippet: {r['doc_snippet'][:150]}...")



print("\n\n=== 🧠 AI Explanation & Suggestions  ===\n")

print(ai_summary)



# --- Optional: Save to JSON ---

import json

out_path = f"analysis_reports/{query.replace(' ','_')}_gemini.json"

os.makedirs("analysis_reports", exist_ok=True)

with open(out_path, "w", encoding="utf-8") as f:

    json.dump({

        "query": query,

        "results": final_results,

        "ai_analysis": ai_summary

    }, f, indent=2, ensure_ascii=False)



print(f"\n✅ Saved Gemini analysis to: {out_path}")




