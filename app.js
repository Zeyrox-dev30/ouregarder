// 1. CONFIGURATION DES CLÉS API (TMDB + SUPABASE CLOUD)
const API_KEY = "3d46e6bde77b9759729af6100c5dfe15";
const SUPABASE_URL = "https://" + "fjlpykapfyznadcwuveh.supabase.co";
const SUPABASE_KEY = "sb_publishable_yyKRkbOmEDzzpJuwlpQ8aw_sz7Mzyfk";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE_URL = "https://" + "api.themoviedb.org/3";
const IMG_POSTER = "https://" + "image.tmdb.org/t/p/w500";
const IMG_BACKDROP = "https://" + "image.tmdb.org/t/p/original";
const IMG_LOGO = "https://" + "image.tmdb.org/t/p/w92";
const IMG_CAST = "https://" + "image.tmdb.org/t/p/w185";

// Variables globales de l'application
let utilisateurConnecte = null;
let modeInscription = false;
let watchlist = JSON.parse(localStorage.getItem("ouregarder_watchlist")) || [];
let listeVus = [];

let plateformeActive = "";
let catalogueActuel = [];
let pageActuelle = 1;
let derniereUrlRequete = "";
let dernierTypeForce = null;

majCompteurWatchlist();

// 2. CHARGEMENT DES TENDANCES & REQUÊTES TMDB
async function chargerTendances() {
    document.getElementById("section-title").innerText = "🔥 Tendances de la semaine en France";
    pageActuelle = 1;
    dernierTypeForce = null;
    derniereUrlRequete = `${BASE_URL}/trending/all/week?api_key=${API_KEY}&language=fr-FR`;
    const data = await requeteTMDB(`${derniereUrlRequete}&page=1`);
    if (data && data.results && data.results.length > 0) {
        afficherHero(data.results[0]);
        afficherGrille(data.results, null, false);
    }
}

async function requeteTMDB(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Erreur TMDB");
        return await res.json();
    } catch (err) {
        console.error(err);
        return null;
    }
}

function afficherHero(item) {
    if (!item) return;
    const titre = item.title || item.name;
    const type = item.media_type || (item.title ? "movie" : "tv");
    const banner = document.getElementById("hero-banner");

    if (item.backdrop_path) {
        banner.style.backgroundImage = `url('${IMG_BACKDROP + item.backdrop_path}')`;
    }
    document.getElementById("hero-title").innerText = titre;
    document.getElementById("hero-desc").innerText = item.overview || "Aucune description disponible pour ce titre.";
    document.getElementById("hero-btn-details").onclick = () => ouvrirDetails(item.id, type);
}

async function changerOnglet(onglet, bouton) {
    document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));
    if (bouton) bouton.classList.add("active");
    pageActuelle = 1;

    if (onglet === "tendance") {
        chargerTendances();
    } else if (onglet === "films") {
        document.getElementById("section-title").innerText = "🎥 Films populaires en France";
        dernierTypeForce = "movie";
        derniereUrlRequete = `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=fr-FR&region=FR`;
        const data = await requeteTMDB(`${derniereUrlRequete}&page=1`);
        if (data) afficherGrille(data.results, "movie", false);
    } else if (onglet === "series") {
        document.getElementById("section-title").innerText = "📺 Séries populaires en France";
        dernierTypeForce = "tv";
        derniereUrlRequete = `${BASE_URL}/tv/popular?api_key=${API_KEY}&language=fr-FR`;
        const data = await requeteTMDB(`${derniereUrlRequete}&page=1`);
        if (data) afficherGrille(data.results, "tv", false);
    } else if (onglet === "watchlist") {
        document.getElementById("section-title").innerText = "🔖 Ma Liste à voir plus tard";
        derniereUrlRequete = "";
        afficherGrille(watchlist, null, false);
    }
}

let timerRecherche = null;
function gererRecherche(e) {
    clearTimeout(timerRecherche);
    if (e.key === "Enter") {
        lancerRecherche();
    } else {
        timerRecherche = setTimeout(lancerRecherche, 450);
    }
}

async function lancerRecherche() {
    const query = document.getElementById("search-input").value.trim();
    enregistrerLog("Recherche", query);
    if (query === "") {
        chargerTendances();
        return;
    }

    document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));
    document.getElementById("section-title").innerText = `🔍 Résultats pour "${query}"`;
    pageActuelle = 1;
    dernierTypeForce = null;
    derniereUrlRequete = `${BASE_URL}/search/multi?api_key=${API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`;

    const data = await requeteTMDB(`${derniereUrlRequete}&page=1`);
    if (data && data.results) {
        const filtres = data.results.filter(i => i.media_type === "movie" || i.media_type === "tv");
        afficherGrille(filtres, null, false);
    }
}
// 3. FILTRES PLATEFORMES, PAGINATION & GRILLE
function filtrerParPlateforme(idPlateforme, bouton) {
    plateformeActive = idPlateforme;
    document.querySelectorAll(".plat-pill").forEach(b => b.classList.remove("active"));
    if (bouton) bouton.classList.add("active");
    appliquerFiltres();
}

async function appliquerFiltres() {
    const genre = document.getElementById("genre-select").value;
    if (plateformeActive === "" && genre === "") {
        chargerTendances();
        return;
    }

    document.getElementById("section-title").innerText = "🎯 Sélection filtrée en France";
    pageActuelle = 1;
    dernierTypeForce = "movie";
    derniereUrlRequete = `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=fr-FR&watch_region=FR&sort_by=popularity.desc`;
    if (plateformeActive !== "") derniereUrlRequete += `&with_watch_providers=${plateformeActive}`;
    if (genre !== "") derniereUrlRequete += `&with_genres=${genre}`;

    const data = await requeteTMDB(`${derniereUrlRequete}&page=1`);
    if (data && data.results) {
        catalogueActuel = data.results;
        afficherGrille(data.results, "movie", false);
    }
}

async function chargerPageSuivante() {
    if (!derniereUrlRequete) return;
    pageActuelle++;
    const data = await requeteTMDB(`${derniereUrlRequete}&page=${pageActuelle}`);
    if (data && data.results) {
        const filtres = data.results.filter(i => !i.media_type || i.media_type === "movie" || i.media_type === "tv");
        catalogueActuel = [...catalogueActuel, ...filtres];
        afficherGrille(filtres, dernierTypeForce, true);
    }
}

async function choisirAuHasard() {
    let listeSource = catalogueActuel;
    if (!listeSource || listeSource.length === 0) {
        const data = await requeteTMDB(`${BASE_URL}/trending/all/week?api_key=${API_KEY}&language=fr-FR`);
        listeSource = data ? data.results : [];
    }
    if (listeSource.length === 0) return;

    const filmHasard = listeSource[Math.floor(Math.random() * listeSource.length)];
    const type = filmHasard.media_type || (filmHasard.title ? "movie" : "tv");
    ouvrirDetails(filmHasard.id, type);
}

function afficherGrille(liste, typeForce = null, ajouterALaSuite = false) {
    const grille = document.getElementById("movies-grid");
    const loadMoreBtn = document.getElementById("load-more-wrap");

    if (!ajouterALaSuite) {
        grille.innerHTML = "";
        catalogueActuel = liste;
    }

    document.getElementById("results-count").innerText = `${catalogueActuel.length} titre(s) affiché(s)`;

    if (catalogueActuel.length === 0) {
        grille.innerHTML = `<p style="color:#94a3b8; grid-column: 1/-1; text-align:center; padding:40px;">Aucun film ou série trouvé ici.</p>`;
        loadMoreBtn.classList.add("hidden");
        return;
    }

    const placeholderSansAffiche = "https://" + "://placeholder.com";

    const htmlCartes = liste.map(item => {
        const titre = item.title || item.name;
        const type = typeForce || item.media_type || (item.title ? "movie" : "tv");
        const date = (item.release_date || item.first_air_date || "").substring(0, 4);
        const note = item.vote_average ? item.vote_average.toFixed(1) : "N/A";
        const poster = item.poster_path ? IMG_POSTER + item.poster_path : placeholderSansAffiche;

        return `
            <div class="movie-card" onclick="ouvrirDetails(${item.id}, '${type}')">
                <div class="rating-pill">⭐ ${note}</div>
                <img src="${poster}" alt="${titre}" loading="lazy">
                <div class="movie-info">
                    <h3>${titre}</h3>
                    <div class="movie-meta">
                        <span>${type === "movie" ? "🎬 Film" : "📺 Série"}</span>
                        <span>${date || "—"}</span>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    grille.insertAdjacentHTML("beforeend", htmlCartes);

    if (derniereUrlRequete !== "" && liste.length >= 15) {
        loadMoreBtn.classList.remove("hidden");
    } else {
        loadMoreBtn.classList.add("hidden");
    }
}
// 4. MODALE DÉTAILLÉE COMPLÈTE
async function ouvrirDetails(id, type) {
    if (!type || type === "undefined") type = "movie";

    const modale = document.getElementById("movie-modal");
    const body = document.getElementById("modal-body");
    modale.classList.remove("hidden");
    body.innerHTML = `<p style="text-align:center; padding:40px;">⏳ Chargement des plateformes, casting et avis...</p>`;

    const [details, providersData, videosFr, videosEn, creditsData, similarData, htmlAvis] = await Promise.all([
        requeteTMDB(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=fr-FR`),
        requeteTMDB(`${BASE_URL}/${type}/${id}/watch/providers?api_key=${API_KEY}`),
        requeteTMDB(`${BASE_URL}/${type}/${id}/videos?api_key=${API_KEY}&language=fr-FR`),
        requeteTMDB(`${BASE_URL}/${type}/${id}/videos?api_key=${API_KEY}&language=en-US`),
        requeteTMDB(`${BASE_URL}/${type}/${id}/credits?api_key=${API_KEY}&language=fr-FR`),
        requeteTMDB(`${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}&language=fr-FR`),
        chargerAvisFilm(id, type)
    ]);

    if (!details) return;
      


    const titre = details.title || details.name;
      document.title = `Où regarder ${titre} en streaming VF — OùRegarder`;
    window.history.replaceState({}, "", `?type=${type}&id=${id}`);
    enregistrerLog("Consultation fiche", `${titre} (${type})`);
    const date = (details.release_date || details.first_air_date || "").substring(0, 4);
    const note = details.vote_average ? details.vote_average.toFixed(1) : "N/A";
    const genres = (details.genres || []).map(g => g.name).join(" • ");
    const placeholderSansAffiche = "https://" + "via.placeholder.com";
    const poster = details.poster_path ? IMG_POSTER + details.poster_path : placeholderSansAffiche;

    const listeFr = videosFr && videosFr.results ? videosFr.results : [];
    const listeEn = videosEn && videosEn.results ? videosEn.results : [];
    const toutesVideos = [...listeFr, ...listeEn];
    const trailer = toutesVideos.find(v => v.site === "YouTube" && v.type === "Trailer") 
                 || toutesVideos.find(v => v.site === "YouTube");
    const ytHost = "www.youtube.com";
    const baseEmbed = "https://" + ytHost + "/embed/";
    const ytSearch = "https://" + ytHost + "/results?search_query=" + encodeURIComponent(titre + " bande annonce vf");

  
    const htmlVideo = trailer 
        ? `<div class="trailer-container">
               <iframe src="${baseEmbed}${trailer.key}" title="Bande-annonce ${titre}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
           </div>
           <div style="text-align:right; margin-top:6px;">
               <a href="${ytSearch}" target="_blank" style="font-size:0.8rem; color:#94a3b8; text-decoration:underline;">Problème de lecture ? Ouvrir sur YouTube ↗</a>
           </div>`
        : `<p style="font-size:0.85rem; color:#94a3b8; margin-top:14px;">🎞️ Aucune bande-annonce intégrée. <a href="${ytSearch}" target="_blank" style="color:#38bdf8;">Chercher sur YouTube ↗</a></p>`;

    const frProviders = providersData && providersData.results ? providersData.results.FR : null;
    const abonnement = frProviders && frProviders.flatrate ? frProviders.flatrate : [];
    const gratuit = frProviders && frProviders.free ? frProviders.free : [];
    const location = frProviders && frProviders.rent ? frProviders.rent : [];

    let htmlPlateformes = "";
    if (abonnement.length > 0 || gratuit.length > 0) {
        const toutes = [...abonnement, ...gratuit];
        htmlPlateformes = `<div class="providers-list">${toutes.map(p => `<div class="provider-item"><img src="${IMG_LOGO + p.logo_path}" alt="${p.provider_name}"><span>${p.provider_name}</span></div>`).join("")}</div>`;
    } else if (location.length > 0) {
        htmlPlateformes = `<p style="font-size:0.85rem; color:#94a3b8; margin-bottom:8px;">Disponible uniquement à la location / achat :</p><div class="providers-list">${location.slice(0, 4).map(p => `<div class="provider-item"><img src="${IMG_LOGO + p.logo_path}" alt="${p.provider_name}"><span>${p.provider_name}</span></div>`).join("")}</div>`;
    } else {
        htmlPlateformes = `<p style="font-size:0.9rem; color:#f87171;">❌ Non disponible en streaming en France actuellement.</p>`;
    }

    const placeholderActeur = "https://" + "://placeholder.com";
    const acteurs = creditsData && creditsData.cast ? creditsData.cast.slice(0, 6) : [];
    const htmlCasting = acteurs.length > 0 ? `
        <div class="modal-extra-section">
            <h4>🎭 Casting principal</h4>
            <div class="cast-grid">
                ${acteurs.map(a => `<div class="cast-card"><img src="${a.profile_path ? IMG_CAST + a.profile_path : placeholderActeur}" alt="${a.name}"><strong>${a.name}</strong><span>${a.character || ""}</span></div>`).join("")}
            </div>
        </div>` : "";

    const similaires = similarData && similarData.results ? similarData.results.slice(0, 4) : [];
    const htmlSimilaires = similaires.length > 0 ? `
        <div class="modal-extra-section">
            <h4>✨ Si tu as aimé ce titre</h4>
            <div class="similar-grid">
                ${similaires.map(s => `<div class="similar-card" onclick="ouvrirDetails(${s.id}, '${type}')"><img src="${s.poster_path ? IMG_POSTER + s.poster_path : placeholderSansAffiche}" alt="${s.title || s.name}"><p>${s.title || s.name}</p></div>`).join("")}
            </div>
        </div>` : "";

    const duree = details.runtime || (type === "tv" ? 45 : 110);
    const estVu = listeVus.some(v => v.tmdb_id === details.id);
    const estDansListe = watchlist.some(w => w.id === details.id);

    const itemSimple = JSON.stringify({
        id: details.id,
        title: titre,
        media_type: type,
        poster_path: details.poster_path,
        vote_average: details.vote_average,
        release_date: date
    }).replace(/'/g, "&apos;");

    const titreEchappe = titre.replace(/'/g, "\\'");

    body.innerHTML = `
        <div class="modal-grid">
            <img src="${poster}" alt="${titre}" class="modal-poster">
            <div>
                <span style="color:#facc15; font-weight:800;">⭐ ${note}/10</span> • <span style="color:#94a3b8;">${date}</span>
                <h2 style="font-size:1.7rem; margin:6px 0;">${titre}</h2>
                <p style="color:#38bdf8; font-size:0.85rem; font-weight:600; margin-bottom:12px;">${genres}</p>
                <p style="color:#cbd5e1; font-size:0.92rem; line-height:1.5;">${details.overview || "Aucun résumé disponible."}</p>

                <div class="providers-box">
                    <h4>📺 Où regarder en France :</h4>
                    ${htmlPlateformes}
                </div>

                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn-primary" onclick='basculerWatchlist(${itemSimple}, this)'>
                        ${estDansListe ? "✅ Dans Ma Liste" : "➕ Ajouter à Ma Liste"}
                    </button>
                    <button class="btn-watched ${estVu ? "active" : ""}" onclick="basculerVu(${details.id}, '${type}', '${titreEchappe}', '${details.poster_path || ""}', ${duree}, this)">
                        ${estVu ? "✅ Déjà vu" : "👁️ Marquer comme vu"}
                    </button>
                </div>
            </div>
        </div>
        ${htmlVideo}
        ${htmlCasting}
        ${htmlSimilaires}
        ${htmlAvis}
    `;
}

function fermerModale(e) {
    if (!e || e.target.id === "movie-modal" || e.target.classList.contains("modal-close")) {
        document.getElementById("movie-modal").classList.add("hidden");
        document.getElementById("modal-body").innerHTML = "";
            document.title = "OùRegarder — Trouve où streamer tes films et séries";
    window.history.replaceState({}, "", window.location.pathname);

    }
}
// 5. GESTION DES COMPTES UTILISATEURS
function ouvrirModaleAuth() {
    document.getElementById("auth-error").innerText = "";
    document.getElementById("auth-modal").classList.remove("hidden");
}

function fermerModaleAuth(e) {
    if (!e || e.target.id === "auth-modal" || e.target.classList.contains("modal-close")) {
        document.getElementById("auth-modal").classList.add("hidden");
    }
}

function basculerModeAuth() {
    modeInscription = !modeInscription;
    document.getElementById("auth-title").innerText = modeInscription ? "✨ Créer un compte gratuit" : "🔐 Rejoins OùRegarder";
    document.getElementById("auth-submit-btn").innerText = modeInscription ? "S'inscrire maintenant" : "Se connecter";
    document.getElementById("auth-switch-text").innerText = modeInscription ? "Déjà inscrit ?" : "Pas encore de compte ?";
    document.getElementById("auth-switch-btn").innerText = modeInscription ? "Se connecter" : "Créer un compte";
    document.getElementById("auth-pseudo").classList.toggle("hidden", !modeInscription);
}

async function validerAuth() {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const pseudo = document.getElementById("auth-pseudo").value.trim() || email.split("@");
    const errEl = document.getElementById("auth-error");

    if (!email || password.length < 6) {
        errEl.innerText = "Entre un e-mail valide et un mot de passe de 6 caractères minimum.";
        return;
    }

    errEl.innerText = "⏳ Connexion en cours...";

    if (modeInscription) {
        const { data, error } = await db.auth.signUp({
            email,
            password,
            options: { data: { pseudo } }
        });
        if (error) { errEl.innerText = "❌ " + error.message; return; }
        utilisateurConnecte = data.user;
    } else {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) { errEl.innerText = "❌ E-mail ou mot de passe incorrect."; return; }
        utilisateurConnecte = data.user;
    }

    fermerModaleAuth();
    majInterfaceUtilisateur();
    await chargerWatchlistCloud();
    await chargerVusCloud();
}

async function deconnecter() {
    await db.auth.signOut();
    utilisateurConnecte = null;
    listeVus = [];
    watchlist = JSON.parse(localStorage.getItem("ouregarder_watchlist")) || [];
    majInterfaceUtilisateur();
    majCompteurWatchlist();
}

function majInterfaceUtilisateur() {
    const zone = document.getElementById("auth-zone");
    if (utilisateurConnecte) {
        const pseudo = utilisateurConnecte.user_metadata?.pseudo || utilisateurConnecte.email.split("@");
        zone.innerHTML = `
            <div class="user-pill">
                <span onclick="ouvrirProfil()" style="cursor:pointer; color:#38bdf8;" title="Voir mon profil et mes stats">👤 ${pseudo} (Profil)</span>
                <button class="btn-logout" onclick="deconnecter()" title="Déconnexion">✕</button>
            </div>
        `;
    } else {
        zone.innerHTML = `<button class="btn-auth" onclick="ouvrirModaleAuth()">👤 Connexion / Inscription</button>`;
    }
}

// 6. WATCHLIST CLOUD + LOCAL
async function chargerWatchlistCloud() {
    if (!utilisateurConnecte) return;
    const { data, error } = await db.from("watchlist").select("*").order("created_at", { ascending: false });
    if (!error && data) {
        watchlist = data.map(row => ({
            id: row.tmdb_id,
            title: row.title,
            media_type: row.media_type,
            poster_path: row.poster_path,
            vote_average: row.vote_average,
            release_date: row.release_date
        }));
        majCompteurWatchlist();
    }
}

async function basculerWatchlist(item, bouton) {
    const index = watchlist.findIndex(w => w.id === item.id);

    if (index === -1) {
        watchlist.push(item);
        bouton.innerText = "✅ Dans Ma Liste";
        if (utilisateurConnecte) {
            await db.from("watchlist").insert([{
                user_id: utilisateurConnecte.id,
                tmdb_id: item.id,
                media_type: item.media_type,
                title: item.title,
                poster_path: item.poster_path,
                vote_average: item.vote_average,
                release_date: item.release_date
            }]);
        }
    } else {
        watchlist.splice(index, 1);
        bouton.innerText = "➕ Ajouter à Ma Liste";
        if (utilisateurConnecte) {
            await db.from("watchlist").delete().eq("user_id", utilisateurConnecte.id).eq("tmdb_id", item.id);
        }
    }

    localStorage.setItem("ouregarder_watchlist", JSON.stringify(watchlist));
    majCompteurWatchlist();
}

function majCompteurWatchlist() {
    document.getElementById("count-watchlist").innerText = watchlist.length;
}
// 7. AVIS & NOTES COMMUNAUTAIRES
async function chargerAvisFilm(tmdbId, type) {
    try {
        const { data, error } = await db.from("avis")
            .select("*")
            .eq("tmdb_id", tmdbId)
            .eq("media_type", type)
            .order("created_at", { ascending: false });

        const listeAvis = (!error && data) ? data : [];
        const formHtml = utilisateurConnecte ? `
            <div class="review-form">
                <select id="avis-note" class="star-select">
                    <option value="5">⭐⭐⭐⭐⭐ (5/5 - Chef-d'œuvre)</option>
                    <option value="4">⭐⭐⭐⭐ (4/5 - Très bon)</option>
                    <option value="3">⭐⭐⭐ (3/5 - Sympa)</option>
                    <option value="2">⭐⭐ (2/5 - Moyen)</option>
                    <option value="1">⭐ (1/5 - À éviter)</option>
                </select>
                <textarea id="avis-texte" class="auth-input" rows="2" placeholder="Ton avis sur ce film ou cette série..."></textarea>
                <button class="btn-primary" style="padding:8px 16px; font-size:0.88rem;" onclick="publierAvis(${tmdbId}, '${type}')">💬 Publier mon avis</button>
            </div>
        ` : `<p style="font-size:0.85rem; color:#94a3b8; margin-bottom:14px;">🔒 <button onclick="fermerModale(); ouvrirModaleAuth();" style="background:none; border:none; color:#38bdf8; text-decoration:underline; cursor:pointer; font-weight:700;">Connecte-toi</button> pour laisser une note et un commentaire !</p>`;

        const itemsHtml = listeAvis.length > 0 ? listeAvis.map(a => `
            <div class="review-item">
                <div class="review-header">
                    <strong>👤 ${a.pseudo}</strong>
                    <span style="color:#facc15;">${"⭐".repeat(a.note)}</span>
                </div>
                <p>${a.commentaire}</p>
            </div>
        `).join("") : `<p style="font-size:0.85rem; color:#64748b;">Aucun avis pour l'instant. Sois le premier à donner ton opinion !</p>`;

        return `<div class="reviews-box"><h4 style="margin-bottom:12px;">💬 Avis de la communauté (${listeAvis.length})</h4>${formHtml}<div id="avis-list">${itemsHtml}</div></div>`;
    } catch (e) {
        return "";
    }
}

async function publierAvis(tmdbId, type) {
    if (!utilisateurConnecte) return;
    const note = parseInt(document.getElementById("avis-note").value);
    const commentaire = document.getElementById("avis-texte").value.trim();
    if (!commentaire) return alert("Écris un petit commentaire avant de publier !");

    const pseudo = utilisateurConnecte.user_metadata?.pseudo || utilisateurConnecte.email.split("@");
    const { error } = await db.from("avis").insert([{
        user_id: utilisateurConnecte.id,
        pseudo,
        tmdb_id: tmdbId,
        media_type: type,
        note,
        commentaire
    }]);

    if (!error) {
        ouvrirDetails(tmdbId, type);
    } else {
        alert("Erreur lors de la publication : " + error.message);
    }
}

// 8. FILMS "DÉJÀ VUS" & PROFIL CINÉPHILE
async function chargerVusCloud() {
    if (!utilisateurConnecte) { listeVus = []; return; }
    const { data, error } = await db.from("vus").select("*").order("created_at", { ascending: false });
    if (!error && data) listeVus = data;
}

async function basculerVu(tmdbId, type, title, posterPath, runtime, bouton) {
    if (!utilisateurConnecte) {
        fermerModale();
        ouvrirModaleAuth();
        return;
    }

    const index = listeVus.findIndex(v => v.tmdb_id === tmdbId);
    if (index === -1) {
        const { data, error } = await db.from("vus").insert([{
            user_id: utilisateurConnecte.id,
            tmdb_id: tmdbId,
            media_type: type,
            title,
            poster_path: posterPath,
            runtime
        }]).select();
               if (!error && data && data.length > 0) {
            listeVus.unshift(data.at(0));
            bouton.classList.add("active");
            bouton.innerText = "✅ Déjà vu";
        }

    } else {
        await db.from("vus").delete().eq("user_id", utilisateurConnecte.id).eq("tmdb_id", tmdbId);
        listeVus.splice(index, 1);
        bouton.classList.remove("active");
        bouton.innerText = "👁️ Marquer comme vu";
    }
}

async function ouvrirProfil() {
    if (!utilisateurConnecte) return;
    const modale = document.getElementById("profil-modal");
    const body = document.getElementById("profil-body");
    modale.classList.remove("hidden");

    const pseudo = utilisateurConnecte.user_metadata?.pseudo || utilisateurConnecte.email.split("@");
    const { data: mesAvis } = await db.from("avis").select("*").eq("user_id", utilisateurConnecte.id);

    const totalMinutes = listeVus.reduce((acc, item) => acc + (item.runtime || 110), 0);
    const heures = Math.floor(totalMinutes / 60);
    const jours = (heures / 24).toFixed(1);

    const placeholderImg = "https://" + "://placeholder.com";
    const grilleVus = listeVus.length > 0 ? `
        <div class="similar-grid" style="margin-top:12px;">
            ${listeVus.map(v => {
                const img = v.poster_path ? IMG_POSTER + v.poster_path : placeholderImg;
                return `
                    <div class="similar-card" onclick="fermerModaleProfil(); ouvrirDetails(${v.tmdb_id}, '${v.media_type}')">
                        <img src="${img}" alt="${v.title}">
                        <p>${v.title}</p>
                    </div>
                `;
            }).join("")}
        </div>
    ` : `<p style="color:#64748b; font-size:0.9rem;">Tu n'as encore marqué aucun film ou série comme vu.</p>`;

    body.innerHTML = `
        <h2 style="font-size:1.6rem;">👤 Profil de <span style="color:#38bdf8;">${pseudo}</span></h2>
        <p style="color:#94a3b8; font-size:0.88rem;">Membre officiel de la communauté OùRegarder</p>

        <div class="profil-stats-grid">
            <div class="p-stat-card"><strong>${listeVus.length}</strong><span>Titres vus</span></div>
            <div class="p-stat-card"><strong>${heures}h</strong><span>Soit ${jours} jours</span></div>
            <div class="p-stat-card"><strong>${watchlist.length}</strong><span>Dans Ma Liste</span></div>
            <div class="p-stat-card"><strong>${mesAvis ? mesAvis.length : 0}</strong><span>Avis publiés</span></div>
        </div>

        <h3 style="font-size:1.1rem; margin-top:10px;">🎬 Historique de visionnage</h3>
        ${grilleVus}
    `;
}

function fermerModaleProfil(e) {
    if (!e || e.target.id === "profil-modal" || e.target.classList.contains("modal-close")) {
        document.getElementById("profil-modal").classList.add("hidden");
    }
}
// 10. LOGS VISITEURS & PARTAGE DIRECT SEO
async function enregistrerLog(action, detail = "") {
    try {
        const email = utilisateurConnecte ? utilisateurConnecte.email : "Visiteur anonyme";
        await db.from("logs_visites").insert([{ action, detail, user_email: email }]);
    } catch (e) {}
}

function partagerFiche(titre, id, type, bouton) {
    const urlPartage = `${window.location.origin}${window.location.pathname}?type=${type}&id=${id}`;
    navigator.clipboard.writeText(urlPartage);
    enregistrerLog("Partage lien", titre);
    const ancien = bouton.innerText;
    bouton.innerText = "✅ Lien copié !";
    setTimeout(() => { bouton.innerText = ancien; }, 2000);
}


// 9. INITIALISATION AU DÉMARRAGE
window.onload = async function() {
    const { data } = await db.auth.getSession();
    if (data && data.session) {
        utilisateurConnecte = data.session.user;
        majInterfaceUtilisateur();
        await chargerWatchlistCloud();
        await chargerVusCloud();
    }

    enregistrerLog("Visite du site", window.innerWidth < 768 ? "Mobile" : "PC");
    await chargerTendances();

    // Si quelqu'un arrive via un lien partagé (?type=movie&id=123)
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get("id");
    const sharedType = params.get("type") || "movie";
    if (sharedId) {
        ouvrirDetails(sharedId, sharedType);
    }
};

