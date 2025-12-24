(() => {
    const portal = window.RVCEPortal;
    if (!portal) {
        console.error("RVCEPortal helpers not loaded");
        return;
    }

    const {
        ensureAuth,
        loadSession,
        logout,
        fetchProjectsSummary,
        searchTitles,
        analyzeSynopsis,
        fetchMyTeam,
        fetchMySearchHistory,
        saveSynopsis,
        formatNumber,
        formatPercent,
        formatDate,
        summarizeDomains,
    } = portal;

    const state = {
        autoOpenDetail: false,
        searchResults: [],
    };

    const els = {};

    function byId(id) {
        return (els[id] ??= document.getElementById(id));
    }

    function setText(element, value) {
        if (!element) return;
        element.textContent = value;
    }

    function setAlert(element, text, type = "info") {
        if (!element) return;
        if (!text) {
            element.hidden = true;
            element.textContent = "";
            element.className = "alert";
            return;
        }
        element.hidden = false;
        element.textContent = text;
        element.className = `alert ${type}`;
    }

    const modal = {
        backdrop: null,
        title: null,
        content: null,
    };

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function openModal(title, html) {
        if (!modal.backdrop) return;
        modal.title.textContent = title;
        modal.content.innerHTML = html;
        modal.backdrop.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        if (!modal.backdrop) return;
        modal.backdrop.classList.remove("active");
        document.body.style.overflow = "auto";
    }

    async function loadSummary() {
        const summaryStatus = byId("summary-status");
        const refreshBtn = byId("refresh-summary");
        setAlert(summaryStatus, "Loading repository snapshot...", "info");
        refreshBtn?.setAttribute("data-loading", "true");
        try {
            const data = await fetchProjectsSummary();
            renderSummary(data);
            setAlert(summaryStatus, "Metrics updated from MongoDB.", "success");
        } catch (err) {
            console.error(err);
            setAlert(summaryStatus, err.message || "Failed to fetch project summary.", "error");
        } finally {
            refreshBtn?.removeAttribute("data-loading");
        }
    }

    async function loadStudentInfo() {
        console.log("🔵 loadStudentInfo() called");
        const statusEl = byId("student-info-status");
        const refreshBtn = byId("refresh-student-info");
        
        console.log("Elements:", { statusEl, refreshBtn });
        
        if (!statusEl) {
            console.error("❌ student-info-status element not found");
            return;
        }
        
        if (!fetchMyTeam || !fetchMySearchHistory) {
            console.error("❌ API functions not available:", { fetchMyTeam, fetchMySearchHistory });
            setAlert(statusEl, "API functions not loaded. Check console.", "error");
            return;
        }
        
        setAlert(statusEl, "Loading student information...", "info");
        if (refreshBtn) refreshBtn.setAttribute("data-loading", "true");
        
        try {
            console.log("📡 Fetching student team and search history...");
            console.log("Calling fetchMyTeam...");
            const teamPromise = fetchMyTeam();
            console.log("Calling fetchMySearchHistory...");
            const historyPromise = fetchMySearchHistory(10);
            
            console.log("Waiting for promises...");
            const [teamData, historyData] = await Promise.all([
                teamPromise,
                historyPromise,
            ]);
            
            console.log("✅ Team data received:", teamData);
            console.log("✅ History data received:", historyData);
            
            renderTeamDetails(teamData);
            renderSearchHistory(historyData);
            setAlert(statusEl, "Student information updated.", "success");
        } catch (err) {
            console.error("❌ Error loading student info:", err);
            console.error("Error details:", {
                message: err.message,
                stack: err.stack,
                name: err.name
            });
            setAlert(statusEl, err.message || "Failed to fetch student information.", "error");
            renderTeamDetails({ team: null, projects: [], message: err.message || "Failed to load" });
            renderSearchHistory({ history: [], total: 0 });
        } finally {
            if (refreshBtn) refreshBtn.removeAttribute("data-loading");
        }
    }

    function renderTeamDetails(data) {
        const container = byId("team-details-container");
        if (!container) {
            console.warn("team-details-container not found");
            return;
        }

        if (!data || !data.team) {
            const message = data?.message || "No team assigned.";
            container.innerHTML = `
                <div class="empty-state">
                    <p>${escapeHtml(message)}</p>
                    ${data?.student ? `<p class="text-muted">USN: ${escapeHtml(data.student.usn || "Unknown")}</p>` : ""}
                </div>
            `;
            return;
        }

        const team = data.team;
        const projects = data.projects || [];
        const student = data.student || {};

        const approvalStatus = team.approved || "NILL";
        const approvalClass = approvalStatus === "APPROVED" ? "success" : approvalStatus === "NOT APPROVED" ? "error" : "info";
        const approvalText = approvalStatus === "APPROVED" ? "✓ Approved" : approvalStatus === "NOT APPROVED" ? "✗ Not Approved" : "⏳ Pending";

        container.innerHTML = `
            <div class="team-info">
                <div class="team-header">
                    <h4>${escapeHtml(team.t_name || team.team_id || "Unknown Team")}</h4>
                    <span class="badge ${approvalClass}">${approvalText}</span>
                </div>
                <ul class="list-compact">
                    <li><span>Team ID</span><span>${escapeHtml(team.team_id || "—")}</span></li>
                    <li><span>Faculty ID</span><span>${escapeHtml(team.fac_id || "—")}</span></li>
                    ${student.usn ? `<li><span>Your USN</span><span>${escapeHtml(student.usn)}</span></li>` : ""}
                    ${student.s_name ? `<li><span>Name</span><span>${escapeHtml(student.s_name)}</span></li>` : ""}
                    <li><span>Projects</span><span>${formatNumber(projects.length)}</span></li>
                </ul>
                ${projects.length > 0 ? `
                    <div class="team-projects">
                        <h5>Team Projects</h5>
                        <ul class="list-compact">
                            ${projects.slice(0, 5).map(p => `
                                <li>
                                    <span class="project-title">${escapeHtml(p.title || "Untitled")}</span>
                                    ${p.domain ? `<span class="domain-tag">${escapeHtml(p.domain)}</span>` : ""}
                                </li>
                            `).join("")}
                            ${projects.length > 5 ? `<li class="text-muted">... and ${projects.length - 5} more</li>` : ""}
                        </ul>
                    </div>
                ` : ""}
            </div>
        `;
    }

    function renderSearchHistory(data) {
        const container = byId("search-history-container");
        if (!container) {
            console.warn("search-history-container not found");
            return;
        }

        const history = data.history || [];
        const total = data.total || 0;

        if (!history.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No search history found.</p>
                    <p class="text-muted" style="margin-top: 8px;">Your search history will appear here after you perform searches.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="search-history-list">
                <p class="text-muted" style="margin-bottom: 1rem;">Showing ${total} recent search${total !== 1 ? "es" : ""}</p>
                <ul class="list-compact">
                    ${history.slice(0, 10).map(entry => {
                        const query = entry.query || "—";
                        const timestamp = entry.timestamp ? formatDate(entry.timestamp) : "—";
                        const project = entry.project;
                        const score = entry.score != null ? formatPercent(Number(entry.score) * 100) : "—";
                        
                        return `
                            <li class="search-history-item">
                                <div class="search-query">
                                    <strong>${escapeHtml(query)}</strong>
                                    ${project ? `<span class="domain-tag">${escapeHtml(project.title || entry.matched_pid || "—")}</span>` : ""}
                                </div>
                                <div class="search-meta">
                                    <span class="text-muted">${timestamp}</span>
                                    ${score !== "—" ? `<span class="score-badge">${score}</span>` : ""}
                                </div>
                            </li>
                        `;
                    }).join("")}
                </ul>
            </div>
        `;
    }

    function renderSummary(data) {
        const metrics = data ?? {};
        setText(byId("metric-total"), formatNumber(metrics.total_projects));
        setText(byId("metric-domains"), summarizeDomains(metrics.top_domains));
        const frequentTeams = Array.isArray(metrics.frequent_projects)
            ? metrics.frequent_projects.slice(0, 3).map((item) => item.team_id || "—").join(" · ")
            : "—";
        setText(byId("metric-teams"), frequentTeams || "—");

        const domainList = byId("domain-list");
        if (domainList) {
            domainList.innerHTML = (metrics.top_domains || [])
                .map(
                    (item) => `
                        <li>
                            <span>${escapeHtml(item.domain ?? "Unknown")}</span>
                            <span class="count">${formatNumber(item.count)}</span>
                        </li>
                    `,
                )
                .join("") || '<li class="empty">No domain data</li>';
        }

        const techList = byId("tech-list");
        if (techList) {
            techList.innerHTML = (metrics.top_tech_tags || [])
                .map(
                    ({ tech, count }) => `
                        <li><span class="tag">${escapeHtml(tech)}</span><span class="count">${formatNumber(count)}</span></li>
                    `,
                )
                .join("") || '<li class="empty">No tech stack insights</li>';
        }

        const yearBars = byId("year-bars");
        if (yearBars) {
            const distribution = metrics.year_distribution || [];
            const maxCount = Math.max(...distribution.map((item) => item.count || 0), 1);
            yearBars.innerHTML = distribution
                .map(({ year, count }) => {
                    const width = Math.max(8, Math.round((count / maxCount) * 100));
                    return `
                        <div class="bar-row">
                            <span>${escapeHtml(year ?? "Unknown")}</span>
                            <div class="bar" style="--w:${width}%;"><span>${formatNumber(count)}</span></div>
                        </div>
                    `;
                })
                .join("") || '<div class="empty-state">No year data available</div>';
        }

        const freqTable = byId("freq-table");
        if (freqTable) {
            const body = freqTable.querySelector("tbody");
            if (body) {
                body.innerHTML = (metrics.frequent_projects || [])
                    .map(
                        (item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${escapeHtml(item.title ?? "Untitled")}</td>
                                <td>${escapeHtml(item.domain ?? "—")}</td>
                                <td>${escapeHtml(item.team_id ?? "—")}</td>
                                <td>${formatNumber(item.occurrences)}</td>
                            </tr>
                        `,
                    )
                    .join("") || '<tr><td colspan="5"><div class="empty-state">No repeated titles detected.</div></td></tr>';
            }
        }
    }

    async function handleSearch(event) {
        event.preventDefault();
        const queryInput = byId("search-query");
        const topkInput = byId("search-topk");
        const status = byId("search-status");
        const button = byId("search-btn");

        const query = queryInput.value.trim();
        const top_k = Number(topkInput.value) || 5;

        if (!query) {
            setAlert(status, "Enter a project title or keywords.", "error");
            return;
        }

        button.disabled = true;
        button.setAttribute("data-loading", "true");
        setAlert(status, "Querying CHROMA-AUG-DB for semantic matches...", "info");

        try {
            const payload = await searchTitles({ query, top_k });
            const results = Array.isArray(payload?.results) ? payload.results : [];
            state.searchResults = results;
            renderSearchResults(results);
            if (!results.length) {
                setAlert(status, "No matches found for that query.", "error");
                return;
            }
            setAlert(status, `Showing ${results.length} match${results.length > 1 ? "es" : ""}.`, "success");
            if (state.autoOpenDetail) {
                openResultModal(results[0]);
            }
        } catch (err) {
            console.error(err);
            setAlert(status, err.message || "Search failed.", "error");
            renderSearchResults([]);
        } finally {
            button.disabled = false;
            button.removeAttribute("data-loading");
        }
    }

    function renderSearchResults(results) {
        const table = byId("search-table");
        const body = table?.querySelector("tbody");
        if (!body) return;
        if (!results.length) {
            body.innerHTML = '<tr><td colspan="9"><div class="empty-state">No results. Adjust your keywords and retry.</div></td></tr>';
            return;
        }

        body.innerHTML = results
            .map((item, index) => {
                const scores = item.field_scores || {};
                const overallScore = Number(item.final_similarity ?? 0);
                // Handle both percentage and decimal formats
                const overallPercent = overallScore > 1 ? overallScore : overallScore * 100;
                return `
                    <tr data-index="${index}">
                        <td><strong>${index + 1}</strong></td>
                        <td class="title-cell">${escapeHtml(item.title ?? "Untitled")}</td>
                        <td><span class="domain-tag">${escapeHtml(item.domain ?? "—")}</span></td>
                        <td><strong class="score-overall">${formatPercent(overallPercent)}</strong></td>
                        <td>${formatPercent(Number(scores.title ?? 0))}</td>
                        <td>${formatPercent(Number(scores.description ?? 0))}</td>
                        <td>${formatPercent(Number(scores.tech_stack ?? 0))}</td>
                        <td>${formatPercent(Number(scores.objective ?? 0))}</td>
                        <td><button class="secondary small" type="button" data-detail="${index}">View</button></td>
                    </tr>
                `;
            })
            .join("");

        body.querySelectorAll("button[data-detail]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const idx = Number(btn.dataset.detail);
                const record = state.searchResults[idx];
                if (record) {
                    openResultModal(record);
                }
            });
        });
    }

    function openResultModal(record) {
        if (!record) return;
        const scores = record.field_scores || {};
        const detailHtml = `
            <section class="detail-grid">
                <div>
                    <h4>Metadata</h4>
                    <ul class="list-compact">
                        <li><span>ID</span><span>${escapeHtml(record.project_id ?? "—")}</span></li>
                        <li><span>Domain</span><span>${escapeHtml(record.domain ?? "—")}</span></li>
                        <li><span>Tech stack</span><span>${escapeHtml(record.tech_stack ?? "—")}</span></li>
                        <li><span>Objective</span><span>${escapeHtml(record.objective ?? "—")}</span></li>
                    </ul>
                </div>
                <div>
                    <h4>Similarity metrics</h4>
                    <ul class="list-compact">
                        <li><span>Overall</span><span>${formatPercent(Number(record.final_similarity ?? record.whole_similarity ?? 0))}</span></li>
                        <li><span>Title</span><span>${formatPercent(Number(scores.title ?? 0))}</span></li>
                        <li><span>Description</span><span>${formatPercent(Number(scores.description ?? 0))}</span></li>
                        <li><span>Tech stack</span><span>${formatPercent(Number(scores.tech_stack ?? 0))}</span></li>
                        <li><span>Objective</span><span>${formatPercent(Number(scores.objective ?? 0))}</span></li>
                    </ul>
                </div>
            </section>
            ${record.snippet ? `<section><h4>Snippet</h4><p>${escapeHtml(record.snippet)}</p></section>` : ""}
        `;
        openModal(record.title ?? "Project detail", detailHtml);
    }

    async function extractTextFromPDF(file) {
        return new Promise((resolve, reject) => {
            if (!window.pdfjsLib) {
                reject(new Error("PDF.js library not loaded. Please refresh the page."));
                return;
            }

            // Configure PDF.js worker if needed
            if (window.pdfjsLib.GlobalWorkerOptions) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            }

            const fileReader = new FileReader();
            fileReader.onload = async function(event) {
                try {
                    const typedArray = new Uint8Array(event.target.result);
                    const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;
                    let fullText = "";

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map(item => item.str).join(" ");
                        fullText += pageText + "\n";
                    }

                    resolve(fullText.trim());
                } catch (err) {
                    reject(new Error(`Failed to extract text from PDF: ${err.message}`));
                }
            };

            fileReader.onerror = () => reject(new Error("Failed to read PDF file"));
            fileReader.readAsArrayBuffer(file);
        });
    }

    async function handleSynopsis(event) {
        event.preventDefault();
        const form = event.target;
        const status = byId("synopsis-status");
        const button = byId("submit-synopsis-btn");
        const pdfFileInput = byId("syn-pdf-file");
        const descriptionTextarea = byId("syn-description");
        const pdfFileInfo = byId("pdf-file-info");
        const titleInput = byId("syn-title");
        const domainInput = byId("syn-domain");
        const techInput = byId("syn-tech");
        const objectiveInput = byId("syn-objective");

        let descriptionText = "";

        // Check if PDF file is selected
        if (pdfFileInput && pdfFileInput.files && pdfFileInput.files.length > 0) {
            const file = pdfFileInput.files[0];
            if (file.type !== "application/pdf") {
                setAlert(status, "Please select a valid PDF file.", "error");
                return;
            }

            button.disabled = true;
            button.setAttribute("data-loading", "true");
            setAlert(status, "Extracting text from PDF...", "info");

            try {
                descriptionText = await extractTextFromPDF(file);
                if (!descriptionText.trim()) {
                    setAlert(status, "No text could be extracted from the PDF. Please try another file or enter text manually.", "error");
                    button.disabled = false;
                    button.removeAttribute("data-loading");
                    return;
                }
                // Populate textarea with extracted text
                descriptionTextarea.value = descriptionText;
                setAlert(status, "Text extracted from PDF successfully.", "success");
            } catch (err) {
                console.error(err);
                setAlert(status, err.message || "Failed to extract text from PDF.", "error");
                button.disabled = false;
                button.removeAttribute("data-loading");
                return;
            }
        } else {
            // Use manual text input
            descriptionText = descriptionTextarea.value.trim();
        }

        // Get all form field values
        const title = titleInput ? titleInput.value.trim() : "";
        const domain = domainInput ? domainInput.value.trim() : "";
        const techStack = techInput ? techInput.value.trim() : "";
        const objective = objectiveInput ? objectiveInput.value.trim() : "";

        // Validate required fields
        if (!title) {
            setAlert(status, "Title is required.", "error");
            if (button.hasAttribute("data-loading")) {
                button.disabled = false;
                button.removeAttribute("data-loading");
            }
            return;
        }
        if (!domain) {
            setAlert(status, "Domain is required.", "error");
            if (button.hasAttribute("data-loading")) {
                button.disabled = false;
                button.removeAttribute("data-loading");
            }
            return;
        }
        if (!techStack) {
            setAlert(status, "Tech Stack is required.", "error");
            if (button.hasAttribute("data-loading")) {
                button.disabled = false;
                button.removeAttribute("data-loading");
            }
            return;
        }
        if (!objective) {
            setAlert(status, "Objective is required.", "error");
            if (button.hasAttribute("data-loading")) {
                button.disabled = false;
                button.removeAttribute("data-loading");
            }
            return;
        }
        if (!descriptionText) {
            setAlert(status, "Description is required. Please enter synopsis text or upload a PDF file.", "error");
            if (button.hasAttribute("data-loading")) {
                button.disabled = false;
                button.removeAttribute("data-loading");
            }
            return;
        }

        // Prepare payload with all fields
        const payload = {
            title: title,
            domain: domain,
            tech_stack: techStack,
            objective: objective,
            description: descriptionText,
        };

        button.disabled = true;
        button.setAttribute("data-loading", "true");
        setAlert(status, "Saving synopsis...", "info");

        try {
            await saveSynopsis(payload);
            setAlert(status, "Synopsis saved successfully!", "success");
            form.reset();
            pdfFileInfo.hidden = true;
        } catch (err) {
            console.error(err);
            setAlert(status, err.message || "Failed to save synopsis.", "error");
        } finally {
            button.disabled = false;
            button.removeAttribute("data-loading");
        }
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

    function parseLLMAnalysis(text) {
        if (!text) {
            return { cards: [], legacy: null };
        }

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

    function parseHeadingBasedCards(text) {
        if (!text) return [];
        
        const cards = [];
        const sections = text.split(/(?=^#{1,6}\s+[^\n]+|^[A-Z][^\n:]{3,50}:)/m);
        
        for (const section of sections) {
            const trimmed = section.trim();
            if (!trimmed || trimmed.length < 20) continue;
            
            // Extract title from heading or first line
            const headingMatch = trimmed.match(/^(?:#{1,6}\s+)?([^\n:]{3,60}):?\s*\n/);
            const titleMatch = trimmed.match(/^(?:###?\s+)?([^\n]+?)(?:\n|$)/);
            const title = headingMatch ? headingMatch[1].trim() : (titleMatch ? titleMatch[1].trim() : "Analysis Section");
            
            // Extract content lines
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
        if (!text) {
            return null;
        }

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

    function formatCardLine(line) {
        if (!line) return "";
        let cleaned = line.replace(/^[•*\-\s│]+/, "").trim();
        if (!cleaned) return "";
        
        // Handle label:value format
        const colonIndex = cleaned.indexOf(":");
        if (colonIndex > 0 && colonIndex < 50) {
            const label = cleaned.slice(0, colonIndex).trim();
            const rest = cleaned.slice(colonIndex + 1).trim();
            if (rest && label.length < 40) {
                return `<span class="card-line-label">${escapeHtml(label)}:</span> <span class="card-line-value">${escapeHtml(rest)}</span>`;
            }
        }
        
        // If no colon or label too long, just return as is
        return `<span class="card-line-value">${escapeHtml(cleaned)}</span>`;
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
    
    function extractWhyFlagged(text) {
        const patterns = [
            /Why\s+(?:It\s+Was\s+)?Flagged\s+as\s+Similar[\s\S]*?\n([\s\S]*?)(?=Exact\s+Matching|Uniqueness|$)/i,
            /Why\s+Flagged[\s\S]*?\n([\s\S]*?)(?=Exact|Uniqueness|$)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return extractBulletPoints(match[1]);
            }
        }
        return null;
    }
    
    function extractExactMatching(text) {
        const patterns = [
            /Exact\s+Matching\s+Components[\s\S]*?\n([\s\S]*?)(?=Uniqueness|$)/i,
            /Matching\s+Components[\s\S]*?\n([\s\S]*?)(?=Uniqueness|$)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return extractBulletPoints(match[1]);
            }
        }
        return [];
    }
    
    function extractSuggestions(text) {
        const patterns = [
            /Uniqueness\s+(?:Enhancement\s+)?(?:Suggestions|Improvement)[\s\S]*?\n([\s\S]*?)(?=###|##|$)/i,
            /Improvement[\s\S]*?\n([\s\S]*?)(?=###|##|$)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return extractBulletPoints(match[1]);
            }
        }
        return [];
    }
    
    function extractBulletPoints(text) {
        if (!text) return [];
        
        return text
            .split(/\n/)
            .map(line => {
                line = line.trim();
                // Remove markdown bullets and numbering
                line = line.replace(/^[\d\.\)\-\*•]\s*/, '');
                // Remove bold/italic
                line = line.replace(/\*\*(.+?)\*\*/g, '$1');
                line = line.replace(/\*(.+?)\*/g, '$1');
                // Remove leading dashes or colons
                line = line.replace(/^[-:]\s*/, '');
                return line;
            })
            .filter(line => line.length > 5 && !line.match(/^#{1,6}\s/));
    }
    

    function renderAnalysis(result) {
        const body = byId("analysis-body");
        if (!body) return;
        
        const rows = (result.results || [])
            .map((item, index) => {
                const scores = item.field_scores || {};
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td class="title-cell">${escapeHtml(item.title ?? "Untitled")}</td>
                        <td>${escapeHtml(item.domain ?? "—")}</td>
                        <td><strong>${formatPercent(Number(item.final_similarity ?? 0))}</strong></td>
                        <td>${formatPercent(Number(scores.title ?? 0))}</td>
                        <td>${formatPercent(Number(scores.description ?? 0))}</td>
                        <td>${formatPercent(Number(scores.tech_stack ?? 0))}</td>
                        <td>${formatPercent(Number(scores.objective ?? 0))}</td>
                    </tr>
                `;
            })
            .join("");

        // Parse and structure LLM analysis
        let llmBlock = "";
        if (result.llm_analysis) {
            const analysis = parseLLMAnalysis(result.llm_analysis);
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
                                ${escapeHtml(result.llm_analysis).replace(/\n/g, '<br>')}
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
                            ${escapeHtml(result.llm_analysis).replace(/\n/g, '<br>')}
                        </div>
                    </section>
                `;
            }
        }

        body.innerHTML = `
            <section class="similar-projects-section">
                <div class="section-header tight">
                    <h4>Top Similar Projects</h4>
                    <span class="text-muted">${result.retrieved || 0} projects found</span>
                </div>
                <div class="table-wrapper">
                <table class="table dense">
                    <thead>
                        <tr>
                            <th>#</th>
                                <th>Project Title</th>
                            <th>Domain</th>
                            <th>Overall</th>
                            <th>Title</th>
                            <th>Desc</th>
                            <th>Tech</th>
                            <th>Objective</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="8"><div class="empty-state">No similar projects returned.</div></td></tr>'}
                    </tbody>
                </table>
                </div>
            </section>
            ${llmBlock}
        `;
    }

    function initModal() {
        modal.backdrop = document.getElementById("modal-backdrop");
        modal.title = document.getElementById("modal-title");
        modal.content = document.getElementById("modal-content");
        const closeButton = document.getElementById("modal-close");
        closeButton?.addEventListener("click", closeModal);
        modal.backdrop?.addEventListener("click", (event) => {
            if (event.target === modal.backdrop) {
                closeModal();
            }
        });
    }

    function initPage() {
        // Check session - if no session, redirect to login
        const session = ensureAuth({ redirect: false });
        if (!session) {
            // Wait a bit to ensure page is stable, then redirect
            setTimeout(() => {
                // Double-check to avoid race conditions
                const recheckSession = ensureAuth({ redirect: false });
                if (!recheckSession) {
                    logout();
                }
            }, 500);
            return;
        }

        const resolvedSession = loadSession();
        const userPill = byId("user-pill");
        if (userPill && resolvedSession) {
            const email = resolvedSession.email ?? "";
            const username = email.split("@")[0] ?? "user";
            const domain = email.split("@")[1] ?? "";
            
            // Show username and domain securely (don't expose full email directly)
            const displayName = domain ? `${username}@${domain.split(".")[0]}` : username;
            userPill.textContent = displayName;
            userPill.title = `Authenticated via JWT · ${email}`;
            
            // Update auth badge if session is valid
            const authBadge = document.querySelector(".auth-badge");
            if (authBadge && resolvedSession.token) {
                const expiresAt = resolvedSession.expiresAt ? new Date(resolvedSession.expiresAt) : null;
                if (expiresAt && expiresAt > new Date()) {
                    const timeLeft = Math.floor((expiresAt - new Date()) / (1000 * 60));
                    authBadge.title = `JWT Token Authenticated · Expires in ${timeLeft} minutes`;
                } else {
                    authBadge.title = "JWT Token Authenticated";
                }
            }
        }

        byId("logout-btn")?.addEventListener("click", () => logout());

        initModal();
        loadSummary();
        byId("refresh-summary")?.addEventListener("click", loadSummary);
        
        // Only load student info if we're on the student page
        const studentInfoSection = byId("student-info-section");
        console.log("🔍 Checking for student info section...", studentInfoSection);
        console.log("🔍 Window location:", window.location.pathname);
        console.log("🔍 Available portal functions:", Object.keys(portal || {}));
        
        if (studentInfoSection) {
            console.log("✅ Student info section found, loading data...");
            console.log("🔍 fetchMyTeam type:", typeof fetchMyTeam);
            console.log("🔍 fetchMySearchHistory type:", typeof fetchMySearchHistory);
            
            // Call immediately with error handling
            setTimeout(() => {
                console.log("🚀 Calling loadStudentInfo after timeout...");
                loadStudentInfo().catch(err => {
                    console.error("❌ Failed to load student info:", err);
                });
            }, 100); // Small delay to ensure DOM is ready
            
            byId("refresh-student-info")?.addEventListener("click", () => {
                console.log("🔄 Refresh button clicked");
                loadStudentInfo();
            });
        } else {
            console.log("❌ Student info section not found (probably teacher page)");
            console.log("🔍 Available elements:", {
                studentInfoSection: byId("student-info-section"),
                studentInfoStatus: byId("student-info-status"),
                teamDetails: byId("team-details-container"),
                searchHistory: byId("search-history-container")
            });
        }

        const toggleAnalyze = byId("toggle-analyze");
        if (toggleAnalyze) {
            toggleAnalyze.addEventListener("change", (event) => {
                state.autoOpenDetail = Boolean(event.target.checked);
            });
        }

        byId("search-form")?.addEventListener("submit", handleSearch);
        byId("synopsis-form")?.addEventListener("submit", handleSynopsis);
        
        // Handle PDF file input
        const pdfFileInput = byId("syn-pdf-file");
        const pdfFileInfo = byId("pdf-file-info");
        const descriptionTextarea = byId("syn-description");
        
        if (pdfFileInput) {
            pdfFileInput.addEventListener("change", (event) => {
                const file = event.target.files[0];
                if (file) {
                    pdfFileInfo.hidden = false;
                    pdfFileInfo.innerHTML = `
                        <span class="file-name">📄 ${escapeHtml(file.name)}</span>
                        <span class="file-size">(${(file.size / 1024).toFixed(2)} KB)</span>
                    `;
                    // Clear textarea when PDF is selected
                    descriptionTextarea.value = "";
                } else {
                    pdfFileInfo.hidden = true;
                }
            });
        }

        // Handle clear button
        byId("clear-synopsis")?.addEventListener("click", () => {
            const titleInput = byId("syn-title");
            const domainInput = byId("syn-domain");
            const techInput = byId("syn-tech");
            const objectiveInput = byId("syn-objective");
            
            if (titleInput) titleInput.value = "";
            if (domainInput) domainInput.value = "";
            if (techInput) techInput.value = "";
            if (objectiveInput) objectiveInput.value = "";
            if (descriptionTextarea) descriptionTextarea.value = "";
            if (pdfFileInput) pdfFileInput.value = "";
            if (pdfFileInfo) pdfFileInfo.hidden = true;
            setAlert(byId("synopsis-status"), "Form cleared.", "info");
        });
    }

    // Run on DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPage);
    } else {
        // DOM already loaded
        console.log("📄 DOM already loaded, calling initPage immediately");
        initPage();
    }
    
    // Also try after a short delay as fallback
    setTimeout(() => {
        console.log("🔄 Fallback check after 1 second...");
        const studentInfoSection = byId("student-info-section");
        console.log("Fallback - studentInfoSection:", studentInfoSection);
        console.log("Fallback - loadStudentInfo type:", typeof loadStudentInfo);
        if (studentInfoSection && typeof loadStudentInfo === "function") {
            console.log("🔄 Fallback: Checking student info section again...");
            const statusEl = byId("student-info-status");
            const hasContent = statusEl && (statusEl.textContent.includes("updated") || statusEl.textContent.includes("Loading") || statusEl.textContent.includes("error"));
            console.log("Fallback - statusEl:", statusEl, "hasContent:", hasContent);
            if (statusEl && !hasContent) {
                console.log("🔄 Fallback: Loading student info because no content yet...");
                loadStudentInfo().catch(err => console.error("Fallback error:", err));
            } else if (!statusEl) {
                console.log("⚠️ Fallback: statusEl not found, but section exists. Loading anyway...");
                loadStudentInfo().catch(err => console.error("Fallback error:", err));
            }
        }
    }, 1500);
})();
