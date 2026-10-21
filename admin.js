/* ============================================================
   Hycenth Admin Panel
   Dashboard · Products CRUD · Site content · Account
   All data goes through HycenthStore / HycenthSettings /
   HycenthAuth (store.js) which enforce authorisation.
   ============================================================ */
(function () {
    "use strict";

    var Store = window.HycenthStore;
    var Settings = window.HycenthSettings;
    var Auth = window.HycenthAuth;

    /* ---------- helpers ---------- */
    function qs(sel, root) { return (root || document).querySelector(sel); }
    function qsa(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function money(n) { return "\u20A6" + Number(n || 0).toLocaleString("en-NG"); }
    /* short money for narrow spots (dashboard cards) — ₦10.5M, ₦125K */
    function moneyShort(n) {
        n = Number(n || 0);
        if (n >= 1000000) {
            var m = n / 1000000;
            return "\u20A6" + (m >= 10 ? Math.round(m) : Math.round(m * 10) / 10) + "M";
        }
        if (n >= 1000) {
            var k = n / 1000;
            return "\u20A6" + (k >= 100 ? Math.round(k) : Math.round(k * 10) / 10) + "K";
        }
        return "\u20A6" + n.toLocaleString("en-NG");
    }
    function fmtDate(ts) {
        if (!ts) return "—";
        try {
            return new Date(ts).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
        } catch (e) { return "—"; }
    }
    function kb(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(2) + " MB";
    }

    /* ---------- toast ---------- */
    var toastTimer;
    function toast(msg, isError) {
        var el = qs("#adminToast");
        if (!el) {
            el = document.createElement("div");
            el.id = "adminToast";
            el.className = "toast";
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.background = isError ? "#ff8a8a" : "";
        el.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2200);
    }

    /* ---------- modal ---------- */
    var modal = qs("#modal");
    var modalBox = qs("#modalBox");
    var modalBody = qs("#modalBody");

    function openModal(html, kind) {
        modalBox.className = "modal-box" + (kind ? " " + kind : "");
        modalBody.innerHTML = html;
        modal.classList.add("open");
    }
    function closeModal() {
        modal.classList.remove("open");
        modalBox.className = "modal-box";
        modalBody.innerHTML = "";
    }
    qs("#modalClose").onclick = closeModal;
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

    /* ---------- confirm dialog (promise) ---------- */
    function confirmDialog(opts) {
        return new Promise(function (resolve) {
            openModal(
                '<h3>' + esc(opts.title) + "</h3>" +
                '<p style="margin:.6rem 0 1.1rem">' + esc(opts.body) + "</p>" +
                '<div class="form-actions">' +
                '<button class="btn ghost" id="cfNo">Cancel</button>' +
                '<button class="btn solid' + (opts.danger ? " danger-line" : "") + '" id="cfYes">' +
                esc(opts.confirmText || "Confirm") + "</button>" +
                "</div>",
                "confirm"
            );
            qs("#cfNo").onclick = function () { closeModal(); resolve(false); };
            qs("#cfYes").onclick = function () { closeModal(); resolve(true); };
        });
    }

    /* ---------- loading button ---------- */
    function withLoading(btn, work) {
        var old = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>Please wait...';
        return Promise.resolve()
            .then(work)
            .then(function (res) {
                btn.disabled = false;
                btn.innerHTML = old;
                return res;
            }, function (err) {
                btn.disabled = false;
                btn.innerHTML = old;
                throw err;
            });
    }

    /* ============================================================
       AUTH VIEWS
       ============================================================ */
    var authView = qs("#authView");
    var adminApp = qs("#adminApp");
    var loginForm = qs("#loginForm");
    var setupForm = qs("#setupForm");
    var forgotForm = qs("#forgotForm");

    function showLogin(msg) {
        authView.classList.remove("hidden");
        adminApp.classList.add("hidden");
        loginForm.hidden = false;
        setupForm.hidden = true;
        forgotForm.hidden = true;
        stopOtpTimer();
        qs("#loginPass").type = "password";
        syncPwToggle();
        /* the email the owner signs in with is remembered on the account */
        qs("#loginEmail").value = Auth.email() || "";
        qs("#loginErr").textContent = msg || "";
    }
    function showSetup(msg) {
        authView.classList.remove("hidden");
        adminApp.classList.add("hidden");
        loginForm.hidden = true;
        setupForm.hidden = false;
        forgotForm.hidden = true;
        stopOtpTimer();
        qs("#setupErr").textContent = msg || "";
    }

    function showApp() {
        authView.classList.add("hidden");
        adminApp.classList.remove("hidden");
        qs("#topUser").textContent = (Auth.account() || {}).user || "admin";
        renderAll();
        go("dashboard");
    }

    loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = qs("#loginBtn");
        var user = qs("#loginUser").value;
        var pass = qs("#loginPass").value;
        var mail = qs("#loginEmail").value.trim();
        var previousMail = Auth.email();
        qs("#loginErr").textContent = "";

        if (!mail) {
            qs("#loginErr").textContent = "Please enter your email address.";
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
            qs("#loginErr").textContent = "Enter a valid email address.";
            return;
        }

        withLoading(btn, function () {
            /* the email is saved on the account — it is where the
               "Forgot password" one-time codes are sent */
            return Auth.login(user, pass, mail);
        }).then(function () {
            loginForm.reset();
            if (previousMail && previousMail !== mail.toLowerCase()) {
                toast("Sign-in email updated to " + mail);
            } else {
                toast("Signed in successfully");
            }
            showApp();
        }).catch(function (err) {
            qs("#loginErr").textContent = err.message || "Sign in failed.";
        });
    });

    setupForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = qs("#setupBtn");
        var user = qs("#setupUser").value;
        var pass = qs("#setupPass").value;
        var pass2 = qs("#setupPass2").value;
        qs("#setupErr").textContent = "";
        if (pass !== pass2) {
            qs("#setupErr").textContent = "Passwords do not match.";
            return;
        }
        var setupMail = qs("#setupEmail").value.trim();
        if (setupMail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(setupMail)) {
            qs("#setupErr").textContent = "Enter a valid recovery email or leave it blank.";
            return;
        }
        withLoading(btn, function () {
            return Auth.createAccount(user, pass, setupMail || null);
        }).then(function () {
            setupForm.reset();
            toast("Admin account created");
            showApp();
        }).catch(function (err) {
            qs("#setupErr").textContent = err.message || "Could not create the account.";
        });
    });

    function doLogout() {
        Auth.logout();
        qs("#loginPass").value = "";
        showLogin();
        toast("Logged out");
    }
    qs("#logoutBtn").onclick = doLogout;
    qs("#topLogout").onclick = doLogout;

    /* ============================================================
       FORGOTTEN PASSWORD
       email  ->  6-digit one-time code  ->  new password
       ============================================================ */
    var fpStep1 = qs("#fpStep1");
    var fpStep2 = qs("#fpStep2");
    var fpStep3 = qs("#fpStep3");
    var fpState = { email: "", code: "", mode: "" };
    var otpTimer = null;

    function stopOtpTimer() {
        if (otpTimer) { clearInterval(otpTimer); otpTimer = null; }
    }

    function showForgot(step) {
        authView.classList.remove("hidden");
        adminApp.classList.add("hidden");
        loginForm.hidden = true;
        setupForm.hidden = true;
        forgotForm.hidden = false;

        fpStep1.hidden = step !== 1;
        fpStep2.hidden = step !== 2;
        fpStep3.hidden = step !== 3;

        qs("#fpErr1").textContent = "";
        qs("#fpErr2").textContent = "";
        qs("#fpErr2b").textContent = "";
        qs("#fpErr3").textContent = "";

        if (step === 2) {
            startOtpTimer();
            setTimeout(function () { qs("#fpOtp").focus(); }, 60);
        } else {
            stopOtpTimer();
        }
        if (step === 3) {
            setTimeout(function () { qs("#fpNewPass").focus(); }, 60);
        }
    }

    /* countdown + (when no mail service is connected) the code itself */
    function startOtpTimer() {
        stopOtpTimer();
        var note = qs("#fpOtpNote");
        function tick() {
            var rec = Auth.otpRecord();
            if (!rec) {
                note.textContent = "This code has expired. Request a new one.";
                stopOtpTimer();
                return;
            }
            var left = Math.max(0, Math.ceil((rec.exp - Date.now()) / 1000));
            var mm = Math.floor(left / 60);
            var ss = left % 60;
            var tail = "Code expires in " + mm + ":" + (ss < 10 ? "0" : "") + ss + ".";
            note.textContent = fpState.mode === "inline"
                ? "Your code is " + fpState.code + " — " + tail
                : tail;
        }
        tick();
        otpTimer = setInterval(tick, 1000);
    }

    /* Hands the code to the visitor: auto-sent by email when an endpoint
       is configured, otherwise shown on screen and offered by mail app. */
    function deliverOtp(email, code) {
        var subject = "Hycenth Admin — password reset code";
        var text = "Your Hycenth admin one-time code is " + code +
            "\n\nIt expires in 5 minutes. If you did not request it, ignore this email.";
        var endpoint = Auth.otpEndpoint();

        if (endpoint) {
            return fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({
                    email: email,
                    subject: subject,
                    message: text,
                    code: code,
                    otp: code
                })
            }).then(function (res) {
                if (!res.ok) throw new Error("the service replied with " + res.status);
                return { mode: "sent", warn: "" };
            }).catch(function (err) {
                return {
                    mode: "inline",
                    warn: "Could not send the email automatically (" + err.message + "). Here is your code."
                };
            });
        }
        return Promise.resolve({ mode: "inline", warn: "" });
    }

    /* opens the visitor's mail app with the code ready to send */
    function mailOtp(email, code) {
        var subject = "Hycenth Admin — password reset code";
        var text = "Your Hycenth admin one-time code is " + code +
            "\n\nIt expires in 5 minutes. If you did not request it, ignore this email.";
        window.location.href = "mailto:" + encodeURIComponent(email) +
            "?subject=" + encodeURIComponent(subject) +
            "&body=" + encodeURIComponent(text);
    }

    /* ---------- step 1: email ---------- */
    qs("#fpSendBtn").addEventListener("click", function () {
        var btn = qs("#fpSendBtn");
        var email = qs("#fpEmail").value.trim().toLowerCase();
        qs("#fpErr1").textContent = "";

        if (!email) {
            qs("#fpErr1").textContent = "Please enter your recovery email.";
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            qs("#fpErr1").textContent = "Enter a valid email address.";
            return;
        }
        var acc = Auth.account() || {};
        if (acc.email && acc.email !== email) {
            qs("#fpErr1").textContent = "That email does not match the recovery email on this account.";
            return;
        }

        withLoading(btn, function () {
            var code = Auth.issueOtp(email);
            fpState.email = email;
            fpState.code = code;
            return deliverOtp(email, code);
        }).then(function (res) {
            fpState.mode = res.mode;
            showForgot(2);
            if (res.warn) {
                qs("#fpErr2").textContent = res.warn;
            }
            if (res.mode === "sent") {
                toast("Code sent to " + fpState.email);
            }
        }).catch(function (err) {
            qs("#fpErr1").textContent = err.message || "Could not send the code.";
        });
    });

    /* ---------- step 2: one-time code ---------- */
    qs("#fpVerifyBtn").addEventListener("click", function () {
        var btn = qs("#fpVerifyBtn");
        var code = qs("#fpOtp").value.replace(/\D/g, "");
        qs("#fpErr2").textContent = "";

        if (code.length !== 6) {
            qs("#fpErr2").textContent = "Enter the 6-digit code.";
            return;
        }
        withLoading(btn, function () {
            return Auth.verifyOtp(code);
        }).then(function () {
            var rec = Auth.otpRecord() || {};
            if (rec.email && !Auth.email()) Auth.setEmail(rec.email, false);
            showForgot(3);
        }).catch(function (err) {
            qs("#fpErr2").textContent = err.message || "Wrong code.";
        });
    });

    qs("#fpResendBtn").addEventListener("click", function () {
        var btn = qs("#fpResendBtn");
        qs("#fpErr2b").textContent = "";
        withLoading(btn, function () {
            var code = Auth.issueOtp(fpState.email);
            fpState.code = code;
            return deliverOtp(fpState.email, code);
        }).then(function (res) {
            fpState.mode = res.mode;
            qs("#fpOtp").value = "";
            startOtpTimer();
            if (res.warn) qs("#fpErr2b").textContent = res.warn;
            else toast("A new code was sent");
        }).catch(function (err) {
            qs("#fpErr2b").textContent = err.message || "Could not resend the code.";
        });
    });

    qs("#fpEditEmailBtn").addEventListener("click", function () {
        Auth.clearOtp();
        fpState.code = "";
        showForgot(1);
        setTimeout(function () { qs("#fpEmail").focus(); }, 60);
    });

    qs("#fpInboxBtn").addEventListener("click", function () {
        if (!fpState.code) {
            qs("#fpErr2b").textContent = "Request a code first.";
            return;
        }
        mailOtp(fpState.email, fpState.code);
    });

    /* ---------- step 3: new password ---------- */
    qs("#fpSaveBtn").addEventListener("click", function () {
        var btn = qs("#fpSaveBtn");
        var next = qs("#fpNewPass").value;
        var next2 = qs("#fpNewPass2").value;
        qs("#fpErr3").textContent = "";

        if (next.length < 6) {
            qs("#fpErr3").textContent = "Password must be at least 6 characters.";
            return;
        }
        if (next !== next2) {
            qs("#fpErr3").textContent = "Passwords do not match.";
            return;
        }
        withLoading(btn, function () {
            return Auth.resetPassword(next);
        }).then(function () {
            Auth.startSession();
            qs("#fpOtp").value = "";
            qs("#fpNewPass").value = "";
            qs("#fpNewPass2").value = "";
            fpState.code = "";
            toast("Password updated — you are signed in");
            showApp();
        }).catch(function (err) {
            qs("#fpErr3").textContent = err.message || "Could not update the password.";
        });
    });

    qs("#forgotBtn").addEventListener("click", function () {
        qs("#fpEmail").value = Auth.email() || "";
        showForgot(1);
        setTimeout(function () { qs("#fpEmail").focus(); }, 60);
    });

    qs("#fpBackBtn").addEventListener("click", function () {
        Auth.clearOtp();
        fpState.code = "";
        showLogin();
    });

    /* keep the code field numeric only */
    qs("#fpOtp").addEventListener("input", function (e) {
        e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
    });

    /* password visibility toggle (login) */
    function syncPwToggle() {
        var pi = qs("#loginPass");
        var pb = qs("#loginPassToggle");
        var shown = pi.type === "text";
        pb.textContent = shown ? "Hide" : "Show";
        pb.title = shown ? "Hide password" : "Show password";
        pb.setAttribute("aria-label", pb.title);
        pb.setAttribute("aria-pressed", shown ? "true" : "false");
    }

    qs("#loginPassToggle").addEventListener("click", function () {
        var pi = qs("#loginPass");
        pi.type = pi.type === "password" ? "text" : "password";
        syncPwToggle();
        pi.focus();
    });

    /* ============================================================
       NAVIGATION
       ============================================================ */
    var VIEW_TITLES = {
        dashboard: "Dashboard",
        products: "Products",
        content: "Site Content",
        whatsapp: "WhatsApp Tools",
        account: "Account & Data"
    };

    function go(view) {
        qsa(".aview").forEach(function (v) { v.classList.remove("active"); });
        var target = qs("#view-" + view);
        if (!target) view = "dashboard";
        qs("#view-" + view).classList.add("active");

        qsa(".side-link[data-view]").forEach(function (b) {
            b.classList.toggle("active", b.dataset.view === view);
        });
        qs("#viewTitle").textContent = VIEW_TITLES[view] || "Admin";
        closeSidebar();
        window.scrollTo({ top: 0, behavior: "smooth" });

        if (view === "dashboard") renderDashboard();
        if (view === "products") renderProducts();
        if (view === "content") fillContentForms();
        if (view === "whatsapp") renderWhatsApp();
        if (view === "account") renderAccount();
    }

    qsa(".side-link[data-view]").forEach(function (b) {
        b.addEventListener("click", function () { go(b.dataset.view); });
    });
    document.addEventListener("click", function (e) {
        var goto = e.target.closest("[data-goto]");
        if (goto) go(goto.dataset.goto);
    });

    /* mobile sidebar */
    var side = qs("#adminSide");
    var scrim = qs("#sideScrim");
    function openSidebar() { side.classList.add("open"); scrim.classList.add("show"); }
    function closeSidebar() { side.classList.remove("open"); scrim.classList.remove("show"); }
    qs("#adminMenu").onclick = openSidebar;
    qs("#sideClose").onclick = closeSidebar;
    scrim.onclick = closeSidebar;

    /* ============================================================
       DASHBOARD
       ============================================================ */
    function renderDashboard() {
        var s = Store.stats();
        qs("#navProductCount").textContent = s.total;

        qs("#statGrid").innerHTML = [
            statCard("Total Items", s.total, s.men + " men's · " + s.nurse + " nurse", true),
            statCard("Visible Items", s.visible, "Shown in the collection", false),
            statCard("Hidden Items", s.hidden, "Hidden from customers", false),
            statCard("Added This Week", s.recent, "New in the last 7 days", false),
            statCard("Catalog Value", moneyShort(s.value), "Sum of visible prices · " + money(s.value), false)
        ].join("");

        var newest = s.newest;
        qs("#recentList").innerHTML = newest.length ? newest.map(function (p) {
            return '<div class="recent-item">' +
                '<img src="' + esc(p.img) + '" alt="" loading="lazy">' +
                "<div><h4>" + esc(p.name) + '</h4><div class="meta">' +
                esc(fmtDate(p.createdAt)) + (p.visible === false ? " · hidden" : "") +
                "</div></div>" +
                '<span class="price">' + money(p.price) + "</span>" +
                "</div>";
        }).join("") : '<div class="empty">No products yet.</div>';

        var menPct = s.total ? Math.round((s.men / s.total) * 100) : 0;
        var nursePct = s.total ? 100 - menPct : 0;
        qs("#splitBars").innerHTML =
            splitRow("Men's Native", s.men, menPct, false) +
            splitRow("Nurses Wear", s.nurse, nursePct, true);
    }

    function statCard(label, value, sub, accent) {
        return '<div class="stat-card' + (accent ? " accent" : "") + '">' +
            '<div class="label">' + esc(label) + "</div>" +
            '<div class="value">' + esc(String(value)) + "</div>" +
            '<div class="sub">' + esc(sub) + "</div>" +
            "</div>";
    }
    function splitRow(name, count, pct, alt) {
        return '<div class="split-row">' +
            '<div class="split-top"><span>' + esc(name) + "</span><strong>" +
            count + " (" + pct + "%)</strong></div>" +
            '<div class="split-track"><div class="split-fill' + (alt ? " alt" : "") +
            '" style="width:' + pct + '%"></div></div></div>';
    }

    /* ============================================================
       PRODUCTS
       ============================================================ */
    var PAGE_SIZE = 10;
    var state = { search: "", cat: "all", status: "all", sort: "newest", page: 1 };

    function filteredProducts() {
        var list = Store.getProducts().slice();
        var q = state.search.toLowerCase();

        if (q) list = list.filter(function (p) { return p.name.toLowerCase().indexOf(q) !== -1; });
        if (state.cat !== "all") list = list.filter(function (p) { return p.cat === state.cat; });
        if (state.status === "visible") list = list.filter(function (p) { return p.visible !== false; });
        if (state.status === "hidden") list = list.filter(function (p) { return p.visible === false; });

        if (state.sort === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name); });
        else if (state.sort === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
        else if (state.sort === "price-desc") list.sort(function (a, b) { return b.price - a.price; });
        else if (state.sort === "oldest") list.sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
        else list.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

        return list;
    }

    function renderProducts() {
        var list = filteredProducts();
        var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        if (state.page > pages) state.page = pages;
        var start = (state.page - 1) * PAGE_SIZE;
        var shown = list.slice(start, start + PAGE_SIZE);

        qs("#pCount").textContent = list.length
            ? "Showing " + (start + 1) + "–" + (start + shown.length) + " of " + list.length + " products"
            : "";

        qs("#pEmpty").classList.toggle("hidden", shown.length > 0);

        qs("#pRows").innerHTML = shown.map(function (p) {
            var visible = p.visible !== false;
            return "<tr>" +
                '<td><div class="p-item">' +
                '<img src="' + esc(p.img) + '" alt="" loading="lazy">' +
                '<div><div class="pname">' + esc(p.name) + "</div>" +
                (p.desc ? '<div class="pdesc">' + esc(p.desc) + "</div>" : "") +
                "</div></div></td>" +
                '<td><span class="chip-mini ' + (p.cat === "men" ? "men" : "nurse") + '">' +
                (p.cat === "men" ? "Men" : "Nurses") + "</span></td>" +
                "<td>" + money(p.price) + "</td>" +
                "<td><span class=\"chip-mini " + (visible ? "on" : "off") + "\">" +
                (visible ? "Visible" : "Hidden") + "</span></td>" +
                "<td>" + fmtDate(p.updatedAt || p.createdAt) + "</td>" +
                '<td class="ta-r"><div class="row-actions">' +
                '<button class="icon-btn" data-act="toggle" data-id="' + p.id + '">' +
                (visible ? "Hide" : "Show") + "</button>" +
                '<button class="icon-btn" data-act="edit" data-id="' + p.id + '">Edit</button>' +
                '<button class="icon-btn del" data-act="del" data-id="' + p.id + '">Delete</button>' +
                "</div></td>" +
                "</tr>";
        }).join("");

        renderPager(pages);
        qs("#navProductCount").textContent = Store.getProducts().length;
    }

    function renderPager(pages) {
        var html = '<button ' + (state.page === 1 ? "disabled" : "") + ' data-page="' +
            (state.page - 1) + '">&larr;</button>';

        var from = Math.max(1, state.page - 2);
        var to = Math.min(pages, from + 4);
        from = Math.max(1, to - 4);

        for (var i = from; i <= to; i++) {
            html += '<button class="' + (i === state.page ? "current" : "") +
                '" data-page="' + i + '">' + i + "</button>";
        }
        html += '<button ' + (state.page === pages ? "disabled" : "") + ' data-page="' +
            (state.page + 1) + '">&rarr;</button>';
        html += '<span class="pager-info">Page ' + state.page + " of " + pages + "</span>";
        qs("#pPager").innerHTML = html;
    }

    qs("#pPager").addEventListener("click", function (e) {
        var b = e.target.closest("button[data-page]");
        if (!b || b.disabled) return;
        state.page = +b.dataset.page;
        renderProducts();
    });

    qs("#pSearch").addEventListener("input", function (e) {
        state.search = e.target.value.trim();
        state.page = 1;
        renderProducts();
    });
    qs("#pCat").addEventListener("change", function (e) {
        state.cat = e.target.value; state.page = 1; renderProducts();
    });
    qs("#pStatus").addEventListener("change", function (e) {
        state.status = e.target.value; state.page = 1; renderProducts();
    });
    qs("#pSort").addEventListener("change", function (e) {
        state.sort = e.target.value; state.page = 1; renderProducts();
    });

    /* row actions */
    qs("#pRows").addEventListener("click", function (e) {
        var btn = e.target.closest("[data-act]");
        if (!btn) return;
        var id = +btn.dataset.id;
        var act = btn.dataset.act;
        var product = Store.getProduct(id);
        if (!product) return;

        if (act === "toggle") {
            try {
                Store.setVisibility(id, product.visible === false);
                renderProducts();
                toast(product.visible === false ? "Item is now hidden" : "Item is now visible");
            } catch (err) { toast(err.message, true); }
        } else if (act === "edit") {
            openProductForm(product);
        } else if (act === "del") {
            confirmDialog({
                title: "Delete this item?",
                body: '"' + product.name + '" will be permanently removed from the store.',
                confirmText: "Delete",
                danger: true
            }).then(function (ok) {
                if (!ok) return;
                try {
                    Store.deleteProduct(id);
                    renderProducts();
                    renderDashboard();
                    toast("Item deleted");
                } catch (err) { toast(err.message, true); }
            });
        }
    });

    /* ============================================================
       PRODUCT FORM (add / edit)
       ============================================================ */
    function openProductForm(product) {
        var isEdit = !!product;
        var p = product || {
            name: "", cat: "men", price: "", img: "", tag: "",
            desc: "", visible: true
        };

        openModal(
            '<h3>' + (isEdit ? "Edit Product" : "Add New Product") + "</h3>" +
            '<form id="prodForm" class="cform" style="margin-top:1rem">' +
            '<img class="img-preview' + (p.img ? " show" : "") + '" id="pvImg" src="' +
            esc(p.img || "") + '" alt="">' +

            '<label class="field"><span>Product name *</span>' +
            '<input type="text" id="fName" maxlength="90" value="' + esc(p.name) + '" required>' +
            "</label>" +

            '<div class="frow">' +
            '<label class="field"><span>Category *</span>' +
            '<select id="fCat">' +
            '<option value="men"' + (p.cat === "men" ? " selected" : "") + ">Men's Native</option>" +
            '<option value="nurse"' + (p.cat === "nurse" ? " selected" : "") + ">Nurses Wear</option>" +
            "</select></label>" +
            '<label class="field"><span>Price (\u20A6) *</span>' +
            '<input type="number" id="fPrice" min="0" step="500" value="' + esc(p.price) + '" required>' +
            "</label></div>" +

            '<label class="field"><span>Image URL *</span>' +
            '<input type="url" id="fImg" value="' + esc(p.img) + '" placeholder="https://...">' +
            "</label>" +
            '<div class="upload-row">' +
            '<label class="upload">Upload image<input type="file" id="fFile" accept="image/*"></label>' +
            '<span class="up-note">JPG/PNG up to 300 KB — or paste a URL above.</span>' +
            "</div>" +

            '<div class="frow" style="margin-top:.9rem">' +
            '<label class="field"><span>Badge label</span>' +
            '<input type="text" id="fTag" maxlength="30" value="' + esc(p.tag) + '" placeholder="Men / Nurses"></label>' +
            '<label class="field"><span>Sort helper</span>' +
            '<input type="text" disabled value="' +
            (isEdit ? "Item #" + p.id : "Assigned automatically") + '"></label>' +
            "</div>" +

            '<label class="field"><span>Description</span>' +
            '<textarea id="fDesc" rows="3" maxlength="400">' + esc(p.desc || "") + "</textarea>" +
            '<span class="hint">Shown in the admin panel and available for future use on the site.</span>' +
            "</label>" +

            '<label class="switch"><input type="checkbox" id="fVisible"' +
            (p.visible !== false ? " checked" : "") + '><span class="track"></span>' +
            "Visible in the collection</label>" +

            '<p class="form-msg" id="fMsg"></p>' +
            '<div class="form-actions">' +
            '<button type="button" class="btn ghost" id="fCancel">Cancel</button>' +
            '<button type="submit" class="btn solid" id="fSave">' +
            (isEdit ? "Save Changes" : "Add Product") + "</button>" +
            "</div></form>",
            "form"
        );

        var urlInput = qs("#fImg");
        var preview = qs("#pvImg");

        urlInput.addEventListener("input", function () {
            var v = urlInput.value.trim();
            if (/^https?:\/\//i.test(v)) {
                preview.src = v;
                preview.classList.add("show");
            } else if (!v) {
                preview.classList.remove("show");
            }
        });

        qs("#fFile").addEventListener("change", function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            if (file.size > 300 * 1024) {
                qs("#fMsg").textContent = "Image is too large (max 300 KB). Use a smaller file or a URL.";
                qs("#fMsg").className = "form-msg err";
                e.target.value = "";
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                urlInput.value = reader.result;
                preview.src = reader.result;
                preview.classList.add("show");
                qs("#fMsg").textContent = "";
                qs("#fMsg").className = "form-msg";
            };
            reader.onerror = function () {
                qs("#fMsg").textContent = "Could not read that file.";
                qs("#fMsg").className = "form-msg err";
            };
            reader.readAsDataURL(file);
        });

        qs("#fCancel").onclick = closeModal;

        qs("#prodForm").addEventListener("submit", function (e) {
            e.preventDefault();
            var msg = qs("#fMsg");
            msg.className = "form-msg";

            var data = {
                name: qs("#fName").value,
                cat: qs("#fCat").value,
                price: qs("#fPrice").value,
                img: qs("#fImg").value,
                tag: qs("#fTag").value,
                desc: qs("#fDesc").value,
                visible: qs("#fVisible").checked
            };

            if (!data.name.trim()) {
                msg.textContent = "Please enter a product name.";
                msg.className = "form-msg err";
                return;
            }
            if (!(Number(data.price) >= 0) || data.price === "") {
                msg.textContent = "Please enter a valid price.";
                msg.className = "form-msg err";
                return;
            }
            if (!data.img.trim()) {
                msg.textContent = "Please add an image URL or upload an image.";
                msg.className = "form-msg err";
                return;
            }

            var btn = qs("#fSave");
            withLoading(btn, function () {
                return isEdit ? Store.updateProduct(p.id, data) : Store.addProduct(data);
            }).then(function () {
                closeModal();
                renderProducts();
                renderDashboard();
                toast(isEdit ? "Product updated" : "Product added");
            }).catch(function (err) {
                msg.textContent = err.message || "Could not save the product.";
                msg.className = "form-msg err";
            });
        });

        setTimeout(function () { var n = qs("#fName"); if (n) n.focus(); }, 60);
    }

    qs("#addProductBtn").onclick = function () { openProductForm(null); };
    qs("#qaAdd").onclick = function () { openProductForm(null); };

    /* ============================================================
       SITE CONTENT
       ============================================================ */
    var contentReady = false;

    function fillContentForms() {
        var s = Settings.get();

        qs("#heroEyebrow").value = s.hero.eyebrow;
        qs("#heroTitle").value = s.hero.title;
        qs("#heroAccent").value = s.hero.accent;
        qs("#heroText").value = s.hero.text;
        renderSlides(s.hero.slides);

        qs("#featList").innerHTML = s.features.map(function (f, i) {
            return '<div class="feat-row">' +
                '<label class="field"><span>Card ' + (i + 1) + ' title</span>' +
                '<input type="text" class="feat-title" maxlength="60" value="' + esc(f.title) + '"></label>' +
                '<label class="field"><span>Card ' + (i + 1) + ' text</span>' +
                '<input type="text" class="feat-text" maxlength="160" value="' + esc(f.text) + '"></label>' +
                "</div>";
        }).join("");

        qs("#cPhone").value = s.contact.phone;
        qs("#cWa").value = s.contact.whatsapp;
        qs("#cMail").value = s.contact.email;
        qs("#cLoc").value = s.contact.location;
        qs("#dFee").value = s.delivery.fee;
        qs("#dFree").value = s.delivery.freeOver;

        qs("#payBank").value = s.payment.bank;
        qs("#payNum").value = s.payment.number;
        qs("#payName").value = s.payment.name;

        contentReady = true;
    }

    function renderSlides(slides) {
        qs("#slideList").innerHTML = slides.map(function (sl, i) {
            return '<div class="slide-row" data-i="' + i + '">' +
                '<img src="' + esc(sl.src) + '" alt="" onerror="this.style.opacity=.3">' +
                '<div class="field"><span>Image URL</span>' +
                '<input type="url" class="slide-src" value="' + esc(sl.src) + '"></div>' +
                '<div class="field alt-field"><span>Alt text</span>' +
                '<input type="text" class="slide-alt" maxlength="160" value="' + esc(sl.alt || "") + '"></div>' +
                '<button type="button" class="slide-del" title="Remove image">&times;</button>' +
                "</div>";
        }).join("");
    }

    function collectSlides() {
        var out = [];
        qsa("#slideList .slide-row").forEach(function (row) {
            var src = qs(".slide-src", row).value.trim();
            var alt = qs(".slide-alt", row).value.trim();
            if (src) out.push({ src: src, alt: alt });
        });
        return out;
    }

    qs("#slideList").addEventListener("click", function (e) {
        var del = e.target.closest(".slide-del");
        if (!del) return;
        var rows = qsa("#slideList .slide-row");
        if (rows.length <= 1) {
            toast("Keep at least one slideshow image", true);
            return;
        }
        del.closest(".slide-row").remove();
    });

    qs("#addSlide").addEventListener("click", function () {
        var slides = collectSlides();
        if (slides.length >= 10) {
            toast("Maximum of 10 slideshow images", true);
            return;
        }
        slides.push({ src: "", alt: "" });
        renderSlides(slides);
        var rows = qsa("#slideList .slide-row");
        var last = rows[rows.length - 1];
        if (last) qs(".slide-src", last).focus();
    });

    function savedMsg(id, text) {
        var el = qs(id);
        el.textContent = text;
        el.className = "form-msg";
        setTimeout(function () { el.textContent = ""; }, 2500);
    }

    qs("#heroForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var slides = collectSlides();
        var valid = slides.filter(function (sl) {
            return /^https?:\/\//i.test(sl.src) || /^data:image\//i.test(sl.src);
        });
        if (!valid.length) {
            savedMsg("#heroMsg", "Add at least one valid image URL.");
            qs("#heroMsg").className = "form-msg err";
            return;
        }
        try {
            withLoading(e.submitter || qs('button[type="submit"]', e.target), function () {
                return Settings.update({
                    hero: {
                        eyebrow: qs("#heroEyebrow").value,
                        title: qs("#heroTitle").value,
                        accent: qs("#heroAccent").value,
                        text: qs("#heroText").value,
                        slides: valid
                    }
                });
            }).then(function () {
                renderSlides(valid);
                savedMsg("#heroMsg", "Hero saved ✓");
                toast("Hero section updated");
            }).catch(function (err) {
                qs("#heroMsg").textContent = err.message || "Could not save.";
                qs("#heroMsg").className = "form-msg err";
            });
        } catch (err) {
            qs("#heroMsg").textContent = err.message;
            qs("#heroMsg").className = "form-msg err";
        }
    });

    qs("#featForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var features = qsa("#featList .feat-row").map(function (row) {
            return {
                title: qs(".feat-title", row).value,
                text: qs(".feat-text", row).value
            };
        });
        try {
            Settings.update({ features: features });
            savedMsg("#featMsg", "Features saved ✓");
            toast("Feature cards updated");
        } catch (err) {
            qs("#featMsg").textContent = err.message;
            qs("#featMsg").className = "form-msg err";
        }
    });

    qs("#contactForm2").addEventListener("submit", function (e) {
        e.preventDefault();
        var wa = qs("#cWa").value.replace(/[^0-9]/g, "");
        if (!wa) {
            qs("#contactMsg").textContent = "WhatsApp number must contain digits only.";
            qs("#contactMsg").className = "form-msg err";
            return;
        }
        try {
            Settings.update({
                contact: {
                    phone: qs("#cPhone").value,
                    whatsapp: wa,
                    email: qs("#cMail").value,
                    location: qs("#cLoc").value
                },
                delivery: {
                    fee: Number(qs("#dFee").value) || 0,
                    freeOver: Number(qs("#dFree").value) || 0
                }
            });
            savedMsg("#contactMsg", "Saved ✓");
            toast("Contact & delivery updated");
        } catch (err) {
            qs("#contactMsg").textContent = err.message;
            qs("#contactMsg").className = "form-msg err";
        }
    });

    qs("#payForm").addEventListener("submit", function (e) {
        e.preventDefault();
        try {
            Settings.update({
                payment: {
                    bank: qs("#payBank").value,
                    number: qs("#payNum").value.replace(/[^0-9]/g, ""),
                    name: qs("#payName").value
                }
            });
            savedMsg("#payMsg", "Saved ✓");
            toast("Payment details updated");
        } catch (err) {
            qs("#payMsg").textContent = err.message;
            qs("#payMsg").className = "form-msg err";
        }
    });

    /* ============================================================
       WHATSAPP TOOLS
       Ready-made messages the owner copies into the WhatsApp chat.
       ============================================================ */
    function copyText(text, btn, label) {
        var fallback = function () {
            var ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.top = "-1000px";
            document.body.appendChild(ta);
            ta.select();
            var ok = false;
            try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
            document.body.removeChild(ta);
            return ok;
        };
        var done = function (ok) {
            if (btn) {
                var old = btn.innerHTML;
                btn.innerHTML = ok ? "Copied ✓" : "Copy failed";
                btn.classList.toggle("copied", ok);
                setTimeout(function () { btn.innerHTML = old; btn.classList.remove("copied"); }, 1800);
            }
            toast(ok ? (label || "Copied to clipboard") : "Could not copy — select the text and copy manually");
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(
                function () { done(true); },
                function () { done(fallback()); }
            );
        } else {
            done(fallback());
        }
    }

    /* "the chat is finished — now pay and send the receipt" */
    function buildPaymentRequest(amount, name) {
        var p = Settings.get().payment;
        var amt = Number(amount) || 0;
        var who = String(name || "").trim();
        var acct = "*Bank:* " + p.bank + "\n" +
            "*Account Number:* " + p.number + "\n" +
            "*Account Name:* " + p.name +
            (amt ? "\n*Amount to send:* " + money(amt) : "");
        return [
            "Hello" + (who ? " " + who : "") + ",",
            "Your order is ready. Please make the payment of " +
                (amt ? "*" + money(amt) + "*" : "the total amount") +
                " using the details below:",
            acct,
            "Once you have transferred, please send your *proof of payment (receipt)* to this chat as a DM so we can start tailoring your order right away.",
            "Thank you — we will confirm the payment and begin sewing."
        ].join("\n\n");
    }

    /* the owner asks for sizes in the chat */
    function buildMeasurementRequest() {
        return [
            "To make your outfit fit perfectly, please send me your measurements:",
            "1. *Chest* — around the fullest part\n" +
            "2. *Waist* — around the narrowest part\n" +
            "3. *Hip* — around the fullest part\n" +
            "4. *Shoulder* — shoulder to shoulder\n" +
            "5. *Sleeve length* — shoulder to wrist\n" +
            "6. *Body length* — shoulder to ankle (for agbada / kaftan)\n" +
            "7. *Neck* — around the base of the neck\n" +
            "8. *Height* and *weight*",
            "Please also send a clear photo of yourself, and a photo of the tape measure on each area. If you have a similar outfit that fits you well, a photo of it helps a lot.",
            "As soon as I have them I will start cutting and sewing immediately."
        ].join("\n\n");
    }

    /* reply that shows the customer exactly what they picked, image and all */
    var PRODUCT_HEAD = "Hello 👋\nHere are the pieces you picked:";
    function productEntry(p) {
        return "• *" + p.name + "* — " + money(p.price) + "\n" + p.img;
    }

    function renderWhatsApp() {
        var s = Settings.get();
        qs("#oIntro").value = s.order.intro;
        qs("#oImages").checked = s.order.includeImages !== false;
        qs("#oMeasure").checked = s.order.askMeasurements === true;

        if (!qs("#prText").value) qs("#prText").value = buildPaymentRequest(qs("#prAmount").value, qs("#prName").value);
        if (!qs("#mrText").value) qs("#mrText").value = buildMeasurementRequest();
        if (!qs("#prProductText").value) qs("#prProductText").value = PRODUCT_HEAD;

        renderPickResults(qs("#prSearch").value.trim());
    }

    function renderPickResults(term) {
        var t = String(term || "").toLowerCase();
        var list = Store.getProducts().filter(function (p) {
            if (p.visible === false) return false;
            return !t || p.name.toLowerCase().indexOf(t) > -1;
        }).slice(0, 40);

        qs("#prResults").innerHTML = list.length ? list.map(function (p) {
            return '<button type="button" class="pick-item" data-id="' + p.id + '">' +
                '<img src="' + esc(p.img) + '" alt="" loading="lazy">' +
                '<span>' + esc(p.name) + "</span>" +
                "<strong>" + money(p.price) + "</strong>" +
                "</button>";
        }).join("") : '<div class="pick-empty">No products match that search.</div>';
    }

    /* --- payment request --- */
    var prDirty = false;
    qs("#prText").addEventListener("input", function () { prDirty = true; });

    function refreshPayment() {
        if (prDirty) return;
        qs("#prText").value = buildPaymentRequest(qs("#prAmount").value, qs("#prName").value);
    }
    qs("#prAmount").addEventListener("input", refreshPayment);
    qs("#prName").addEventListener("input", refreshPayment);

    qs("#prReset").addEventListener("click", function () {
        prDirty = false;
        refreshPayment();
        toast("Payment request rebuilt");
    });
    qs("#prCopy").addEventListener("click", function () {
        copyText(qs("#prText").value, qs("#prCopy"), "Payment request copied");
    });

    /* --- measurement request --- */
    qs("#mrReset").addEventListener("click", function () {
        qs("#mrText").value = buildMeasurementRequest();
        toast("Measurement request rebuilt");
    });
    qs("#mrCopy").addEventListener("click", function () {
        copyText(qs("#mrText").value, qs("#mrCopy"), "Measurement request copied");
    });

    /* --- product reply --- */
    qs("#prSearch").addEventListener("input", function (e) {
        renderPickResults(e.target.value.trim());
    });

    qs("#prResults").addEventListener("click", function (e) {
        var btn = e.target.closest(".pick-item");
        if (!btn) return;
        var p = Store.getProduct(Number(btn.dataset.id));
        if (!p) return;
        var ta = qs("#prProductText");
        var current = ta.value.replace(/\s+$/, "");
        ta.value = current + (current === PRODUCT_HEAD ? "\n\n" : "\n\n") + productEntry(p);
        ta.scrollTop = ta.scrollHeight;
    });

    qs("#prpClear").addEventListener("click", function () {
        qs("#prProductText").value = PRODUCT_HEAD;
    });
    qs("#prpCopy").addEventListener("click", function () {
        copyText(qs("#prProductText").value, qs("#prpCopy"), "Reply copied");
    });

    /* --- order message settings --- */
    qs("#orderForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var msg = qs("#orderMsg");
        msg.className = "form-msg";
        try {
            Settings.update({
                order: {
                    intro: qs("#oIntro").value,
                    includeImages: qs("#oImages").checked,
                    askMeasurements: qs("#oMeasure").checked
                }
            });
            msg.textContent = "Saved ✓";
            toast("Order message settings updated");
        } catch (err) {
            msg.textContent = err.message || "Could not save.";
            msg.className = "form-msg err";
        }
    });

    /* ============================================================
       ACCOUNT & DATA
       ============================================================ */
    function renderAccount() {
        var acc = Auth.account() || {};
        var products = Store.getProducts();
        qs("#storageInfo").innerHTML =
            '<span class="storage-pill">Signed in as <strong>' + esc(acc.user || "admin") + "</strong></span>" +
            '<span class="storage-pill"><strong>' + products.length + "</strong> products saved</span>" +
            '<span class="storage-pill">Storage used <strong>' + kb(Store.usage()) + "</strong></span>" +
            (Auth.inMemoryFallback()
                ? '<span class="storage-pill" style="color:#ffb3b3">Persistent storage unavailable in this browser</span>'
                : "");

        qs("#recEmail").value = Auth.email();
        qs("#recEndpoint").value = Auth.otpEndpoint();
    }

    qs("#recForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var msg = qs("#recMsg");
        msg.className = "form-msg";
        try {
            Auth.setEmail(qs("#recEmail").value, true);
            Auth.setOtpEndpoint(qs("#recEndpoint").value);
            msg.textContent = "Recovery settings saved ✓";
            toast("Recovery settings updated");
        } catch (err) {
            msg.textContent = err.message || "Could not save the recovery settings.";
            msg.className = "form-msg err";
        }
    });

    qs("#pwForm").addEventListener("submit", function (e) {
        e.preventDefault();
        var cur = qs("#pwCurrent").value;
        var next = qs("#pwNew").value;
        var next2 = qs("#pwNew2").value;
        var msg = qs("#pwMsg");
        msg.className = "form-msg";

        if (next !== next2) {
            msg.textContent = "New passwords do not match.";
            msg.className = "form-msg err";
            return;
        }
        withLoading(qs('button[type="submit"]', e.target), function () {
            return Auth.changePassword(cur, next);
        }).then(function () {
            qs("#pwForm").reset();
            msg.textContent = "Password updated ✓";
            toast("Password changed");
        }).catch(function (err) {
            msg.textContent = err.message || "Could not update the password.";
            msg.className = "form-msg err";
        });
    });

    qs("#resetProducts").addEventListener("click", function () {
        confirmDialog({
            title: "Reset all products?",
            body: "Your product catalogue will be replaced with the original 150 items. Custom and edited items will be lost.",
            confirmText: "Reset products",
            danger: true
        }).then(function (ok) {
            if (!ok) return;
            try {
                Store.resetProducts();
                renderAccount();
                renderDashboard();
                toast("Products reset to defaults");
            } catch (err) { toast(err.message, true); }
        });
    });

    qs("#resetContent").addEventListener("click", function () {
        confirmDialog({
            title: "Reset site content?",
            body: "Hero, features, contact and payment details will return to their original values.",
            confirmText: "Reset content",
            danger: true
        }).then(function (ok) {
            if (!ok) return;
            try {
                Settings.reset();
                fillContentForms();
                toast("Site content reset to defaults");
            } catch (err) { toast(err.message, true); }
        });
    });

    /* ============================================================
       RENDER ALL / INIT
       ============================================================ */
    function renderAll() {
        renderDashboard();
        renderProducts();
        if (contentReady) fillContentForms();
    }

    /* boot */
    Auth.ensureDefault(); /* pre-seeded account, first run only */
    if (!Auth.hasAccount()) {
        showSetup();
    } else if (Auth.isLoggedIn()) {
        showApp();
    } else {
        showLogin();
    }

})();
