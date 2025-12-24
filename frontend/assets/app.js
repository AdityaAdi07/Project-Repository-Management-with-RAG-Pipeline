(() => {
    const DEFAULT_API_BASE = "http://localhost:8000";

    const API_BASE = window.API_BASE ?? DEFAULT_API_BASE;

    function getSession() {
        return {
            token: localStorage.getItem("access_token"),
            role: localStorage.getItem("role"),
            username: localStorage.getItem("username"),
        };
    }

    function setSession({ token, role, username }) {
        if (!token || !role || !username) {
            throw new Error("Invalid session payload");
        }
        localStorage.setItem("access_token", token);
        localStorage.setItem("role", role);
        localStorage.setItem("username", username);
    }

    function clearSession() {
        localStorage.removeItem("access_token");
        localStorage.removeItem("role");
        localStorage.removeItem("username");
        // Also clear RVCEPortal session so login page doesn't auto-redirect after logout
        // This key is defined in rvce-portal.js as SESSION_KEY = "rvce_dbms_session"
        localStorage.removeItem("rvce_dbms_session");
    }

    function logout() {
        clearSession();
        window.location.href = "./login.html";
    }

    function requireRole(roles) {
        const session = getSession();
        if (!session.token || !session.role) {
            return null;
        }
        const allowed = Array.isArray(roles) ? roles : [roles];
        if (allowed.length && !allowed.includes(session.role)) {
            return null;
        }
        return session;
    }

    function goToDashboard(role) {
        window.location.href = role === "teacher" ? "./teacher.html" : "./student.html";
    }

    async function apiPost(path, body, { auth = true, signal } = {}) {
        const headers = { "Content-Type": "application/json" };
        if (auth) {
            const { token } = getSession();
            if (!token) {
                throw new Error("Session expired. Please login again.");
            }
            headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE}${path}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal,
        });

        let payload = null;
        try {
            payload = await res.json();
        } catch (err) {
            throw new Error(`Failed to parse response (${res.status})`);
        }

        if (!res.ok) {
            const detail = payload?.detail || payload?.message || payload?.error;
            throw new Error(detail || `Request failed with status ${res.status}`);
        }

        return payload;
    }

    const ANALYSIS_KEY = "analysis_results";
    const MAX_ANALYSIS_HISTORY = 8;

    function persistAnalysisResult(record) {
        if (!record) return;
        const current = getAnalysisResults();
        const enriched = {
            id: crypto.randomUUID?.() ?? `${Date.now()}`,
            savedAt: new Date().toISOString(),
            ...record,
        };
        current.unshift(enriched);
        const trimmed = current.slice(0, MAX_ANALYSIS_HISTORY);
        localStorage.setItem(ANALYSIS_KEY, JSON.stringify(trimmed));
        return enriched;
    }

    function getAnalysisResults() {
        try {
            const raw = localStorage.getItem(ANALYSIS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            console.warn("Failed to read cached analyses", err);
            return [];
        }
    }

    function clearAnalysisCache() {
        localStorage.removeItem(ANALYSIS_KEY);
    }

    function renderAnalysisCard(result) {
        const { title, synopsis, similar_projects: similarProjects, savedAt } = result;
        const when = savedAt ? new Date(savedAt).toLocaleString() : "Recently saved";
        const similar = Array.isArray(similarProjects) ? similarProjects : [];
        const summary = synopsis?.overview ?? "No overview provided.";
        const recommendations = synopsis?.recommendations;

        const topTags = similar.slice(0, 4);

        return `
            <div class="mini-card analysis-card">
                <div class="inline-group" style="justify-content: space-between; align-items: baseline;">
                    <h3>${escapeHtml(title ?? "Untitled analysis")}</h3>
                    <span class="badge">Saved ${escapeHtml(when)}</span>
                </div>
                <p>${escapeHtml(summary)}</p>
                ${recommendations ? `<div class="code-block">${escapeHtml(recommendations)}</div>` : ""}
                ${topTags.length ? `
                    <div>
                        <p class="text-muted" style="margin-bottom: 8px;">Similar projects (${similar.length})</p>
                        <div class="tag-list">
                            ${topTags
                                .map((item) => `<span class="tag">${escapeHtml(item.title ?? "Untitled")}</span>`)
                                .join("")}
                        </div>
                    </div>
                ` : ""}
            </div>
        `;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function populateUserBadge(element) {
        const session = getSession();
        if (!element || !session?.username) return;
        const name = session.username.split("@")[0];
        element.textContent = `${name} · ${session.role ?? "guest"}`;
    }

    function openModal(backdrop, onOpen) {
        if (!backdrop) return;
        backdrop.classList.add("active");
        document.body.style.overflow = "hidden";
        onOpen?.();
    }

    function closeModal(backdrop, onClose) {
        if (!backdrop) return;
        backdrop.classList.remove("active");
        document.body.style.overflow = "auto";
        onClose?.();
    }

    function wireModal(backdrop, closeButton) {
        if (!backdrop || !closeButton) return;
        closeButton.addEventListener("click", () => closeModal(backdrop));
        backdrop.addEventListener("click", (event) => {
            if (event.target === backdrop) {
                closeModal(backdrop);
            }
        });
    }

    window.RAGApp = {
        API_BASE,
        getSession,
        setSession,
        clearSession,
        logout,
        requireRole,
        goToDashboard,
        apiPost,
        persistAnalysisResult,
        getAnalysisResults,
        clearAnalysisCache,
        renderAnalysisCard,
        escapeHtml,
        populateUserBadge,
        openModal,
        closeModal,
        wireModal,
    };
})();
