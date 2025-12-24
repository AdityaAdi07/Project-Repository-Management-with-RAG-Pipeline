(() => {
    const portal = window.RVCEPortal;
    if (!portal) {
        console.error("RVCEPortal helpers not loaded");
        return;
    }

    const { API_BASE, ensureAuth, loadSession, logout, analyzeSynopsis } = portal;

    let currentTeamId = null;
    let currentTeamDoc = null;
    let currentProjectDoc = null;
    let allTeams = [];

    function byId(id) {
        return document.getElementById(id);
    }

    function setAlert(el, text, type = "info") {
        if (!el) return;
        if (!text) {
            el.hidden = true;
            el.textContent = "";
            el.className = "alert";
            return;
        }
        el.hidden = false;
        el.textContent = text;
        el.className = `alert ${type}`;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    async function authFetch(path, options = {}) {
        const session = loadSession();
        if (!session || !session.token) {
            logout();
            throw new Error("Session expired. Redirecting to login.");
        }

        const headers = {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(options.headers || {}),
            Authorization: `Bearer ${session.token}`,
        };

        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
        });

        let payload = null;
        try {
            payload = await res.json();
        } catch (e) {
            // ignore
        }

        if (!res.ok) {
            const detail = payload?.detail || payload?.message || payload?.error;
            throw new Error(detail || `Request failed with status ${res.status}`);
        }
        return payload;
    }

    function ensureTeamSearchBar(list) {
        const parent = list?.parentElement;
        if (!parent || document.getElementById("team-search-container")) return;

        const wrapper = document.createElement("div");
        wrapper.id = "team-search-container";
        wrapper.className = "team-search-bar";
        wrapper.innerHTML = `
            <input id="team-search-input" type="text" placeholder="Search team name or ID" />
            <button class="secondary small" type="button" id="team-search-btn">Search</button>
            <button class="ghost small" type="button" id="team-search-clear">Clear</button>
        `;
        parent.insertBefore(wrapper, list);

        const input = byId("team-search-input");
        const btn = byId("team-search-btn");
        const clear = byId("team-search-clear");

        function applyFilter() {
            const query = (input.value || "").trim().toLowerCase();
            if (!query) {
                renderTeamsList(allTeams);
                return;
            }
            const filtered = allTeams.filter((t) => {
                const name = String(t.t_name || "").toLowerCase();
                const id = String(t.team_id || "").toLowerCase();
                return name.includes(query) || id.includes(query);
            });
            renderTeamsList(filtered);
        }

        btn?.addEventListener("click", applyFilter);
        clear?.addEventListener("click", () => {
            input.value = "";
            renderTeamsList(allTeams);
        });
        input?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                applyFilter();
            }
        });
    }

    function renderTeamsList(teams) {
        const list = byId("team-list");
        const status = byId("team-list-status");
        const metricTeams = byId("metric-fac-teams");
        const metricApproved = byId("metric-fac-approved");
        const metricPending = byId("metric-fac-pending");

        if (!list) return;

        ensureTeamSearchBar(list);

        if (!teams || !teams.length) {
            list.innerHTML = '<div class="empty-state">No teams mapped to your faculty ID yet.</div>';
            metricTeams && (metricTeams.textContent = "0");
            metricApproved && (metricApproved.textContent = "0");
            metricPending && (metricPending.textContent = "0");
            return;
        }

        let approvedCount = 0;
        let pendingCount = 0;

        list.innerHTML = teams
            .map((t) => {
                const approved = String(t.approved || "NILL").toUpperCase();
                const isApproved = approved === "OK" || approved === "APPROVED";
                const isPending = approved === "NILL" || approved === "PENDING";
                if (isApproved) approvedCount += 1;
                if (isPending) pendingCount += 1;

                const statusLabel = isApproved ? "Approved" : (isPending ? "Pending" : approved);
                const statusClass = isApproved ? "badge status-approved" : (isPending ? "badge status-pending" : "badge");

                return `
                    <button class="mini-card team-card" type="button" data-team-id="${t.team_id}">
                        <div class="inline-group" style="justify-content: space-between; align-items: baseline;">
                            <h3>${t.t_name || t.team_id}</h3>
                            <span class="${statusClass}">${statusLabel}</span>
                        </div>
                        <p class="text-muted">Team ID: ${t.team_id}<br/>Faculty: ${t.fac_id || "—"}</p>
                    </button>
                `;
            })
            .join("");

        metricTeams && (metricTeams.textContent = String(teams.length));
        metricApproved && (metricApproved.textContent = String(approvedCount));
        metricPending && (metricPending.textContent = String(pendingCount));

        list.querySelectorAll("[data-team-id]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const teamId = btn.getAttribute("data-team-id");
                if (teamId) {
                    loadTeamDetail(teamId);
                }
            });
        });

        setAlert(status, "", "info");
    }

    function renderTeams(data) {
        const teams = Array.isArray(data?.teams) ? data.teams : [];
        allTeams = teams;
        renderTeamsList(teams);
    }

    async function loadTeams() {
        const status = byId("team-list-status");
        try {
            setAlert(status, "Loading teams for this faculty...", "info");
            const data = await authFetch("/teams/my", { method: "GET" });
            renderTeams(data);
        } catch (err) {
            console.error(err);
            setAlert(status, err.message || "Failed to load teams.", "error");
        }
    }

    function renderTeamDetail(payload) {
        const emptyState = byId("team-detail-empty");
        const detail = byId("team-detail");
        if (!payload?.team) {
            if (detail) detail.hidden = true;
            if (emptyState) emptyState.hidden = false;
            return;
        }

        const team = payload.team;
        const projects = Array.isArray(payload.projects) ? payload.projects : [];
        const project = projects[0] || null;

        currentTeamId = team.team_id;
        currentTeamDoc = team;
        currentProjectDoc = project;

        if (emptyState) emptyState.hidden = true;
        if (detail) detail.hidden = false;

        const approvedRaw = String(team.approved || "NILL").toUpperCase();
        const isApproved = approvedRaw === "OK" || approvedRaw === "APPROVED";
        const isPending = approvedRaw === "NILL" || approvedRaw === "PENDING";

        byId("detail-team-id").textContent = team.team_id || "—";
        byId("detail-team-name").textContent = team.t_name || "—";
        const approvedEl = byId("detail-team-approved");
        if (approvedEl) {
            approvedEl.textContent = isApproved ? "Approved" : (isPending ? "Pending" : approvedRaw);
            approvedEl.className = `badge status-pill ${isApproved ? "status-approved" : isPending ? "status-pending" : "status-other"}`;
        }

        if (project) {
            byId("detail-project-title").textContent = project.title || "—";
            byId("detail-project-domain").textContent = project.domain || "—";
            byId("detail-project-tech").textContent = project.tech_stack || "—";
            byId("detail-project-objective").textContent = project.objective || "—";
            byId("detail-project-year").textContent = project.year || "—";
        } else {
            byId("detail-project-title").textContent = "No project document for this team.";
            byId("detail-project-domain").textContent = "—";
            byId("detail-project-tech").textContent = "—";
            byId("detail-project-objective").textContent = "—";
            byId("detail-project-year").textContent = "—";
        }

        const toggle = byId("approval-toggle");
        if (toggle) {
            toggle.checked = isApproved;
        }
        updateApprovalLabel();

        setAlert(byId("project-llm-status"), "", "info");
        const out = byId("project-llm-output");
        if (out) out.textContent = "";
    }

    async function loadTeamDetail(teamId) {
        const status = byId("team-list-status");
        try {
            setAlert(status, `Loading details for team ${teamId}...`, "info");
            const data = await authFetch(`/teams/${encodeURIComponent(teamId)}`, { method: "GET" });
            renderTeamDetail(data);
            setAlert(status, "", "info");
        } catch (err) {
            console.error(err);
            setAlert(status, err.message || "Failed to load team details.", "error");
        }
    }

    function updateApprovalLabel() {
        const toggle = byId("approval-toggle");
        const label = byId("approval-label");
        if (!toggle || !label) return;
        label.textContent = toggle.checked ? "Mark as Not Approved" : "Mark as Approved";
    }

    async function handleApprovalSubmit() {
        const status = byId("approval-status");
        const toggle = byId("approval-toggle");
        if (!currentTeamId || !toggle) {
            setAlert(status, "Select a team before saving approval.", "error");
            return;
        }

        try {
            setAlert(status, "Saving approval decision...", "info");
            const payload = { approved: Boolean(toggle.checked) };
            const data = await authFetch(`/teams/${encodeURIComponent(currentTeamId)}/approval`, {
                method: "POST",
                body: JSON.stringify(payload),
            });

            renderTeamDetail({ team: data.team, projects: currentProjectDoc ? [currentProjectDoc] : [] });
            setAlert(status, "Decision saved.", "success");
            await loadTeams();
        } catch (err) {
            console.error(err);
            setAlert(status, err.message || "Failed to update approval.", "error");
        }
    }

    async function handleProjectAnalysis() {
        const status = byId("project-llm-status");
        const out = byId("project-llm-output");

        if (!currentProjectDoc) {
            setAlert(status, "No project document found for this team.", "error");
            return;
        }

        const p = currentProjectDoc;
        const description = [
            p.objective || "",
            p.domain ? `Domain: ${p.domain}.` : "",
            p.tech_stack ? `Tech stack: ${p.tech_stack}.` : "",
        ]
            .filter(Boolean)
            .join(" ");

        const payload = {
            title: p.title || "",
            description: description || p.title || "",
            tech_stack: p.tech_stack || "",
            domain: p.domain || "",
            objective: p.objective || "",
            top_k: 5,
        };

        try {
            setAlert(status, "Sending project details to LLM for analysis...", "info");
            out.textContent = "";
            const result = await analyzeSynopsis(payload);
            const text = result.llm_analysis || "No LLM analysis text returned.";
            renderLLMAnalysis(text, out);
            setAlert(status, "Analysis complete.", "success");
        } catch (err) {
            console.error(err);
            setAlert(status, err.message || "Failed to run LLM analysis.", "error");
        }
    }

    // Copy parsing functions from student dashboard for consistent formatting
    function parseLLMAnalysis(text) {
        if (!text) return { cards: [], legacy: null };
        
        // Try ASCII card parsing first
        const cards = parseAsciiCards(text);
        if (cards.length >= 2) {
            return { cards };
        }

        // Try parsing structured text with headings as cards
        const headingCards = parseHeadingBasedCards(text);
        if (headingCards.length >= 2) {
            return { cards: headingCards };
        }

        // Fall back to legacy parsing
        return { cards: [], legacy: parseLegacyAnalysis(text) };
    }

    function parseAsciiCards(text) {
        if (!text) return [];
        const lines = text.split(/\r?\n/);
        const cards = [];
        let current = null;
        let inCard = false;

        const flush = () => {
            if (current && current.lines.length) {
                current.lines = current.lines.filter((line) => line.trim().length);
                if (current.lines.length) {
                    cards.push(current);
                }
            }
            current = null;
            inCard = false;
        };

        for (const raw of lines) {
            const line = raw.trimEnd();
            if (!line) continue;

            // Handle card start (╭ or similar patterns)
            if (line.match(/^[╭┌]/) || (line.includes("──") && !current)) {
                flush();
                const titleMatch = line.match(/(?:[╭┌][─\s]*)?(?:\[)?([^\]]+?)(?:\])?(?:[─\s]*[╰└])?$/);
                const title = titleMatch ? titleMatch[1].replace(/[─\s]+$/g, "").trim() : line.replace(/^[╭┌\s─]+/, "").replace(/[─\s]+$/g, "").trim();
                current = { title: title || "Analysis", lines: [] };
                inCard = true;
            } 
            // Handle card end
            else if (line.match(/^[╰└]/)) {
                flush();
            } 
            // Handle card content (│ or • or -)
            else if (inCard && current && (line.startsWith("│") || line.startsWith("┃") || line.startsWith("•") || line.startsWith("-") || line.startsWith("*"))) {
                const cleaned = line.replace(/^[│┃•\-\*\s]+/, "").trim();
                if (cleaned) {
                    current.lines.push(cleaned);
                }
            }
            // If we're in a card but line doesn't start with special chars, it might be continuation
            else if (inCard && current && line.trim()) {
                // Check if it looks like a continuation (not a new card)
                if (!line.match(/^[╭╰┌└│┃#*]/)) {
                    current.lines.push(line.trim());
                }
            }
        }

        flush();
        return cards;
    }

    function parseHeadingBasedCards(text) {
        if (!text) return [];
        
        const cards = [];
        const sections = text.split(/(?=^#{1,6}\s+[^\n]+|^[A-Z][^\n:]{3,50}:)/m);
        
        for (const section of sections) {
            const trimmed = section.trim();
            if (!trimmed || trimmed.length < 20) continue;
            
            const headingMatch = trimmed.match(/^(?:#{1,6}\s+)?([^\n:]{3,60}):?\s*\n/);
            const titleMatch = trimmed.match(/^(?:###?\s+)?([^\n]+?)(?:\n|$)/);
            const title = headingMatch ? headingMatch[1].trim() : (titleMatch ? titleMatch[1].trim() : "Analysis Section");
            
            const content = trimmed
                .replace(/^#{1,6}\s+[^\n]+\n?/, "")
                .replace(/^[^\n]+:\s*\n?/, "")
                .split(/\n/)
                .map(line => line.trim())
                .filter(line => line && !line.match(/^#{1,6}\s/))
                .map(line => line.replace(/^[\d\.\)\-\*•]\s*/, ""))
                .filter(line => line.length > 3);
            
            if (content.length > 0) {
                cards.push({ title, lines: content });
            }
        }
        
        return cards;
    }

    function parseLegacyAnalysis(text) {
        if (!text) return null;

        const result = {
            introduction: null,
            whyFlagged: null,
            exactMatching: null,
            uniqueness: null,
            guidelines: []
        };

        const introPatterns = [
            /\*\*Introduction\*\*\s*\n([\s\S]*?)(?=\*\*Why|##|###|$)/i,
            /(?:##\s*)?Introduction\s*\n([\s\S]*?)(?=##|###|Why|$)/i
        ];

        for (const pattern of introPatterns) {
            const match = text.match(pattern);
            if (match) {
                result.introduction = match[1].trim();
                break;
            }
        }

        const whyPatterns = [
            /\*\*Why\s+it\s+was\s+flagged\s+as\s+similar[^*]*\*\*\s*\n([\s\S]*?)(?=\*\*Exact|##|###|$)/i,
            /Why\s+(?:it\s+was\s+)?flagged\s+as\s+similar[^*]*\n([\s\S]*?)(?=Exact|##|###|$)/i
        ];

        for (const pattern of whyPatterns) {
            const match = text.match(pattern);
            if (match) {
                result.whyFlagged = extractBulletPoints(match[1]);
                break;
            }
        }

        const exactPatterns = [
            /\*\*Exact\s+matching\s+components[^*]*\*\*\s*\n([\s\S]*?)(?=\*\*Uniqueness|##|###|$)/i,
            /Exact\s+matching\s+components[^*]*\n([\s\S]*?)(?=Uniqueness|##|###|$)/i
        ];

        for (const pattern of exactPatterns) {
            const match = text.match(pattern);
            if (match) {
                result.exactMatching = extractBulletPoints(match[1]);
                break;
            }
        }

        const uniquenessPatterns = [
            /\*\*Uniqueness\s+improvement[^*]*\*\*\s*\n([\s\S]*?)(?=\*\*General|##|###|$)/i,
            /Uniqueness\s+improvement[^*]*\n([\s\S]*?)(?=General|##|###|$)/i
        ];

        for (const pattern of uniquenessPatterns) {
            const match = text.match(pattern);
            if (match) {
                result.uniqueness = extractBulletPoints(match[1]);
                break;
            }
        }

        const guidelinesPatterns = [
            /\*\*General\s+originality\s+guidelines[^*]*\*\*\s*\n([\s\S]*?)(?=##|###|$)/i,
            /General\s+originality\s+guidelines[^*]*\n([\s\S]*?)(?=##|###|$)/i
        ];

        for (const pattern of guidelinesPatterns) {
            const match = text.match(pattern);
            if (match) {
                const guidelineItems = extractBulletPoints(match[1]);
                guidelineItems.forEach((item, idx) => {
                    if (item.trim().length > 10) {
                        const boldMatch = item.match(/\*\*(.+?)\*\*:\s*(.+)/);
                        if (boldMatch) {
                            result.guidelines.push({
                                number: idx + 1,
                                title: boldMatch[1].trim(),
                                content: [boldMatch[2].trim()]
                            });
                        } else {
                            result.guidelines.push({
                                number: idx + 1,
                                title: item.split(":")[0].replace(/\*\*/g, "").trim(),
                                content: item.includes(":") ? [item.split(":").slice(1).join(":").trim()] : [item.trim()]
                            });
                        }
                    }
                });
                break;
            }
        }

        return result;
    }

    function extractBulletPoints(text) {
        if (!text) return [];
        return text
            .split(/\n/)
            .map(line => line.trim())
            .filter(line => line && line.length > 3)
            .map(line => line.replace(/^[\d\.\)\-\*•]\s*/, ""))
            .filter(line => line.length > 3);
    }

    function sanitizeCardTitle(title = "") {
        return title.replace(/\*\*/g, "").replace(/[_`]/g, "").trim();
    }

    function formatCardTitle(title = "") {
        const cleaned = sanitizeCardTitle(title);
        const parts = cleaned.split(":");
        if (parts.length > 1) {
            const label = parts.shift()?.trim();
            const value = parts.join(":").trim();
            return `
                <span class="card-title-label">${escapeHtml(label || "")}</span>
                <span class="card-title-value">${escapeHtml(value)}</span>
            `;
        }
        return `<span class="card-title-value">${escapeHtml(cleaned)}</span>`;
    }

    function detectSectionTitle(line = "") {
        const normalized = line.replace(/[:：\s]+$/g, "").toLowerCase();
        if (!normalized) return null;
        if (normalized.includes("why flagged") || normalized.includes("why it was flagged")) {
            return "Why Flagged as Similar";
        }
        if (normalized.includes("exact matching") || normalized.includes("matching components")) {
            return "Exact Matching Components";
        }
        if (normalized.includes("unique") || normalized.includes("uniqueness")) {
            return "Uniqueness Enhancements";
        }
        if (normalized.includes("student project synopsis")) {
            return "Student Project Synopsis";
        }
        return null;
    }

    function splitCardSections(lines = []) {
        const sections = [];
        let current = null;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            const heading = detectSectionTitle(line);
            if (heading) {
                current = { heading, items: [] };
                sections.push(current);
            } else {
                if (!current) {
                    current = { heading: null, items: [] };
                    sections.push(current);
                }
                current.items.push(line);
            }
        }

        return sections.filter((section) => section.items.length);
    }

    function renderProjectCardContent(lines = []) {
        const sections = splitCardSections(lines);

        if (!sections.length) {
            return `
                <ul class="llm-card-list">
                    ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
                </ul>
            `;
        }

        return `
            <div class="llm-card-sections">
                ${sections
                    .map(
                        (section) => `
                            <section class="llm-card-section">
                                ${
                                    section.heading
                                        ? `<h6>${escapeHtml(section.heading)}</h6>`
                                        : ""
                                }
                                <ul class="llm-card-list">
                                    ${section.items
                                        .map((item) => `<li>${escapeHtml(item)}</li>`)
                                        .join("")}
                                </ul>
                            </section>
                        `,
                    )
                    .join("")}
            </div>
        `;
    }

    function renderGuidelinesContent(lines = []) {
        return `
            <ul class="llm-guidelines-list">
                ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
            </ul>
        `;
    }

    function renderLLMAnalysis(text, container) {
        if (!container) return;
        if (!text) {
            container.textContent = "No LLM analysis text returned.";
            return;
        }

        // Use the same parsing logic as student page - EXACT COPY
        const analysis = parseLLMAnalysis(text);
        let llmBlock = "";

        if (analysis.cards && analysis.cards.length) {
            const cardHtml = analysis.cards
                .map((card) => {
                    const normalizedTitle = sanitizeCardTitle(card.title);
                    const isGuidelines = /originality/i.test(normalizedTitle);
                    const contentHtml = isGuidelines
                        ? renderGuidelinesContent(card.lines)
                        : renderProjectCardContent(card.lines);

                    if (!contentHtml.trim()) {
                        return "";
                    }

                    return `
                        <article class="llm-card ${isGuidelines ? "guidelines-card" : ""}">
                            <header class="llm-card-header">
                                <h5>${formatCardTitle(normalizedTitle)}</h5>
                            </header>
                            ${contentHtml}
                        </article>
                    `;
                })
                .filter(Boolean)
                .join("");

            if (cardHtml) {
                llmBlock = `
                    <section class="llm-analysis-section">
                        <div class="section-header tight">
                            <h4>LLM Analysis</h4>
                        </div>
                        <div class="llm-card-grid">
                            ${cardHtml}
                        </div>
                    </section>
                `;
            }
        } else if (analysis.legacy) {
            const legacy = analysis.legacy;
            const hasContent =
                legacy.introduction ||
                legacy.whyFlagged ||
                legacy.exactMatching ||
                legacy.uniqueness ||
                (legacy.guidelines && legacy.guidelines.length > 0);

            if (hasContent) {
                llmBlock = `
                    <section class="llm-analysis-section">
                        <div class="section-header tight">
                            <h4>LLM Analysis</h4>
                        </div>
                        
                        <div class="academic-report">
                            <h3 class="report-title">Academic Report: Project Similarity Analysis and Originality Enhancement</h3>
                            
                            ${legacy.introduction ? `
                                <div class="introduction-card">
                                    <h5 class="report-section-title">Introduction</h5>
                                    <div class="introduction-content">
                                        ${escapeHtml(legacy.introduction).split('\n').map(line => line.trim()).filter(line => line).map(line => `<p>${line}</p>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${legacy.whyFlagged && legacy.whyFlagged.length > 0 ? `
                                <div class="analysis-section-card">
                                    <h5 class="report-section-title">Why it was flagged as similar (point-wise)</h5>
                                    <ol class="numbered-list">
                                        ${legacy.whyFlagged.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
                                    </ol>
                                </div>
                            ` : ''}
                            
                            ${legacy.exactMatching && legacy.exactMatching.length > 0 ? `
                                <div class="analysis-section-card">
                                    <h5 class="report-section-title">Exact matching components (point-wise)</h5>
                                    <ol class="numbered-list">
                                        ${legacy.exactMatching.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                                    </ol>
                                </div>
                            ` : ''}
                            
                            ${legacy.uniqueness && legacy.uniqueness.length > 0 ? `
                                <div class="analysis-section-card">
                                    <h5 class="report-section-title">Uniqueness improvement (2-3 specific action steps)</h5>
                                    <ol class="numbered-list">
                                        ${legacy.uniqueness.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                                    </ol>
                                </div>
                            ` : ''}
                        
                            ${legacy.guidelines && legacy.guidelines.length > 0 ? `
                                <div class="analysis-section-card">
                                    <h5 class="report-section-title">General originality guidelines (5 bullet points)</h5>
                                    <ul class="guideline-list">
                                        ${legacy.guidelines.map((guideline) => `
                                            <li>
                                                ${guideline.title ? `<strong>${escapeHtml(guideline.title)}</strong>` : ''}
                                                ${guideline.content && guideline.content.length > 0 ? `: ${escapeHtml(guideline.content[0])}` : ''}
                                            </li>
                                        `).join("")}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                        
                    </section>
                `;
            } else {
                llmBlock = `
                    <section class="llm-analysis-section">
                        <div class="section-header tight">
                            <h4>LLM Analysis</h4>
                        </div>
                        <div class="llm-text-block">
                            ${escapeHtml(text).replace(/\n/g, '<br>')}
                        </div>
                    </section>
                `;
            }
        } else {
            // Fallback: display as formatted text block
            llmBlock = `
                <section class="llm-analysis-section">
                    <div class="section-header tight">
                        <h4>LLM Analysis</h4>
                    </div>
                    <div class="llm-text-block">
                        ${escapeHtml(text).replace(/\n/g, '<br>')}
                    </div>
                </section>
            `;
        }

        container.innerHTML = llmBlock;
    }

    // Old parsing code removed - keeping for reference
    function _old_renderLLMAnalysis(text, container) {
        if (!container) return;
        if (!text) {
            container.textContent = "No LLM analysis text returned.";
            return;
        }

        // Clean and split text into lines
        const rawLines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("```"));

        let studentSynopsis = null;
        const projects = [];
        let currentProject = null;
        let currentSection = null;
        let guidelines = [];
        let inGuidelinesSection = false;
        let projectCounter = 0;

        // Parse the structure
        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            const lower = line.toLowerCase();
            const cleanLine = line.replace(/^[#\*\•\s\-_=]+/, "").trim();

            // Skip empty lines
            if (!line) continue;

            // Detect Student Project Synopsis
            if ((lower.includes("student project synopsis") || lower.includes("student synopsis")) && !studentSynopsis) {
                studentSynopsis = { items: [] };
                continue;
            }

            // Collect student synopsis items (stop when we hit a project)
            if (studentSynopsis && !currentProject && !inGuidelinesSection) {
                // Check if we've moved to projects section
                if (lower.includes("project") && (lower.includes("similarity") || lower.includes("'auto") || lower.match(/auto\d+/))) {
                    studentSynopsis = null; // Stop collecting synopsis
                } else if (line.match(/^[\*\•\-]/)) {
                    const item = line.replace(/^[\*\•\-]\s*/, "").trim();
                    if (item && item.length > 3) {
                        studentSynopsis.items.push(escapeHtml(item).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"));
                    }
                } else if (line.length > 5 && 
                          !line.match(/^#{1,4}/) && 
                          !lower.includes("project") && 
                          !lower.includes("similarity") &&
                          !lower.includes("why flagged") &&
                          !lower.includes("exact matching") &&
                          !lower.includes("uniqueness")) {
                    // Regular text in synopsis
                    studentSynopsis.items.push(escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"));
                }
            }

            // Detect "Project 'autoXXX' Similarity Analysis" format
            // Match: "Project 'auto002' Similarity Analysis" or "Project auto002 Similarity Analysis"
            const projectMatch = line.match(/project\s+['"]?([^'"]+)['"]?\s+similarity\s+analysis/i) ||
                                line.match(/project\s+['"]([^'"]+)['"]/i);
            if (projectMatch && !inGuidelinesSection) {
                const projectId = projectMatch[1].trim();
                // Make sure it's not a section header
                if (projectId.length > 0 && 
                    !projectId.toLowerCase().includes("why") &&
                    !projectId.toLowerCase().includes("exact") &&
                    !projectId.toLowerCase().includes("uniqueness")) {
                    projectCounter++;
                    currentProject = {
                        number: projectCounter,
                        id: projectId,
                        title: `Project '${projectId}'`,
                        sections: []
                    };
                    projects.push(currentProject);
                    currentSection = null;
                    continue;
                }
            }

            // Detect numbered project format (fallback: "### 1. Project Name")
            if (!currentProject && !inGuidelinesSection) {
                const numberedMatch = line.match(/^(?:###\s*)?(\d+)\.\s*(.+)$/i);
                if (numberedMatch) {
                    const title = numberedMatch[2].trim();
                    const titleLower = title.toLowerCase();
                    if (title.length > 2 && 
                        !titleLower.includes("why it was flagged") &&
                        !titleLower.includes("exact matching") &&
                        !titleLower.includes("uniqueness enhancement") &&
                        !titleLower.includes("general")) {
                        projectCounter++;
                        currentProject = {
                            number: projectCounter,
                            id: numberedMatch[1],
                            title: title,
                            sections: []
                        };
                        projects.push(currentProject);
                        currentSection = null;
                        continue;
                    }
                }
            }

            // Detect general guidelines section
            if (lower.includes("general originality guidelines") || lower.includes("general guidelines")) {
                inGuidelinesSection = true;
                currentProject = null;
                currentSection = null;
                continue;
            }

            // Collect guidelines
            if (inGuidelinesSection) {
                if (line.match(/^\d+\./)) {
                    guidelines.push(line.replace(/^\d+\.\s*/, "").trim());
                } else if (line.match(/^[\*\•\-]/)) {
                    guidelines.push(line.replace(/^[\*\•\-]\s*/, "").trim());
                } else if (line.length > 20 && !line.match(/^#{1,4}/)) {
                    guidelines.push(line);
                }
                continue;
            }

            // Detect section headers (must be after a project is detected)
            if (currentProject) {
                // Check for section headers - be more flexible
                const isHeader = line.startsWith("####") || line.startsWith("###") || 
                                line.startsWith("##") ||
                                lower.includes("why flagged") || 
                                lower.includes("why it was flagged") ||
                                lower.includes("exact matching") || 
                                lower.includes("uniqueness enhancement") ||
                                lower.includes("uniqueness suggestions");
                
                if (isHeader) {
                    const sectionText = cleanLine.toLowerCase();
                    
                    if ((sectionText.includes("why") && (sectionText.includes("flagged") || sectionText.includes("similar"))) ||
                        (lower.includes("why it was flagged"))) {
                        currentSection = { type: "flagged", title: "Why Flagged as Similar", items: [] };
                        currentProject.sections.push(currentSection);
                        continue;
                    }
                    if (sectionText.includes("exact matching") || sectionText.includes("matching components")) {
                        currentSection = { type: "matching", title: "Exact Matching Components", items: [] };
                        currentProject.sections.push(currentSection);
                        continue;
                    }
                    if (sectionText.includes("uniqueness") || sectionText.includes("enhancement suggestions")) {
                        currentSection = { type: "suggestions", title: "Uniqueness Enhancement Suggestions", items: [] };
                    currentProject.sections.push(currentSection);
                        continue;
                    }
                }
            }

            // Collect items for current section
            if (currentSection) {
                // Skip if this is a new project
                if (line.match(/project\s+['"]?[^'"]+['"]?\s+similarity/i) || 
                    line.match(/^(?:###\s*)?\d+\./) ||
                    (lower.includes("project") && (lower.includes("similarity") || lower.match(/auto\d+/)))) {
                    currentSection = null;
                    continue;
                }
                
                // Skip section headers (but allow if we're already in a section)
                if ((line.match(/^####?\s/) || line.match(/^##\s/)) && 
                    (lower.includes("why flagged") || lower.includes("exact matching") || lower.includes("uniqueness enhancement"))) {
                    continue;
                }
                
                // Skip general guidelines section start
                if (lower.includes("general originality guidelines") || lower.includes("general guidelines")) {
                    currentSection = null;
                    continue;
                }
                
                // Handle bullet points (•, *, -)
                if (line.match(/^[\*\•\-]/)) {
                    const item = line.replace(/^[\*\•\-]\s*/, "").trim();
                    if (item && item.length > 3) {
                        let htmlItem = escapeHtml(item)
                            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                            .replace(/\*(.+?)\*/g, "<em>$1</em>");
                        currentSection.items.push(htmlItem);
                    }
                } 
                // Also capture lines that look like content (not headers, not empty)
                else if (line.length > 5 && 
                         !line.match(/^#{1,4}/) && 
                         !line.match(/^\d+\./) &&
                         !lower.includes("general originality") &&
                         !lower.includes("project") &&
                         !lower.includes("similarity analysis")) {
                    // Only add if it's meaningful content
                    let htmlItem = escapeHtml(line)
                        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.+?)\*/g, "<em>$1</em>");
                    // Avoid duplicates
                    if (htmlItem.length > 5 && 
                        (currentSection.items.length === 0 || 
                         currentSection.items[currentSection.items.length - 1] !== htmlItem)) {
                        currentSection.items.push(htmlItem);
                    }
                }
            }
        }

        // Debug logging
        console.log("Parsed:", {
            studentSynopsis: studentSynopsis ? studentSynopsis.items.length : 0,
            projectsCount: projects.length,
            guidelinesCount: guidelines.length,
            projects: projects.map(p => ({ number: p.number, title: p.title, sections: p.sections.map(s => ({ type: s.type, items: s.items.length })) }))
        });

        // Build HTML
        let html = '<div class="llm-analysis-container">';

        // Student Synopsis Card
        if (studentSynopsis && studentSynopsis.items.length > 0) {
            html += `<div class="llm-student-synopsis-card">
                <h4 class="llm-card-title">Student Project Synopsis</h4>
                <ul class="llm-synopsis-list">
                    ${studentSynopsis.items.map(item => `<li>${item}</li>`).join("")}
                    </ul>
            </div>`;
        }

        // Project cards - compact grid
        if (projects.length > 0) {
            html += '<div class="llm-projects-grid-compact">';
            projects.forEach((proj) => {
                html += `<article class="llm-project-card-compact">
                    <header class="llm-project-header-compact">
                        <span class="llm-project-badge">${proj.number}</span>
                        <h4 class="llm-project-title-compact">${escapeHtml(proj.title)}</h4>
                    </header>
                    <div class="llm-project-content-compact">`;

                proj.sections.forEach((sec) => {
                    if (sec.items.length > 0) {
                        const sectionClass = `llm-section-compact-${sec.type}`;
                        html += `<div class="llm-section-compact ${sectionClass}">
                            <h5 class="llm-section-title-compact">${escapeHtml(sec.title)}</h5>
                            <ul class="llm-section-list-compact">
                                ${sec.items.map(item => `<li>${item}</li>`).join("")}
                            </ul>
                        </div>`;
                    }
                });

                html += `</div></article>`;
            });
            html += '</div>';
        } else if (text.length > 100) {
            // Fallback: If no projects detected, try to format the raw text better
            console.warn("No projects detected, using fallback formatting");
            html += `<div class="llm-fallback-text">
                <div class="llm-text-formatted">${formatMarkdownText(text)}</div>
            </div>`;
        }

        // Guidelines section
        if (guidelines.length > 0) {
            html += `<div class="llm-guidelines-card-compact">
                <h4 class="llm-guidelines-title-compact">General Originality Guidelines</h4>
                <ul class="llm-guidelines-list-compact">
                    ${guidelines.map(item => {
                        const cleanItem = escapeHtml(item).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
                        return `<li>${cleanItem}</li>`;
                    }).join("")}
                </ul>
            </div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    function formatMarkdownText(text) {
        // Basic markdown formatting fallback
        let formatted = escapeHtml(text)
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
            .replace(/^####\s+(.+)$/gm, "<h4>$1</h4>")
            .replace(/^[\*\•\-]\s+(.+)$/gm, "<li>$1</li>")
            .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
            .replace(/\n\n/g, "</p><p>")
            .replace(/^(.+)$/gm, "<p>$1</p>");
        
        return formatted;
    }

    function initFacultyPage() {
        const session = ensureAuth({ redirect: false });
        if (!session) {
            setTimeout(() => {
                const recheck = ensureAuth({ redirect: false });
                if (!recheck) logout();
            }, 500);
            return;
        }

        const teamAnalyzeBtn = byId("project-analyze-btn");
        const approvalToggle = byId("approval-toggle");
        const approvalSubmit = byId("approval-submit");

        if (approvalToggle) approvalToggle.addEventListener("change", updateApprovalLabel);
        if (approvalSubmit) approvalSubmit.addEventListener("click", handleApprovalSubmit);
        if (teamAnalyzeBtn) teamAnalyzeBtn.addEventListener("click", handleProjectAnalysis);

        loadTeams();
    }

    document.addEventListener("DOMContentLoaded", initFacultyPage);
})();
