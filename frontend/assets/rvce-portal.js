(() => {
    const API_BASE = window.API_BASE ?? "http://localhost:8000";
    const SESSION_KEY = "rvce_dbms_session";

    const defaultHeaders = {
        "Content-Type": "application/json",
        Accept: "application/json",
    };

    function saveSession({ token, expires_at: expiresAt, s_mail_id: email }) {
        if (!token) {
            throw new Error("Missing token in session payload");
        }
        const session = {
            token,
            email,
            expiresAt,
            savedAt: new Date().toISOString(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    }

    function loadSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed?.token) return null;
            if (parsed.expiresAt && new Date(parsed.expiresAt) <= new Date()) {
                clearSession();
                return null;
            }
            return parsed;
        } catch (err) {
            console.warn("Failed to parse session", err);
            clearSession();
            return null;
        }
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    function logout(next = "./login.html") {
        clearSession();
        window.location.replace(next);
    }

    function ensureAuth({ redirect = true } = {}) {
        const session = loadSession();
        if (!session) {
            if (redirect) {
                logout();
            }
            return null;
        }
        return session;
    }

    async function apiRequest(path, { method = "GET", body, auth = true, signal } = {}) {
        const headers = { ...defaultHeaders };
        if (auth) {
            const session = ensureAuth({ redirect: false });
            if (!session?.token) {
                throw new Error("Session expired. Please log in again.");
            }
            headers.Authorization = `Bearer ${session.token}`;
        }

        const response = await fetch(`${API_BASE}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal,
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch (err) {
            console.warn("Failed to decode response", err);
        }

        if (!response.ok) {
            const detail = payload?.detail || payload?.message || payload?.error;
            throw new Error(detail || `Request failed with status ${response.status}`);
        }

        return payload;
    }

    async function login({ s_mail_id, usn }) {
        const result = await apiRequest("/auth/login", {
            method: "POST",
            body: { s_mail_id, usn },
            auth: false,
        });
        return saveSession({ ...result, s_mail_id });
    }

    async function facultyLogin({ f_mail_id, fac_id }) {
        const result = await apiRequest("/auth/faculty-login", {
            method: "POST",
            body: { f_mail_id, fac_id },
            auth: false,
        });
        return saveSession({ ...result, s_mail_id: f_mail_id });
    }

    async function fetchProjectsSummary() {
        return apiRequest("/projects/summary", { method: "GET" });
    }

    async function searchTitles({ query, top_k }) {
        return apiRequest("/search/title", {
            method: "POST",
            body: { query, top_k },
        });
    }

    async function analyzeSynopsis(payload) {
        return apiRequest("/analyze/synopsis", {
            method: "POST",
            body: payload,
        });
    }

    async function fetchMyTeam() {
        return apiRequest("/students/my-team", { method: "GET" });
    }

    async function fetchMySearchHistory(limit = 20) {
        return apiRequest(`/students/my-search-history?limit=${limit}`, { method: "GET" });
    }

    async function saveSynopsis(payload) {
        return apiRequest("/students/synopsis", {
            method: "POST",
            body: payload,
        });
    }

    function formatPercent(value, digits = 1) {
        if (typeof value !== "number" || Number.isNaN(value)) return "0%";
        return `${value.toFixed(digits)}%`;
    }

    function formatNumber(value) {
        if (value == null) return "0";
        return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
    }

    function formatDate(value) {
        if (!value) return "—";
        try {
            return new Date(value).toLocaleString();
        } catch (err) {
            return String(value);
        }
    }

    function summarizeDomains(domains = []) {
        if (!Array.isArray(domains) || !domains.length) return "—";
        return domains
            .slice(0, 3)
            .map((item) => `${item.domain} (${item.count})`)
            .join(" · ");
    }

    window.RVCEPortal = {
        API_BASE,
        login,
        facultyLogin,
        logout,
        ensureAuth,
        loadSession,
        fetchProjectsSummary,
        searchTitles,
        analyzeSynopsis,
        fetchMyTeam,
        fetchMySearchHistory,
        saveSynopsis,
        formatPercent,
        formatNumber,
        formatDate,
        summarizeDomains,
        clearSession,
    };
})();
