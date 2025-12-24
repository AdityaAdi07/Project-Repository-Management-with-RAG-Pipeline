import os

import json

import numpy as np

import chromadb

from sentence_transformers import SentenceTransformer

from openai import OpenAI

from dotenv import load_dotenv

from sklearn.metrics.pairwise import cosine_similarity

from sklearn.feature_extraction.text import CountVectorizer

load_dotenv()



# Backend config (.env)

MODEL_BACKEND = os.getenv("MODEL_BACKEND", "ollama")

MODEL_NAME = os.getenv("MODEL_NAME", "llama3.2")

OLLAMA_API_BASE = os.getenv("OLLAMA_API_BASE", "http://localhost:11434")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "ollama")



# Configure OpenAI to talk to Ollama

os.environ["OPENAI_API_BASE"] = f"{OLLAMA_API_BASE}/v1"

os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY



client_ai = OpenAI()



print(f"🔗 LLM Backend: {MODEL_BACKEND} | Model: {MODEL_NAME}")


CHROMA_PATH = "./chroma_store"

client = chromadb.PersistentClient(path=CHROMA_PATH)

collection = client.get_collection("DBMS-25")



embedder = SentenceTransformer("all-MiniLM-L6-v2")



print("📦 Loaded ChromaDB & Embedding Model")


def to_percent(x):

    return round(float(x) * 100, 2)





def compute_cosine(a, b):

    return float(cosine_similarity([a], [b])[0][0])





def bag_of_words_similarity(text1, text2):

    vectorizer = CountVectorizer().fit([text1, text2])

    bow1 = vectorizer.transform([text1]).toarray()[0]

    bow2 = vectorizer.transform([text2]).toarray()[0]

    if np.linalg.norm(bow1) == 0 or np.linalg.norm(bow2) == 0:

        return 0.0

    return float(np.dot(bow1, bow2) / (np.linalg.norm(bow1) * np.linalg.norm(bow2)))





def call_llama_similarity(query_text, db_text):

    """

    Ask Llama3.2 to give contextual similarity score (0–100)

    """

    prompt = f"""

Rate the similarity between the following two project descriptions.

Return ONLY a number between 0 and 100.



USER PROJECT:

{query_text}



EXISTING PROJECT:

{db_text}

"""



    try:

        resp = client_ai.chat.completions.create(

            model=MODEL_NAME,

            messages=[

                {"role": "system", "content": "You are a similarity evaluator. Return only a number."},

                {"role": "user", "content": prompt}

            ],

            temperature=0.0

        )

        score = resp.choices[0].message.content.strip()

        return float(score)

    except:

        return 0.0



title = "Plant Disease Detection using OpenCV"

description = "A project that uses computer vision and image processing to detect plant leaf diseases using OpenCV."

tech_stack = "OpenCV, Python, Image Processing"

domain = "Artificial Intelligence / Agriculture"

objective = "Detect early plant diseases using visual analysis."



print("📝 Synopsis Loaded")


emb_title = embedder.encode(title).tolist()

emb_desc = embedder.encode(description).tolist()

emb_tech = embedder.encode(tech_stack).tolist()

emb_domain = embedder.encode(domain).tolist()

emb_obj = embedder.encode(objective).tolist()



combined_text = f"{title} {description} {tech_stack} {domain} {objective}"

emb_whole = embedder.encode(combined_text).tolist()



print("✨ Embeddings created.")




TOP_K = 8



res = collection.query(

    query_embeddings=[emb_whole],

    n_results=TOP_K,

    include=["metadatas", "documents", "distances", "embeddings"]

)



ids = res["ids"][0]

docs = res["documents"][0]

metas = res["metadatas"][0]

stored_embs = res["embeddings"][0]



print("🔍 Retrieved matches from ChromaDB")






results = []



for i, rid in enumerate(ids):

    meta = metas[i]

    db_title = meta.get("title", "")

    db_domain = meta.get("domain", "")

    db_tech = meta.get("tech_stack", "")

    db_source = meta.get("source", "")

    db_desc = docs[i]



    # Embeddings

    db_emb = np.array(stored_embs[i])

    db_title_emb = embedder.encode(db_title).tolist()

    db_desc_emb = embedder.encode(db_desc).tolist()

    db_tech_emb = embedder.encode(db_tech).tolist()

    db_domain_emb = embedder.encode(db_domain).tolist()



    # Similarities

    sim_title = compute_cosine(emb_title, db_title_emb)

    sim_desc = compute_cosine(emb_desc, db_desc_emb)

    sim_tech = compute_cosine(emb_tech, db_tech_emb)

    sim_domain = compute_cosine(emb_domain, db_domain_emb)

    sim_objective = compute_cosine(emb_obj, embedder.encode(meta.get("objective","")).tolist())

    sim_whole = compute_cosine(emb_whole, db_emb)



    # BoW similarity

    bow_sim = bag_of_words_similarity(combined_text, db_desc)



    # LLM contextual similarity

    ctx_sim = call_llama_similarity(combined_text, db_desc)



    # Weighted final score

    final_score = (

        0.40 * sim_whole +

        0.20 * ((sim_title + sim_desc + sim_tech + sim_domain + sim_objective) / 5) +

        0.15 * bow_sim +

        0.25 * (ctx_sim / 100)

    )



    results.append({

        "project_id": rid,

        "title": db_title,

        "domain": db_domain,

        "tech_stack": db_tech,

        "whole_similarity": to_percent(sim_whole),

        "title_similarity": to_percent(sim_title),

        "description_similarity": to_percent(sim_desc),

        "tech_similarity": to_percent(sim_tech),

        "domain_similarity": to_percent(sim_domain),

        "objective_similarity": to_percent(sim_objective),

        "bow_similarity": to_percent(bow_sim),

        "contextual_similarity": ctx_sim,

        "final_similarity": to_percent(final_score),

        "snippet": db_desc[:250]

    })




results_sorted = sorted(results, key=lambda x: x["final_similarity"], reverse=True)



print("\n=== 🎯 FINAL TOP-5 MATCHES ===\n")

for r in results_sorted[:5]:

    print(f"📌 {r['title']}  |  Final Score: {r['final_similarity']}%")

    print(f"   Whole: {r['whole_similarity']}% | Title: {r['title_similarity']}% | Desc: {r['description_similarity']}%")

    print(f"   Domain: {r['domain_similarity']}% | Tech: {r['tech_similarity']}% | Obj: {r['objective_similarity']}%")

    print(f"   BoW: {r['bow_similarity']}% | Contextual: {r['contextual_similarity']}%")

    print(f"   Snippet: {r['snippet']}\n")


# ============================================================

# 8B. Llama3.2 — Why They Matched & How to Make Unique

# ============================================================



print("\n🧠 Generating Llama3.2 analysis...\n")



# ----- Build explanation prompt -----

prompt_lines = []

prompt_lines.append("You are an academic project evaluator. A student submitted a project synopsis.")

prompt_lines.append("\n=== STUDENT SYNOPSIS ===")

prompt_lines.append(f"Title: {title}")

prompt_lines.append(f"Description: {description}")

prompt_lines.append(f"Tech Stack: {tech_stack}")

prompt_lines.append(f"Domain: {domain}")

prompt_lines.append(f"Objective: {objective}\n")



prompt_lines.append("=== TOP-5 SIMILAR PROJECTS (FROM DATABASE) ===")



for i, r in enumerate(results_sorted[:5], start=1):

    prompt_lines.append(f"\n{i}. {r['title']}")

    prompt_lines.append(f"   - Whole Similarity: {r['whole_similarity']}%")

    prompt_lines.append(f"   - Title Sim: {r['title_similarity']}%")

    prompt_lines.append(f"   - Description Sim: {r['description_similarity']}%")

    prompt_lines.append(f"   - Tech Stack Sim: {r['tech_similarity']}%")

    prompt_lines.append(f"   - Objective Sim: {r['objective_similarity']}%")

    prompt_lines.append(f"   - Domain Sim: {r['domain_similarity']}%")

    prompt_lines.append(f"   - Contextual Sim: {r['contextual_similarity']}")

    prompt_lines.append(f"   - Snippet: {r['snippet']}\n")



prompt_lines.append(

"""

=== TASK ===

For EACH of the 5 projects:



1. Explain in 2 short bullet points WHY it was marked similar.

2. Highlight exactly WHICH parts match (title keywords, description phrases, technical overlap).

3. Suggest 2 ways the student can MODIFY their synopsis to reduce similarity and make it unique.



Finally:

4. Give 5 GENERAL TIPS to ensure a project synopsis stays original and avoids high similarity scores.



Keep the output clean and point-wise.

"""

)



llama_prompt = "\n".join(prompt_lines)



# ----- Call model -----

try:

    completion = client_ai.chat.completions.create(

        model=MODEL_NAME,

        messages=[

            {"role": "system", "content": "You evaluate project similarities and rewrite suggestions."},

            {"role": "user", "content": llama_prompt}

        ],

        temperature=0.4

    )

    llama_analysis = completion.choices[0].message.content.strip()

except Exception as e:

    llama_analysis = f"LLAMA ERROR: {e}"



# ----- Print result -----

print("=== 🧠 Llama3.2 Similarity Breakdown & Suggestions ===\n")

print(llama_analysis)




