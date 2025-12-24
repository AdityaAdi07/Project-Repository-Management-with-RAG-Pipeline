# 📚 RVCE DBMS Project Discovery and Management

AI-Powered Platform for Semantic Search and Synopsis Analysis

RVCE DBMS Project Discovery and Management is an intelligent platform designed for students and faculty to semantically search projects, manage student team information, and analyze project synopses. Leveraging RAG (Retrieval Augmented Generation) powered intelligence, it provides enhanced project discovery and insights within the RVCE database.

---

## Features

- **RAG-Powered Intelligence:** Utilizes advanced AI for intelligent project discovery and analysis.
- **Semantic Project Search:** Search for projects by title using vector similarity, returning top-k matches with detailed scores.
- **Synopsis Management:**
  - Manually enter project synopses.
  - Upload PDF files for automatic text extraction and synopsis input.
  - Save comprehensive synopsis details including title, objective, domain, tech stack, and description.
- **Repository Statistics:** View live metrics from the MongoDB projects collection, including:
  - Total Projects
  - Top Domains
  - Frequent Teams
  - Year-wise publications
  - Frequently referenced projects
- **Student Portal:**
  - View personal team details and associated projects.
  - Access recent search history.
- **Faculty Dashboard:** (Implied from file structure, not explicitly detailed in prompt)
  - Manage student projects and teams.
  - Oversee project analysis.
- **Secure User Authentication:** JWT-based authentication for both student and faculty roles.

---

## Data Sources

- **Internal Project Data:** Curated data for CSE, Cyber, and ML domains (`data/CSE-data.json`, `data/cyber-data.json`, `data/ML-data.json`).
- **Student and Team Information:** (`data/students_5th_sem.json`)
- **MongoDB:** Primary database for storing project, student, team, and search history data.
- **ChromaDB:** Vector store for RAG pipeline, enabling semantic search and analysis.

---

## 🧩 System Architecture

### Frontend
- **Student Dashboard (`student.html`):** Student-facing interface for project search, synopsis management, and personal information.
- **Faculty Dashboard (`teacher.html`):** Faculty-facing interface for project and team management (features implied by file structure).
- **General Dashboard (`dashboard.html`):** A general overview dashboard.
- **JavaScript (`dashboard.js`, `rvce-portal.js`):** Handles UI interactions, API calls, PDF text extraction (using PDF.js), and client-side logic.
- **CSS (`styles.css`):** Styling for a modern and responsive user interface.

### Backend (`backend_new/`)
- **API Endpoints:**
  - `analyze.py`: For AI-powered synopsis analysis (though frontend now handles direct synopsis submission).
  - `auth.py`: Handles user authentication and session management.
  - `projects.py`: Manages project-related data and summaries.
  - `search.py`: Implements semantic project search using the RAG pipeline.
  - `students.py`: Student-specific operations, including team details and search history.
  - `teams.py`: Manages team information.
- **Database Integration:**
  - `mongo.py`: Interfaces with MongoDB for data persistence.
  - `chroma.py`: Manages interactions with ChromaDB for vector storage and retrieval.
- **Core AI/RAG Components:**
  - `embedder.py`: Responsible for generating embeddings for project data.
  - `llm.py`: Integrates with Language Models for RAG capabilities and AI-powered insights.
- **Security:** `security.py` for token handling and authorization.

---

## Technologies Used

- **Backend:**
  - Python
  - FastAPI (for API development)
  - MongoDB (NoSQL Database)
  - ChromaDB (Vector Database)
  - LLMs (for RAG and analysis)
  - Sentence Transformers (likely for embeddings)
- **Frontend:**
  - HTML5
  - CSS3
  - JavaScript
  - PDF.js (for PDF text extraction)
- **Deployment/Development:**
  - Git
  - Jupyter Notebooks (`.ipynb` files for data structuring, embedding, RAG pipeline building, MongoDB setup, etc.)

---

## Installation

To set up and run the project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/AdityaAdi07/Project-Repository-Management-with-RAG-Pipeline.git
    cd Project-Repository-Management-with-RAG-Pipeline/DBMS-25
    ```

2.  **Set up Python environment and install dependencies:**
    ```bash
    python -m venv venv
    .\venv\Scripts\activate   # On Windows
    # source venv/bin/activate # On macOS/Linux
    pip install -r backend_new/requirements.txt
    ```

3.  **Set up MongoDB:**
    - Ensure MongoDB is installed and running on your system.
    - Refer to `mongo_db_setup.ipynb` for initial database setup and data loading.

4.  **Build ChromaDB (for RAG):**
    - Refer to `build_chroma.ipynb` to build and populate your Chroma vector store.

5.  **Run the Backend (FastAPI):**
    Navigate to the `backend_new` directory and start the FastAPI application:
    ```bash
    cd backend_new
    uvicorn app:app --reload
    ```
    The backend API will typically run on `http://localhost:8000`.

6.  **Run the Frontend:**
    Open the `frontend/dashboard.html`, `frontend/student.html`, or `frontend/teacher.html` files directly in your web browser. Ensure your browser allows local file access for JavaScript if needed, or serve the `frontend` directory using a simple local web server (e.g., Python's `http.server`).

---

## How it Works

The system integrates a multi-layered approach to project discovery and management:

1.  **Data Ingestion & Embedding:** Project data from JSON files and MongoDB is processed. Descriptions and other relevant text are transformed into vector embeddings using `embedder.py`.
2.  **Vector Storage:** These embeddings are stored in ChromaDB for efficient semantic search.
3.  **Frontend Interaction:** Users interact via the student or faculty dashboards.
4.  **Synopsis Management:** Students can manually input project synopses or upload PDF files. The `dashboard.js` script, using PDF.js, extracts text from PDFs. This rich synopsis data (title, objective, domain, tech stack, description) is then sent to the backend.
5.  **Semantic Search:** When a user searches for a project, the query is embedded and matched against the project embeddings in ChromaDB, returning semantically similar projects.
6.  **Backend Processing:** FastAPI endpoints handle API requests for authentication, data retrieval (projects, teams, student info, search history), and synopsis saving.
7.  **RAG Pipeline:** For advanced queries or analysis, the RAG pipeline (inferred from `llm.py` and `chroma.py`) retrieves relevant project information and uses an LLM to generate insights.

---

## Author

Developed by Aditya Adi 
GitHub: [https://github.com/AdityaAdi07](https://github.com/AdityaAdi07)
