/* Product catalog + site settings come from the shared data store
   (store.js) so the admin panel can manage them. Both are re-read
   whenever the admin saves, so the page always shows the newest
   version of the catalogue and the site content. */
let products = HycenthStore.getProducts();
let siteSettings = HycenthSettings.get();

let DELIVERY = siteSettings.delivery.fee;
let FREE_OVER = siteSettings.delivery.freeOver;
const money = n => "\u20A6" + n.toLocaleString("en-NG");

const ACCOUNT = Object.assign({}, siteSettings.payment);

let cart = {};
try { cart = JSON.parse(localStorage.getItem("hycenth_cart")) || {}; } catch (e) { cart = {}; }
const save = () => localStorage.setItem("hycenth_cart", JSON.stringify(cart));
const find = id => products.find(p => p.id === id);

/* ---------- RENDER COLLECTION ---------- */
const PAGE_SIZE = 24;
let currentFilter = "all";
let currentSort = "featured";
let currentSearch = "";
let visibleCount = PAGE_SIZE;

function getVisibleProducts() {
    let list = products.filter(p =>
        p.visible !== false &&
        (currentFilter === "all" || p.cat === currentFilter) &&
        (!currentSearch || p.name.toLowerCase().includes(currentSearch))
    );

    if (currentSort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (currentSort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (currentSort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    return list;
}

function renderGrid() {
    const grid = document.getElementById("productGrid");
    const list = getVisibleProducts();
    const shown = list.slice(0, visibleCount);

    grid.innerHTML = shown.map(p => `
        <div class="card" data-id="${p.id}">
            <div class="card-img">
                <span class="tag">${p.tag}</span>
                <img src="${p.img}" alt="${p.name}" loading="lazy">
            </div>
            <div class="card-body">
                <h3>${p.name}</h3>
                <span class="price">${money(p.price)}</span>
                <button class="btn solid">Add to Cart</button>
            </div>
        </div>`).join("");

    document.getElementById("productCount").textContent =
        list.length ? `Showing ${shown.length} of ${list.length} products` : "No products match your search";

    const loadMore = document.getElementById("loadMoreBtn");
    loadMore.classList.toggle("hidden", shown.length >= list.length);
}

/* ---------- CART ---------- */
function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    save();
    renderCart();
    updateBadge();
    toast(`${find(id).name} added to cart`);

    const card = document.querySelector(`.card[data-id="${id}"]`);
    if (card) {
        card.classList.remove("stitched-flash");
        void card.offsetWidth;
        card.classList.add("stitched-flash");
        setTimeout(() => card.classList.remove("stitched-flash"), 750);
    }
}

function changeQty(id, delta) {
    cart[id] = (cart[id] || 0) + delta;
    if (cart[id] <= 0) delete cart[id];
    save();
    renderCart();
    updateBadge();
}

function removeItem(id) {
    delete cart[id];
    save();
    renderCart();
    updateBadge();
}

function totals() {
    let count = 0, sub = 0;
    Object.keys(cart).forEach(id => {
        const p = find(+id);
        if (!p) return;
        count += cart[id];
        sub += p.price * cart[id];
    });
    const del = count === 0 ? 0 : (sub >= FREE_OVER ? 0 : DELIVERY);
    return { count, sub, del, total: sub + del };
}

function renderCart() {
    const box = document.getElementById("cartItems");
    const ids = Object.keys(cart);

    if (!ids.length) {
        box.innerHTML = `<div class="empty">Your cart is empty. <br>Head to the Collection to start shopping.</div>`;
    } else {
        box.innerHTML = ids.map(id => {
            const p = find(+id);
            if (!p) return "";
            return `
                <div class="cart-item">
                    <img src="${p.img}" alt="${p.name}">
                    <div>
                        <h4>${p.name}</h4>
                        <span class="unit">${money(p.price)} each</span><br>
                        <span class="sub">${money(p.price * cart[id])}</span>
                    </div>
                    <div>
                        <div class="qty">
                            <button onclick="changeQty(${p.id}, -1)">&minus;</button>
                            <span>${cart[id]}</span>
                            <button onclick="changeQty(${p.id}, 1)">+</button>
                        </div>
                        <button class="remove" onclick="removeItem(${p.id})">Remove</button>
                    </div>
                </div>`;
        }).join("");
    }

    const t = totals();
    document.getElementById("sumCount").textContent = t.count;
    document.getElementById("sumSub").textContent = money(t.sub);
    document.getElementById("sumDel").textContent = money(t.del);
    document.getElementById("sumTotal").textContent = money(t.total);
}

function updateBadge() {
    const badge = document.getElementById("cartBadge");
    badge.textContent = totals().count;
    badge.classList.remove("pop");
    void badge.offsetWidth;
    badge.classList.add("pop");
}

/* ---------- PAYMENT ---------- */

/* wa.me only accepts digits — strip "+", spaces and dashes from the
   number saved in the admin panel. */
function waNumber() {
    const raw = String(
        siteSettings.contact.whatsapp || siteSettings.contact.phone || ""
    ).replace(/\D/g, "");
    return raw || String(HycenthDefaults.contact.whatsapp).replace(/\D/g, "");
}

/* The lines the visitor actually bought, in cart order. */
function orderLines() {
    return Object.keys(cart).map(id => {
        const p = find(+id);
        if (!p) return null;
        return {
            name: p.name,
            price: p.price,
            qty: cart[id],
            line: p.price * cart[id],
            img: p.img
        };
    }).filter(Boolean);
}

/* Plain-text order message that lands in the owner's WhatsApp chat.
   WhatsApp renders *text* as bold. */
function buildOrderMessage(lines, t, method) {
    const opts = siteSettings.order || {};

    const items = lines.map((l, i) => {
        let row = `${i + 1}. *${l.name}*\n` +
            `    Qty: ${l.qty} x ${money(l.price)} = ${money(l.line)}`;
        /* the image link lets the owner see exactly what was picked */
        if (opts.includeImages !== false && l.img) row += `\n    Image: ${l.img}`;
        return row;
    }).join("\n\n");

    const payment = method === "Transfer with Bank"
        ? `Please send me the account details to transfer to (${ACCOUNT.bank} - ${ACCOUNT.number}, ${ACCOUNT.name}). I will send my proof of payment straight after.`
        : "Please send me the card payment link so I can pay with my bank card.";

    const body = [
        "Hello Hycenth Stitches 👋",
        opts.intro || "I would like to sew/order the following from your store:",
        "",
        items,
        "",
        `*Items:* ${t.count}`,
        `*Subtotal:* ${money(t.sub)}`,
        `*Delivery:* ${money(t.del)}`,
        `*Total to pay:* ${money(t.total)}`,
        `*Payment method:* ${method}`,
        "",
        payment
    ];

    /* the owner normally asks for sizes in the chat themselves */
    if (opts.askMeasurements) {
        body.push("", "I also want to send my measurements so the fit is perfect — please send me the measurement guide.");
    }

    body.push("", "Thank you!");
    return body.join("\n");
}

function checkout() {
    const t = totals();
    if (t.count === 0) return toast("Your cart is empty");

    const method = document.querySelector('input[name="pay"]:checked').value;
    const lines = orderLines();
    const msg = buildOrderMessage(lines, t, method);
    const waUrl = "https://wa.me/" + waNumber() + "?text=" + encodeURIComponent(msg);

    /* Open WhatsApp straight away — still inside the click, so no popup blocker.
       The modal below stays as a backup if the tab did not open. */
    let opened = false;
    try {
        const tab = window.open(waUrl, "_blank");
        if (tab) {
            opened = true;
            try { tab.opener = null; } catch (e) { /* ignore */ }
        }
    } catch (e) { opened = false; }

    const rows = lines.map(l =>
        `<div class="thumb-row">
            <img class="thumb" src="${escAttr(l.img)}" alt="" loading="lazy">
            <span>${escAttr(l.name)} &times;${l.qty}</span>
            <strong>${money(l.line)}</strong>
        </div>`
    ).join("");

    const bank = method === "Transfer with Bank" ? `
        <div class="details">
            <strong>Bank Transfer Details</strong>
            <div class="acct-row"><span>Bank</span><strong>${ACCOUNT.bank}</strong></div>
            <div class="acct-row"><span>Account Name</span><strong>${ACCOUNT.name}</strong></div>
            <div class="acct-row">
                <span>Account Number</span>
                <span class="acct-no">
                    <strong>${ACCOUNT.number}</strong>
                    <button class="copy-btn" type="button" onclick="copyAccount('${ACCOUNT.number}', this)">Copy</button>
                </span>
            </div>
            <div class="acct-row"><span>Amount</span><strong>${money(t.total)}</strong></div>
        </div>` : "";

    openModal(`
        <h3>${opened ? "WhatsApp Opened" : "Your Order Is Ready"} &#10003;</h3>
        <p>${opened
            ? "We opened WhatsApp with your order details. Press send, then pay and share your proof of payment."
            : "Your browser blocked the WhatsApp tab — use the button below to send your order."}</p>
        <p class="amount">${money(t.total)}</p>

        <div class="details">
            <strong>Your Order</strong>
            ${rows}
            <div class="acct-row"><span>Delivery</span><strong>${money(t.del)}</strong></div>
            <div class="acct-row"><span>Total</span><strong>${money(t.total)}</strong></div>
        </div>
        ${bank}

        <a class="btn whatsapp full" href="${waUrl}" target="_blank" rel="noopener">Send Order on WhatsApp</a>
        <p style="margin-top:.8rem">We kept your cart, so you can come back to it any time.</p>
        <button class="btn solid full" onclick="closeModal()">Done</button>
    `);
}

/* ---------- COPY ACCOUNT NUMBER ---------- */
function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
}

function copyAccount(number, btn) {
    const text = String(number);
    const done = ok => {
        if (btn) {
            btn.textContent = ok ? "Copied \u2713" : "Copy";
            btn.classList.toggle("copied", ok);
            if (ok) {
                setTimeout(() => {
                    btn.textContent = "Copy";
                    btn.classList.remove("copied");
                }, 1800);
            }
        }
        toast(ok ? "Account number copied" : "Copy failed \u2014 please select and copy manually");
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => done(true)).catch(() => done(fallbackCopy(text)));
    } else {
        done(fallbackCopy(text));
    }
}

/* ---------- UI HELPERS ---------- */
function go(page) {
    document.querySelectorAll(".page").forEach(s => s.classList.remove("active"));
    document.getElementById("page-" + page).classList.add("active");
    document.querySelectorAll(".nav a").forEach(a =>
        a.classList.toggle("active", a.dataset.page === page));
    document.getElementById("nav").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal(html) {
    document.getElementById("modalBody").innerHTML = html;
    document.getElementById("modal").classList.add("open");
}
function closeModal() { document.getElementById("modal").classList.remove("open"); }

let toastTimer;
function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
        el = document.createElement("div");
        el.id = "toast";
        el.className = "toast";
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

/* ---------- EVENTS ---------- */
document.addEventListener("click", e => {
    const navLink = e.target.closest("[data-page]");
    if (navLink) { go(navLink.dataset.page); return; }

    const chip = e.target.closest(".chip");
    if (chip) {
        document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        currentFilter = chip.dataset.filter;
        visibleCount = PAGE_SIZE;
        renderGrid();
        return;
    }

    const card = e.target.closest(".card");
    if (card) addToCart(+card.dataset.id);
});

document.getElementById("searchInput").addEventListener("input", e => {
    currentSearch = e.target.value.trim().toLowerCase();
    visibleCount = PAGE_SIZE;
    renderGrid();
});

document.getElementById("sortSelect").addEventListener("change", e => {
    currentSort = e.target.value;
    visibleCount = PAGE_SIZE;
    renderGrid();
});

document.getElementById("loadMoreBtn").addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    renderGrid();
});

document.getElementById("menuBtn").onclick = () =>
    document.getElementById("nav").classList.toggle("open");

document.getElementById("checkout").onclick = checkout;
document.getElementById("modalClose").onclick = closeModal;
document.getElementById("modal").onclick = e => { if (e.target.id === "modal") closeModal(); };

/* ---------- PAYMENT METHOD TOGGLE ---------- */
const payAccount = document.getElementById("payAccount");
document.querySelectorAll('input[name="pay"]').forEach(r =>
    r.addEventListener("change", () => {
        const method = document.querySelector('input[name="pay"]:checked').value;
        payAccount.classList.toggle("hidden", method !== "Transfer with Bank");
    })
);

document.getElementById("copyAcct").onclick = e => copyAccount(ACCOUNT.number, e.currentTarget);

document.getElementById("contactForm").onsubmit = async e => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const msg = document.getElementById("formMsg");
    const name = document.getElementById("cName").value.trim();
    const email = document.getElementById("cEmail").value.trim();
    const text = document.getElementById("cMsg").value.trim();

    btn.disabled = true;
    msg.textContent = "Sending...";

    /* where the enquiry goes — set in the admin panel */
    const to = siteSettings.contact.email || "martinejiofor61@gmail.com";

    try {
        const res = await fetch("https://formsubmit.co/ajax/" + to, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
                name,
                email,
                message: text,
                _subject: "New message from Hycenth website",
                _template: "table",
                _url: location.href
            })
        });
        const data = await res.json().catch(() => ({}));

        if (String(data.success) === "true") {
            msg.textContent = "Thank you! Your message has been sent.";
            form.reset();
        } else {
            throw new Error(data.message || "send failed");
        }
    } catch (err) {
        const subject = encodeURIComponent(`Website enquiry from ${name}`);
        const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${text}`);
        window.location.href =
            `mailto:${to}?subject=${subject}&body=${body}`;
        msg.textContent = "Opening your email app instead...";
    } finally {
        btn.disabled = false;
    }
};

/* ---------- APPLY ADMIN SETTINGS ---------- */
function escAttr(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function applySettings() {
    const s = siteSettings;
    const $ = sel => document.querySelector(sel);
    const $$ = sel => [...document.querySelectorAll(sel)];

    DELIVERY = s.delivery.fee;
    FREE_OVER = s.delivery.freeOver;
    Object.assign(ACCOUNT, s.payment);

    /* hero copy */
    const eyebrow = $(".hero-inner .eyebrow");
    if (eyebrow) eyebrow.textContent = s.hero.eyebrow;
    const h1 = $(".hero h1");
    if (h1) h1.innerHTML = `${escAttr(s.hero.title)} <span>${escAttr(s.hero.accent)}</span>`;
    const heroText = $(".hero-text");
    if (heroText) heroText.textContent = s.hero.text;

    /* hero slides */
    const track = document.getElementById("heroTrack");
    if (track) {
        const slides = s.hero.slides.length ? s.hero.slides : HycenthDefaults.hero.slides;
        track.innerHTML = slides.map((sl, i) => `
            <div class="slide${i === 0 ? " active" : ""}">
                <img src="${escAttr(sl.src)}" alt="${escAttr(sl.alt)}"
                     loading="${i === 0 ? "eager" : "lazy"}">
            </div>`).join("");
    }

    /* feature cards */
    $$(".features > div").forEach((box, i) => {
        const f = s.features[i];
        if (!f) return;
        const h3 = box.querySelector("h3");
        const p = box.querySelector("p");
        if (h3) h3.textContent = f.title;
        if (p) p.textContent = f.text;
    });

    /* contact details */
    $$('a[data-s="phone"], a[data-s="phone-f"]').forEach(a => {
        a.textContent = s.contact.phone;
        a.href = "https://wa.me/" + waNumber();
    });
    $$('a[data-s="email"], a[data-s="email-f"]').forEach(a => {
        a.textContent = s.contact.email;
        a.href = "mailto:" + s.contact.email;
    });
    $$('[data-s="location"], [data-s="location-f"]').forEach(el => {
        el.textContent = s.contact.location;
    });

    /* every WhatsApp / email link on the page */
    $$("a").forEach(a => {
        const href = a.getAttribute("href") || "";
        if (href.startsWith("https://wa.me/") && href.indexOf("?text=") === -1) {
            a.href = "https://wa.me/" + waNumber();
        } else if (href.startsWith("mailto:")) {
            a.href = "mailto:" + s.contact.email;
        }
    });

    /* bank details on the cart page — these come from the admin panel */
    $$('[data-s="bank"]').forEach(el => { el.textContent = s.payment.bank; });
    $$('[data-s="acctName"]').forEach(el => { el.textContent = s.payment.name; });
    $$('[data-s="acctNumber"]').forEach(el => { el.textContent = s.payment.number; });

    /* social links — a link with no address is hidden instead of
       sending people to an empty page */
    ["instagram", "tiktok", "facebook"].forEach(net => {
        const url = (s.social && s.social[net]) || "";
        $$(`[data-social="${net}"]`).forEach(a => {
            if (url) {
                a.href = url;
                a.classList.remove("hidden");
                a.removeAttribute("aria-hidden");
            } else {
                a.href = "#";
                a.classList.add("hidden");
                a.setAttribute("aria-hidden", "true");
            }
        });
    });

    /* the contact form posts to the address saved in the admin panel */
    const contactForm = document.getElementById("contactForm");
    if (contactForm) contactForm.action = "https://formsubmit.co/" + s.contact.email;

    /* delivery note */
    const note = $(".delivery-note");
    if (note) {
        note.innerHTML = `<span class="tick"></span> Free delivery on every order over ${money(s.delivery.freeOver)}`;
    }
}

/* ---------- LIVE SYNC WITH THE ADMIN PANEL ---------- */

/* Re-reads the catalogue and the site content from the store and
   repaints the page. Runs whenever the admin panel saves. */
function reloadData() {
    products = HycenthStore.getProducts();
    siteSettings = HycenthSettings.get();
    applySettings();
    initHeroCarousel();
    renderGrid();
    renderCart();
    updateBadge();
}

/* The admin panel and this page share the same browser storage. The
   "storage" event fires in every OTHER tab when that storage
   changes, so a save in the admin panel repaints this page at once
   — no refresh needed. */
window.addEventListener("storage", e => {
    if (!e.key ||
        e.key === "hycenth_products" ||
        e.key === "hycenth_settings" ||
        e.key === "hycenth_meta") {
        reloadData();
    }
});

/* ---- the published file (data.json) ----
   localStorage only reaches the browser it lives in. To reach a
   visitor on another phone or computer the admin panel publishes one
   small file that sits beside index.html. The website loads it and
   takes it if it is newer than what it already has. */
const PUBLISHED_FILE = "data.json";

async function checkPublished() {
    if (!window.HycenthSync) return;
    if (location.protocol === "file:") return; /* no fetch on a plain file */
    try {
        const res = await fetch(PUBLISHED_FILE + "?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const payload = await res.json();
        const result = HycenthSync.importData(payload);
        if (result.applied) {
            reloadData();
            toast("Updated to the latest published version");
        }
    } catch (e) { /* no published file yet — keep showing the local copy */ }
}

/* ---------- INIT ---------- */
applySettings();
renderGrid();
renderCart();
updateBadge();

/* ---------- SCROLL REVEAL ---------- */
const revealer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("in");
            revealer.unobserve(entry.target);
        }
    });
}, { threshold: 0.2 });

document.querySelectorAll(".reveal").forEach(el => revealer.observe(el));

/* ---------- HERO CAROUSEL (auto slide) ---------- */
const heroTrack = document.getElementById("heroTrack");
let heroSlides = [];
const heroDotsBox = document.getElementById("heroDots");
let heroIndex = 0;
let heroTimer;

/* Rebuilt whenever the slides change, so the carousel keeps working
   after the admin panel swaps the images out. */
function initHeroCarousel() {
    heroSlides = [...heroTrack.querySelectorAll(".slide")];
    heroDotsBox.innerHTML = "";
    heroSlides.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.setAttribute("aria-label", `Show image ${i + 1}`);
        if (i === 0) dot.classList.add("active");
        dot.addEventListener("click", () => { goHero(i); resetHeroTimer(); });
        heroDotsBox.appendChild(dot);
    });
    heroIndex = 0;
    if (heroSlides.length) goHero(0);
    resetHeroTimer();
}

function goHero(i) {
    if (!heroSlides.length) return;
    heroIndex = (i + heroSlides.length) % heroSlides.length;
    heroTrack.style.transform = `translateX(-${heroIndex * 100}%)`;
    heroSlides.forEach((s, n) => s.classList.toggle("active", n === heroIndex));
    [...heroDotsBox.children].forEach((d, n) => d.classList.toggle("active", n === heroIndex));
}

function resetHeroTimer() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => goHero(heroIndex + 1), 4000);
}

document.getElementById("heroPrev").addEventListener("click", () => { goHero(heroIndex - 1); resetHeroTimer(); });
document.getElementById("heroNext").addEventListener("click", () => { goHero(heroIndex + 1); resetHeroTimer(); });

const heroMedia = document.getElementById("heroMedia");
heroMedia.addEventListener("mouseenter", () => clearInterval(heroTimer));
heroMedia.addEventListener("mouseleave", resetHeroTimer);

let touchX = null;
heroMedia.addEventListener("touchstart", e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
heroMedia.addEventListener("touchend", e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) { goHero(heroIndex + (dx < 0 ? 1 : -1)); resetHeroTimer(); }
    touchX = null;
}, { passive: true });

initHeroCarousel();

/* ---------- HERO SCROLL PARALLAX ---------- */
const heroParallaxEl = document.getElementById("heroParallax");
const heroInnerEl = document.querySelector(".hero-inner");
let heroTicking = false;

window.addEventListener("scroll", () => {
    if (heroTicking) return;
    heroTicking = true;
    requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 900) {
            heroParallaxEl.style.transform = `translateY(${y * 0.22}px) scale(${1 + y * 0.0003})`;
            heroInnerEl.style.transform = `translateY(${y * 0.1}px)`;
            heroInnerEl.style.opacity = String(Math.max(0, 1 - y / 550));
        }
        heroTicking = false;
    });
}, { passive: true });

/* ---------- PUBLISHED FILE WATCHER ----------
   Looks for a newer published file on load, when the tab comes back
   to the front, and once a minute. */
checkPublished();
setInterval(checkPublished, 60000);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkPublished();
});
window.addEventListener("focus", checkPublished);
