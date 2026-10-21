/* ============================================================
   Hycenth Store — shared data layer for the website and admin.
   Handles: product catalog, site settings, persistence and
   admin authentication. Loaded before script.js / admin.js.
   ============================================================ */
(function (global) {
    "use strict";

    var KEYS = {
        products: "hycenth_products",
        settings: "hycenth_settings",
        account: "hycenth_admin_acc",
        session: "hycenth_session"
    };

    var SESSION_MS = 8 * 60 * 60 * 1000; /* 8 hours */
    var HASH_SALT = "hycenth::stitches::2026";

    /* Pre-seeded admin account. Only the salted FNV hash lives in the
       source; the password is given to the owner out-of-band. */
    var SEED_ADMIN = { user: "admin", hash: "fnv2ef14ddb" };
    var SEED_FLAG = "hycenth_admin_seeded";

    /* ============================================================
       DEFAULT CATALOG DATA
       ============================================================ */

    function img(id, w) {
        return "https://images.pexels.com/photos/" + id +
            "/pexels-photo-" + id + ".jpeg?auto=compress&cs=tinysrgb&w=" + (w || 700);
    }

    /* Original men's wear photos (kept — the old wears stay) */
    var MEN_PHOTOS = [
        8526759, 36445248, 35405978, 35013624, 31485658, 35043796, 36445249,
        31485660, 31914786, 36783604, 34821105, 37320666, 37320670, 37340989,
        37340988, 37283126, 31485635, 38188442, 34550948, 37838842, 34174668,
        33169687, 33356783, 39296698, 34286931, 35020969, 29824685, 27992683,
        28446760, 9705941, 32919059, 34786320, 35229540, 36445247, 33511973,
        36445250, 35210529, 33511964, 35277319, 31485690, 35529701, 32453022,
        32562830, 38991775, 37038752, 37038748, 35305068, 34329859, 34996727,
        34169570, 39043850, 38887705, 33642034, 32562829, 37872324
    ];

    /* Replacement photos for the duplicated wears (each used once) */
    var MEN_PHOTOS_NEW = [
        1194421, 2976373, 3379216, 5028727, 6109341, 6109551, 6568253,
        6626361, 6732388, 8735913, 8995906, 9310866, 9340638, 9720575,
        9880858, 10513822, 10698019, 11086661, 14783579, 15505145, 15568433,
        16136336, 17451347, 19272491, 19320006, 19410933, 20145326, 20178163,
        29278276, 29824679, 30452332, 30729642, 31694790, 31951217, 31985757,
        32116881, 32126248, 32184238, 32551868, 32721397, 32748964, 33044982,
        33242998, 33277597, 33356351, 33624748, 33962439, 34039341, 34275056,
        34362606, 34445229, 34550150, 34735506, 34735729, 34752885, 34867545,
        34974189, 35069475, 35100573, 35193995, 35405984, 35429599, 35533363,
        35576577, 35677043, 36029404, 36242797, 36690236, 36733079, 36834297,
        37036211, 37111253, 37227477, 37283114, 37283602, 37335107, 37335113
    ];

    var NURSE_PHOTOS = [6098054, 6097685, 6097689, 6303654, 6097698];

    /* Replacement photos for the duplicated nurse wears */
    var NURSE_PHOTOS_NEW = [
        14438789, 36311379, 19231623, 31499386, 32115957, 32254523, 32486496,
        33345141, 33474165, 37476737, 38733291, 34833841, 35995763
    ];

    var MEN_STYLES = [
        "Royal Agbada", "Senator Kaftan", "Aso Oke Agbada", "Bazin Riche Agbada",
        "Embroidered Kaftan", "Classic Agbada", "Hausa Jalabiya", "Yoruba Agbada",
        "Three-Piece Agbada", "Striped Senator", "Modern Kaftan", "Ceremonial Agbada",
        "Elegant Agbada", "Deluxe Kaftan", "Heritage Agbada", "Flowing Agbada",
        "Hand-Stitched Kaftan", "Prestige Agbada", "Coronation Agbada", "Urban Senator",
        "Wedding Agbada", "Fila & Agbada Set", "Baban Riga", "Grand Kaftan",
        "Midnight Agbada", "Palm-Wine Agbada", "Ancestral Agbada", "Regal Kaftan",
        "Ivory Agbada", "Onyx Agbada"
    ];

    var MEN_COLORS = [
        "Royal Blue", "Ivory White", "Wine Red", "Emerald Green", "Golden Sand",
        "Charcoal", "Lavender", "Terracotta", "Sage", "Deep Navy", "Burgundy",
        "Cream", "Teal", "Mustard", "Onyx Black", "Pearl Grey", "Copper", "Forest",
        "Azure", "Maroon"
    ];

    var NURSE_NAMES = [
        "Nurse Scrub Set", "Premium Nurse Uniform", "Clinical Scrub Top & Pants",
        "Ward Nurse Set", "Professional Nurse Gown", "Maternity Nurse Scrub",
        "Surgical Scrub Set", "Nurse Tunic & Trousers", "Pediatric Scrub Set",
        "Emergency Nurse Uniform", "Night Shift Scrub Set", "Nurse Dress Uniform",
        "Clinic Wear Set", "Hospital Scrub Pack", "Senior Nurse Gown",
        "Nursing Sister Uniform", "Theatre Scrub Set", "Outpatient Nurse Set"
    ];

    var DAY = 86400000;

    function generateProducts() {
        var items = [];
        var id = 1;
        var i, style, color, photo, base, price;

        /* 132 men's items — every photo used exactly once (no duplicates) */
        for (i = 0; i < 132; i++) {
            style = MEN_STYLES[i % MEN_STYLES.length];
            color = MEN_COLORS[Math.floor(i / MEN_STYLES.length) % MEN_COLORS.length];
            photo = MEN_PHOTOS.concat(MEN_PHOTOS_NEW)[i];
            base = 32000 + ((i * 3571) % 78000);
            price = Math.round(base / 500) * 500;
            items.push({
                id: id++,
                name: style + " (" + color + ")",
                cat: "men",
                price: price,
                img: img(photo),
                tag: "Men",
                desc: "Hand-tailored " + style + " in " + color +
                    ", cut to your measurements in our Aba workshop.",
                visible: true,
                createdAt: Date.now() - (i + 45) * DAY,
                updatedAt: null
            });
        }

        /* 18 nurse items — every photo used exactly once (no duplicates) */
        for (i = 0; i < 18; i++) {
            photo = NURSE_PHOTOS.concat(NURSE_PHOTOS_NEW)[i];
            price = 18000 + ((i * 1301) % 16000);
            items.push({
                id: id++,
                name: NURSE_NAMES[i % NURSE_NAMES.length] + (i >= NURSE_NAMES.length ? " II" : ""),
                cat: "nurse",
                price: Math.round(price / 500) * 500,
                img: img(photo),
                tag: "Nurses",
                desc: "Professional-grade nursing wear, stitched for comfort " +
                    "and long shifts.",
                visible: true,
                createdAt: Date.now() - (i + 15) * DAY,
                updatedAt: null
            });
        }

        return items;
    }

    var DEFAULT_SETTINGS = {
        hero: {
            eyebrow: "Tailored to fit. Stitched to last.",
            title: "Timeless Native Clinical Wear,",
            accent: "Made to Measure.",
            text: "Premium handcrafted Agbada, kaftans and professional nursing sets. Order online, pay your way, and we deliver to your door.",
            slides: [
                { src: img(37340989, 1200), alt: "Nigerian man wearing a full-length traditional agbada outfit" },
                { src: img(8526759, 1200), alt: "Royal agbada set" },
                { src: img(34821105, 1200), alt: "Heritage agbada three-piece outfit" },
                { src: img(35013624, 1200), alt: "Classic Yoruba agbada" },
                { src: img(37838842, 1200), alt: "Stylish purple agbada with cap" },
                { src: img(33642034, 1200), alt: "Beige traditional attire with matching cap" }
            ]
        },
        features: [
            { title: "Hand Stitched", text: "Skilled tailoring on quality fabrics." },
            { title: "Fast Delivery", text: "Nationwide dispatch within days." },
            { title: "Secure Payment", text: "Bank transfer or bank card." },
            { title: "Custom Fit", text: "Send your measurements, we sew to you." }
        ],
        contact: {
            phone: "+234 91 6564 3642",
            whatsapp: "2349165643642",
            email: "martinejiofor61@gmail.com",
            location: "ABA, Nigeria"
        },
        delivery: { fee: 3500, freeOver: 100000 },
        payment: {
            bank: "Moniepoint",
            number: "9165643642",
            name: "Martin Munachi Ejiofor"
        },
        order: {
            intro: "I would like to sew/order the following from your store:",
            includeImages: true,
            askMeasurements: false
        }
    };

    /* ============================================================
       STORAGE HELPERS
       ============================================================ */

    function ls() {
        try {
            var t = "__hy_test__";
            global.localStorage.setItem(t, "1");
            global.localStorage.removeItem(t);
            return global.localStorage;
        } catch (e) {
            return null;
        }
    }

    var mem = {};
    var memMode = false;

    function storeGet(key) {
        var s = ls();
        try {
            if (s) return s.getItem(key);
            memMode = true;
            return key in mem ? mem[key] : null;
        } catch (e) {
            return null;
        }
    }

    function storeSet(key, value) {
        var s = ls();
        try {
            if (s) {
                s.setItem(key, value);
                return true;
            }
            memMode = true;
            mem[key] = value;
            return true;
        } catch (e) {
            throw new Error(
                e && e.name === "QuotaExceededError"
                    ? "Browser storage is full. Delete some images or reset old data."
                    : "Could not save data to this browser."
            );
        }
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function readJSON(key) {
        var raw = storeGet(key);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function writeJSON(key, value) {
        storeSet(key, JSON.stringify(value));
    }

    /* ============================================================
       VALIDATION / SANITISING
       ============================================================ */

    function cleanText(value, max) {
        var s = String(value == null ? "" : value);
        s = s.replace(/[<>]/g, "").trim();
        if (max && s.length > max) s = s.slice(0, max);
        return s;
    }

    function cleanUrl(value, allowDataImage) {
        var s = String(value == null ? "" : value).trim();
        if (/^https?:\/\//i.test(s)) return s;
        if (allowDataImage && /^data:image\//i.test(s)) return s;
        if (!s) throw new Error("Image URL is required.");
        throw new Error("Image must be an http(s) URL or an uploaded image.");
    }

    function cleanNumber(value, fallback) {
        var n = Number(value);
        return isFinite(n) ? n : fallback;
    }

    function cloneSettings(raw) {
        var base = clone(DEFAULT_SETTINGS);
        if (!raw || typeof raw !== "object") return base;

        ["eyebrow", "title", "accent", "text"].forEach(function (k) {
            if (raw.hero && raw.hero[k] != null) base.hero[k] = cleanText(raw.hero[k], 300);
        });
        if (raw.hero && Array.isArray(raw.hero.slides)) {
            var slides = [];
            raw.hero.slides.forEach(function (sl) {
                if (!sl || !sl.src) return;
                try {
                    slides.push({
                        src: cleanUrl(sl.src, true),
                        alt: cleanText(sl.alt || "", 160)
                    });
                } catch (e) { /* skip invalid slide */ }
            });
            if (slides.length) base.hero.slides = slides;
        }
        if (Array.isArray(raw.features)) {
            base.features = base.features.map(function (def, i) {
                var f = raw.features[i];
                return f ? {
                    title: cleanText(f.title != null ? f.title : def.title, 60),
                    text: cleanText(f.text != null ? f.text : def.text, 160)
                } : def;
            });
        }
        ["phone", "whatsapp", "email", "location"].forEach(function (k) {
            if (raw.contact && raw.contact[k] != null) base.contact[k] = cleanText(raw.contact[k], 80);
        });
        if (raw.delivery) {
            base.delivery.fee = Math.max(0, cleanNumber(raw.delivery.fee, base.delivery.fee));
            base.delivery.freeOver = Math.max(0, cleanNumber(raw.delivery.freeOver, base.delivery.freeOver));
        }
        ["bank", "number", "name"].forEach(function (k) {
            if (raw.payment && raw.payment[k] != null) base.payment[k] = cleanText(raw.payment[k], 80);
        });
        if (raw.order) {
            base.order.intro = cleanText(raw.order.intro != null ? raw.order.intro : base.order.intro, 200);
            if ("includeImages" in raw.order) {
                base.order.includeImages = raw.order.includeImages !== false && raw.order.includeImages !== "false";
            }
            if ("askMeasurements" in raw.order) {
                base.order.askMeasurements = raw.order.askMeasurements === true || raw.order.askMeasurements === "true";
            }
        }
        return base;
    }

    /* ============================================================
       AUTHENTICATION
       ============================================================ */

    var rate = { fails: 0, lockedUntil: 0 };

    function fnvHash(text) {
        var h = 0x811c9dc5;
        for (var i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
        }
        return "fnv" + h.toString(16);
    }

    function hashPassword(password, alg) {
        var text = HASH_SALT + "::" + password;
        if (alg === "sha256" && global.crypto && global.crypto.subtle && global.TextEncoder) {
            return global.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
                .then(function (buf) {
                    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
                        return ("0" + b.toString(16)).slice(-2);
                    }).join("");
                });
        }
        /* Fallback (non-secure contexts): FNV-1a */
        return Promise.resolve(fnvHash(text));
    }

    function pickAlg() {
        return (global.crypto && global.crypto.subtle && global.TextEncoder) ? "sha256" : "fnv";
    }

    function randomToken() {
        var bytes = new Uint8Array(16);
        if (global.crypto && global.crypto.getRandomValues) {
            global.crypto.getRandomValues(bytes);
        } else {
            for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        return Array.prototype.map.call(bytes, function (b) {
            return ("0" + b.toString(16)).slice(-2);
        }).join("");
    }

    var Auth = {
        /* Create the pre-seeded account once, on first run. If the owner
           later deletes it, the setup screen returns instead of re-seeding. */
        ensureDefault: function () {
            if (readJSON(KEYS.account)) return false;
            if (storeGet(SEED_FLAG) === "1") return false;
            try {
                writeJSON(KEYS.account, {
                    user: SEED_ADMIN.user,
                    hash: SEED_ADMIN.hash,
                    alg: "fnv",
                    createdAt: Date.now(),
                    seeded: true
                });
                storeSet(SEED_FLAG, "1");
                return true;
            } catch (e) {
                return false;
            }
        },

        hasAccount: function () {
            return !!readJSON(KEYS.account);
        },

        account: function () {
            return readJSON(KEYS.account);
        },

        createAccount: function (username, password, email) {
            username = cleanText(username, 40);
            if (username.length < 3) return Promise.reject(new Error("Username must be at least 3 characters."));
            if (String(password).length < 6) return Promise.reject(new Error("Password must be at least 6 characters."));

            var alg = pickAlg();
            return hashPassword(password, alg).then(function (hash) {
                writeJSON(KEYS.account, {
                    user: username,
                    hash: hash,
                    alg: alg,
                    email: cleanText(email || "", 80).toLowerCase(),
                    createdAt: Date.now()
                });
                Auth.startSession();
                return username;
            });
        },

        login: function (username, password, email) {
            if (Date.now() < rate.lockedUntil) {
                var secs = Math.ceil((rate.lockedUntil - Date.now()) / 1000);
                return Promise.reject(new Error("Too many attempts. Try again in " + secs + "s."));
            }
            var acc = readJSON(KEYS.account);
            if (!acc) return Promise.reject(new Error("No admin account exists yet."));

            return hashPassword(password, acc.alg || "fnv").then(function (hash) {
                if (hash !== acc.hash || cleanText(username, 40).toLowerCase() !== String(acc.user).toLowerCase()) {
                    rate.fails++;
                    if (rate.fails >= 5) {
                        rate.lockedUntil = Date.now() + 30000;
                        rate.fails = 0;
                        throw new Error("Too many attempts. Locked for 30 seconds.");
                    }
                    throw new Error("Incorrect username or password.");
                }
                rate.fails = 0;
                /* the sign-in email travels with the account */
                if (email) {
                    var mail = cleanText(email, 80).toLowerCase();
                    if (mail && mail !== acc.email) {
                        acc.email = mail;
                        writeJSON(KEYS.account, acc);
                    }
                }
                Auth.startSession();
                return acc.user;
            });
        },

        changePassword: function (current, next) {
            var acc = readJSON(KEYS.account);
            if (!acc) return Promise.reject(new Error("No admin account exists yet."));
            if (String(next).length < 6) return Promise.reject(new Error("New password must be at least 6 characters."));

            var alg = pickAlg();
            return hashPassword(current, acc.alg || "fnv").then(function (hash) {
                if (hash !== acc.hash) throw new Error("Current password is incorrect.");
                return hashPassword(next, alg);
            }).then(function (hash) {
                acc.hash = hash;
                acc.alg = alg;
                writeJSON(KEYS.account, acc);
                return true;
            });
        },

        startSession: function () {
            var token = randomToken();
            global.sessionStorage.setItem(KEYS.session, JSON.stringify({
                token: token,
                user: (readJSON(KEYS.account) || {}).user || "admin",
                exp: Date.now() + SESSION_MS
            }));
        },

        session: function () {
            var raw = null;
            try { raw = global.sessionStorage.getItem(KEYS.session); } catch (e) { raw = null; }
            if (!raw) return null;
            try {
                var s = JSON.parse(raw);
                if (!s || !s.token || !s.exp) return null;
                if (s.exp <= Date.now()) {
                    try { global.sessionStorage.removeItem(KEYS.session); } catch (e) { /* ignore */ }
                    return null;
                }
                return s;
            } catch (e) {
                return null;
            }
        },

        isLoggedIn: function () {
            return Auth.session() !== null;
        },

        logout: function () {
            try { global.sessionStorage.removeItem(KEYS.session); } catch (e) { /* ignore */ }
        },

        /* ---- sign-in email (where recovery codes are sent) ---- */
        email: function () {
            var acc = readJSON(KEYS.account);
            return (acc && acc.email) ? acc.email : "";
        },

        setEmail: function (email, validate) {
            var acc = readJSON(KEYS.account);
            if (!acc) throw new Error("No admin account exists yet.");
            email = cleanText(email, 80).toLowerCase();
            if (email && validate && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
                throw new Error("Enter a valid email address.");
            }
            acc.email = email;
            writeJSON(KEYS.account, acc);
            return email;
        },

        /* ---- optional endpoint that emails the one-time code ---- */
        otpEndpoint: function () {
            var acc = readJSON(KEYS.account);
            return (acc && acc.otpEndpoint) ? acc.otpEndpoint : "";
        },

        setOtpEndpoint: function (url) {
            var acc = readJSON(KEYS.account);
            if (!acc) throw new Error("No admin account exists yet.");
            url = cleanText(url, 200);
            if (url && !/^https?:\/\//i.test(url)) {
                throw new Error("The endpoint must be an http(s) URL.");
            }
            acc.otpEndpoint = url;
            writeJSON(KEYS.account, acc);
            return url;
        },

        /* ---- one-time password reset codes ---- */
        issueOtp: function (email) {
            var acc = readJSON(KEYS.account);
            if (!acc) throw new Error("No admin account exists yet.");
            email = cleanText(email, 80).toLowerCase();
            if (!email) throw new Error("Enter your recovery email.");
            if (acc.email && acc.email !== email) {
                throw new Error("That email does not match the recovery email on this account.");
            }
            var code = String(Math.floor(100000 + Math.random() * 900000));
            acc.otp = { email: email, code: code, exp: Date.now() + 5 * 60 * 1000 };
            writeJSON(KEYS.account, acc);
            return code;
        },

        otpRecord: function () {
            var acc = readJSON(KEYS.account);
            return (acc && acc.otp) ? acc.otp : null;
        },

        verifyOtp: function (code) {
            var acc = readJSON(KEYS.account);
            if (!acc) return Promise.reject(new Error("No admin account exists yet."));
            var rec = acc.otp;
            if (!rec || !rec.code) {
                return Promise.reject(new Error("Request a code first."));
            }
            if (rec.exp <= Date.now()) {
                delete acc.otp;
                writeJSON(KEYS.account, acc);
                return Promise.reject(new Error("That code has expired. Request a new one."));
            }
            if (String(code || "").replace(/\D/g, "") !== rec.code) {
                return Promise.reject(new Error("Wrong code."));
            }
            return Promise.resolve(true);
        },

        clearOtp: function () {
            var acc = readJSON(KEYS.account);
            if (acc && acc.otp) {
                delete acc.otp;
                writeJSON(KEYS.account, acc);
            }
        },

        /* sets a new password after a code has been verified */
        resetPassword: function (next) {
            var acc = readJSON(KEYS.account);
            if (!acc) return Promise.reject(new Error("No admin account exists yet."));
            if (String(next).length < 6) {
                return Promise.reject(new Error("Password must be at least 6 characters."));
            }
            var alg = pickAlg();
            return hashPassword(next, alg).then(function (hash) {
                acc.hash = hash;
                acc.alg = alg;
                delete acc.otp;
                writeJSON(KEYS.account, acc);
                return true;
            });
        },

        /* Guard used by every mutating store call — admin actions are
           rejected in the data layer, not only hidden in the UI. */
        assert: function () {
            if (!Auth.isLoggedIn()) throw new Error("Not authorised. Please sign in to the admin panel.");
            return true;
        },

        inMemoryFallback: function () {
            return memMode;
        }
    };

    /* ============================================================
       PRODUCTS
       ============================================================ */

    function validateProduct(data) {
        var name = cleanText(data.name, 90);
        if (!name) throw new Error("Product name is required.");

        var cat = data.cat === "nurse" ? "nurse" : (data.cat === "men" ? "men" : null);
        if (!cat) throw new Error("Please choose a category.");

        var price = Math.round(cleanNumber(data.price, NaN));
        if (!isFinite(price) || price < 0) throw new Error("Price must be a valid amount.");
        if (price > 100000000) throw new Error("Price looks too large.");

        var img_url = cleanUrl(data.img, true);

        var tag = cleanText(data.tag, 30) || (cat === "men" ? "Men" : "Nurses");

        return {
            name: name,
            cat: cat,
            price: price,
            img: img_url,
            tag: tag,
            desc: cleanText(data.desc, 400),
            visible: data.visible !== false && data.visible !== "false"
        };
    }

    function seedProducts() {
        var list = generateProducts();
        writeJSON(KEYS.products, list);
        return list;
    }

    var Store = {
        /* ---- read ---- */
        getProducts: function () {
            var list = readJSON(KEYS.products);
            if (!Array.isArray(list) || !list.length) {
                list = seedProducts();
            }
            /* migrate older entries */
            var dirty = false;
            list.forEach(function (p) {
                if (p.visible == null) { p.visible = true; dirty = true; }
                if (p.createdAt == null) { p.createdAt = Date.now(); dirty = true; }
                if (p.desc == null) { p.desc = ""; dirty = true; }
            });
            if (dirty) writeJSON(KEYS.products, list);
            return list;
        },

        getProduct: function (id) {
            var list = Store.getProducts();
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === id) return list[i];
            }
            return null;
        },

        /* ---- create ---- */
        addProduct: function (data) {
            Auth.assert();
            var clean = validateProduct(data);
            var list = Store.getProducts();
            var maxId = list.reduce(function (m, p) { return Math.max(m, p.id); }, 0);
            var product = Object.assign({ id: maxId + 1, createdAt: Date.now(), updatedAt: null }, clean);
            list.push(product);
            writeJSON(KEYS.products, list);
            return product;
        },

        /* ---- update ---- */
        updateProduct: function (id, patch) {
            Auth.assert();
            var list = Store.getProducts();
            var idx = -1;
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === id) { idx = i; break; }
            }
            if (idx === -1) throw new Error("Product not found.");

            var merged = Object.assign({}, list[idx], patch);
            var clean = validateProduct(merged);
            /* visibility may be patched on its own */
            if (patch && ("visible" in patch)) clean.visible = patch.visible !== false && patch.visible !== "false";

            list[idx] = Object.assign({}, list[idx], clean, { updatedAt: Date.now() });
            writeJSON(KEYS.products, list);
            return list[idx];
        },

        setVisibility: function (id, visible) {
            return Store.updateProduct(id, { visible: !!visible });
        },

        /* ---- delete ---- */
        deleteProduct: function (id) {
            Auth.assert();
            var list = Store.getProducts();
            var before = list.length;
            list = list.filter(function (p) { return p.id !== id; });
            if (list.length === before) throw new Error("Product not found.");
            writeJSON(KEYS.products, list);

            /* clean the item out of any saved cart on this device */
            try {
                var cart = JSON.parse(global.localStorage.getItem("hycenth_cart")) || {};
                if (cart[id] != null) {
                    delete cart[id];
                    global.localStorage.setItem("hycenth_cart", JSON.stringify(cart));
                }
            } catch (e) { /* ignore */ }
            return true;
        },

        resetProducts: function () {
            Auth.assert();
            return seedProducts();
        },

        /* ---- stats ---- */
        stats: function () {
            var list = Store.getProducts();
            var week = Date.now() - 7 * DAY;
            var s = {
                total: list.length,
                visible: 0,
                hidden: 0,
                men: 0,
                nurse: 0,
                recent: 0,
                value: 0,
                newest: []
            };
            list.forEach(function (p) {
                if (p.visible !== false) {
                    s.visible++;
                    s.value += p.price || 0;
                } else {
                    s.hidden++;
                }
                if (p.cat === "men") s.men++; else if (p.cat === "nurse") s.nurse++;
                if (p.createdAt && p.createdAt >= week) s.recent++;
            });
            s.newest = list.slice().sort(function (a, b) {
                return (b.createdAt || 0) - (a.createdAt || 0);
            }).slice(0, 5);
            return s;
        },

        /* ---- storage info ---- */
        usage: function () {
            var bytes = 0;
            try {
                Object.keys(global.localStorage).forEach(function (k) {
                    var v = global.localStorage.getItem(k);
                    if (v) bytes += k.length + v.length;
                });
            } catch (e) { /* ignore */ }
            return bytes;
        }
    };

    /* ============================================================
       SITE SETTINGS
       ============================================================ */

    var Settings = {
        get: function () {
            var raw = readJSON(KEYS.settings);
            if (!raw) {
                var seeded = cloneSettings(null);
                writeJSON(KEYS.settings, seeded);
                return seeded;
            }
            return cloneSettings(raw);
        },

        update: function (patch) {
            Auth.assert();
            if (!patch || typeof patch !== "object") throw new Error("Nothing to save.");
            var current = Settings.get();
            var next = {
                hero: Object.assign({}, current.hero, patch.hero || {}),
                features: patch.features && Array.isArray(patch.features) ? patch.features : current.features,
                contact: Object.assign({}, current.contact, patch.contact || {}),
                delivery: Object.assign({}, current.delivery, patch.delivery || {}),
                payment: Object.assign({}, current.payment, patch.payment || {}),
                order: Object.assign({}, current.order, patch.order || {})
            };
            var clean = cloneSettings(next);
            writeJSON(KEYS.settings, clean);
            return clean;
        },

        reset: function () {
            Auth.assert();
            var defaults = cloneSettings(null);
            writeJSON(KEYS.settings, defaults);
            return defaults;
        }
    };

    /* ============================================================
       EXPORT
       ============================================================ */

    global.HycenthStore = Store;
    global.HycenthSettings = Settings;
    global.HycenthAuth = Auth;
    global.HycenthDefaults = clone(DEFAULT_SETTINGS);

})(typeof window !== "undefined" ? window : globalThis);
