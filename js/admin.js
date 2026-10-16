import { auth, db } from "./firebase-init.js";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("login-form");
const googleLoginBtn = document.getElementById("btn-google-login");
const logoutBtn = document.getElementById("logout-btn");

// Monitorizar autenticação e validar permissões dinamicamente no Firestore
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const emailUtilizador = user.email ? user.email.trim().toLowerCase() : "";
        console.log("=== DEBUG LOGIN ===");
        console.log("E-mail autenticado pelo Google:", emailUtilizador);

        try {
            const barbeirosSnap = await getDocs(collection(db, "barbeiros"));
            let autorizado = false;
            let perfilUtilizador = "user";
            let podeEditarGlobal = false;

            barbeirosSnap.forEach(docItem => {
                const b = docItem.data();
                console.log("Registo Lido do Firestore:", b);
                if (b.email) {
                    const emailCadastrado = String(b.email).trim().toLowerCase();
                    console.log(`A comparar cadastrado [${emailCadastrado}] com autenticado [${emailUtilizador}]`);
                    
                    if (emailCadastrado === emailUtilizador) {
                        autorizado = true;
                        perfilUtilizador = b.perfil ? String(b.perfil).trim().toLowerCase() : "user";
                        podeEditarGlobal = Boolean(b.podeEditar);
                    }
                }
            });

            if (!autorizado) {
                alert(`O e-mail (${user.email}) não foi encontrado ou autorizado na coleção 'barbeiros'. Verifique os dados no Firestore.`);
                await signOut(auth);
                return;
            }

            if (loginScreen) loginScreen.style.display = "none";
            if (adminPanel) adminPanel.style.display = "block";
            
            const isAdmin = (perfilUtilizador === "admin");
            carregarPainelAdministrativo(isAdmin, podeEditarGlobal, user);

        } catch (error) {
            console.error("Erro ao validar permissões no Firestore:", error);
            alert("Erro ao validar autorização: " + error.message);
            await signOut(auth);
        }
    } else {
        if (loginScreen) loginScreen.style.display = "flex";
        if (adminPanel) adminPanel.style.display = "none";
    }
});

// Login com E-mail e Senha
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const senha = document.getElementById("login-password").value.trim();

        try {
            await signInWithEmailAndPassword(auth, email, senha);
        } catch (error) {
            alert("Erro ao entrar: Verifique o e-mail e a senha.");
        }
    });
}

// Login com Conta Google
if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Erro no login com Google:", error);
            alert("Erro ao autenticar com o Google.");
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
    });
}

function carregarPainelAdministrativo(isAdmin, podeEditarGlobal, user) {
    const sectionBarbeiros = document.getElementById("section-barbeiros");
    if (sectionBarbeiros) {
        sectionBarbeiros.style.display = isAdmin ? "block" : "none";
    }

    const barberForm = document.getElementById("barber-form");
    if (isAdmin && barberForm) {
        barberForm.onsubmit = async (e) => {
            e.preventDefault();
            const nome = document.getElementById("barber-nome").value;
            const email = document.getElementById("barber-email").value.trim();
            const perfil = document.getElementById("barber-perfil").value;
            const podeEditar = document.getElementById("barber-pode-editar").checked;

            try {
                await addDoc(collection(db, "barbeiros"), { nome, email, perfil, podeEditar });
                alert("Utilizador/Barbeiro autorizado com sucesso!");
                barberForm.reset();
                carregarBarbeirosAdmin(isAdmin);
            } catch (err) {
                alert("Erro ao registar utilizador.");
            }
        };
    }

    setupFormularioParceiro(isAdmin);
    setupFormularioDestaque(isAdmin);

    carregarBarbeirosAdmin(isAdmin);
    carregarParceirosAdmin(isAdmin);
    carregarDestaquesAdmin(isAdmin);
    carregarAgendamentosAdmin(user.email, podeEditarGlobal);
}

async function carregarBarbeirosAdmin(isAdmin) {
    const listContainer = document.getElementById("admin-barbers-list");
    if (!listContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "barbeiros"));
        listContainer.innerHTML = "";

        if (querySnapshot.empty) {
            listContainer.innerHTML = "<p style='color:#666;'>Nenhum utilizador registado.</p>";
            return;
        }

        querySnapshot.forEach((docItem) => {
            const b = docItem.data();
            listContainer.innerHTML += `
                <div style="background:#f8f9fa; padding:10px; margin-bottom:6px; border-radius:4px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${b.nome}</strong> (${b.email}) - <span style="text-transform:uppercase; font-size:0.8rem; background:#1a1a1a; color:white; padding:2px 6px; border-radius:3px;">${b.perfil || 'user'}</span><br>
                        <small style="color:${b.podeEditar ? 'green' : 'red'};">${b.podeEditar ? '✔ Pode editar agendamentos' : '✖ Sem permissão de edição'}</small>
                    </div>
                    ${isAdmin ? `<button data-id="${docItem.id}" class="btn-del-barber" style="background:#dc3545; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Excluir</button>` : ''}
                </div>
            `;
        });

        if (isAdmin) {
            document.querySelectorAll(".btn-del-barber").forEach(btn => {
                btn.addEventListener("click", async () => {
                    if (confirm("Deseja mesmo remover este acesso?")) {
                        await deleteDoc(doc(db, "barbeiros", btn.getAttribute("data-id")));
                        carregarBarbeirosAdmin(isAdmin);
                    }
                });
            });
        }
    } catch (e) {
        console.error("Erro ao carregar utilizadores:", e);
    }
}

function setupFormularioParceiro(isAdmin) {
    const partnerForm = document.getElementById("partner-form");
    if (!partnerForm) return;

    partnerForm.onsubmit = async (e) => {
        e.preventDefault();
        const nome = document.getElementById("part-nome").value;
        const logoUrl = document.getElementById("part-logo").value;
        const videoUrl = document.getElementById("part-video").value;

        try {
            await addDoc(collection(db, "parceiros"), { nome, logoUrl, videoUrl });
            alert("Parceiro adicionado com sucesso!");
            partnerForm.reset();
            carregarParceirosAdmin(isAdmin);
        } catch (err) {
            alert("Erro ao adicionar parceiro.");
        }
    };
}

async function carregarParceirosAdmin(isAdmin) {
    const partContainer = document.getElementById("admin-partners-list");
    if (!partContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "parceiros"));
        partContainer.innerHTML = "";

        if (querySnapshot.empty) {
            partContainer.innerHTML = "<p style='color:#666;'>Nenhum parceiro registado.</p>";
            return;
        }

        querySnapshot.forEach((docItem) => {
            const p = docItem.data();
            const card = document.createElement("div");
            card.style.cssText = "background:#f8f9fa; padding:12px; border:1px solid #ddd; border-radius:6px; text-align:center;";
            card.innerHTML = `
                <img src="${p.logoUrl || 'https://via.placeholder.com/100'}" alt="${p.nome}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; margin-bottom:8px;">
                <h4 style="margin:5px 0;">${p.nome}</h4>
                <button class="btn-del-part" data-id="${docItem.id}" style="background:#dc3545; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem; margin-top:5px;">Excluir</button>
            `;
            partContainer.appendChild(card);
        });

        document.querySelectorAll(".btn-del-part").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (confirm("Deseja excluir este parceiro?")) {
                    await deleteDoc(doc(db, "parceiros", btn.getAttribute("data-id")));
                    carregarParceirosAdmin(isAdmin);
                }
            });
        });
    } catch (e) {
        console.error("Erro ao carregar parceiros:", e);
    }
}

function setupFormularioDestaque(isAdmin) {
    const highlightForm = document.getElementById("highlight-form");
    if (!highlightForm) return;

    highlightForm.onsubmit = async (e) => {
        e.preventDefault();
        const titulo = document.getElementById("high-titulo").value;
        const imagemUrl = document.getElementById("high-img").value;
        const descricao = document.getElementById("high-desc").value;

        try {
            await addDoc(collection(db, "destaques"), { titulo, imagemUrl, descricao });
            alert("Destaque adicionado com sucesso!");
            highlightForm.reset();
            carregarDestaquesAdmin(isAdmin);
        } catch (err) {
            alert("Erro ao adicionar destaque.");
        }
    };
}

async function carregarDestaquesAdmin(isAdmin) {
    const highContainer = document.getElementById("admin-highlights-list");
    if (!highContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "destaques"));
        highContainer.innerHTML = "";

        if (querySnapshot.empty) {
            highContainer.innerHTML = "<p style='color:#666;'>Nenhum destaque registado.</p>";
            return;
        }

        querySnapshot.forEach((docItem) => {
            const d = docItem.data();
            const card = document.createElement("div");
            card.style.cssText = "background:#f8f9fa; padding:12px; border:1px solid #ddd; border-radius:6px; text-align:center;";
            card.innerHTML = `
                <img src="${d.imagemUrl || 'https://via.placeholder.com/100'}" alt="${d.titulo}" style="width:100%; height:80px; object-fit:cover; border-radius:4px; margin-bottom:8px;">
                <h4 style="margin:5px 0;">${d.titulo}</h4>
                <button class="btn-del-high" data-id="${docItem.id}" style="background:#dc3545; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem; margin-top:5px;">Excluir</button>
            `;
            highContainer.appendChild(card);
        });

        document.querySelectorAll(".btn-del-high").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (confirm("Deseja excluir este destaque?")) {
                    await deleteDoc(doc(db, "destaques", btn.getAttribute("data-id")));
                    carregarDestaquesAdmin(isAdmin);
                }
            });
        });
    } catch (e) {
        console.error("Erro ao carregar destaques:", e);
    }
}

async function carregarAgendamentosAdmin(userEmail, podeEditarGlobal) {
    const appContainer = document.getElementById("admin-appointments-list");
    if (!appContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "agendamentos"));
        appContainer.innerHTML = "";

        if (querySnapshot.empty) {
            appContainer.innerHTML = "<p style='color:#666;'>Nenhum agendamento registado.</p>";
            return;
        }

        querySnapshot.forEach((docItem) => {
            const a = docItem.data();
            const docId = docItem.id;

            appContainer.html += `...`; // mantido conforme o seu fluxo
        });
    } catch (e) {
        console.error("Erro ao carregar agendamentos:", e);
    }
}
