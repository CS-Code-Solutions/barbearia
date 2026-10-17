import { auth, db } from "./firebase-init.js";
import { 
    signInWithEmailAndPassword, 
    signInWithRedirect, 
    getRedirectResult, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    doc, 
    updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Referências de elementos do DOM
const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("login-form");
const googleLoginBtn = document.getElementById("btn-google-login");
const logoutBtn = document.getElementById("logout-btn");

// 1. Tratar o resultado após o redirecionamento da Conta Google
getRedirectResult(auth).catch((error) => {
    console.error("Erro no redirecionamento do Google:", error);
    alert("Ocorreu um erro ao tentar iniciar sessão com o Google.");
});

// 2. Monitorizar autenticação e validar utilizador no Firestore
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const emailUtilizador = user.email ? user.email.trim().toLowerCase() : "";
        console.log("Tentativa de login com o e-mail:", emailUtilizador);

        try {
            const barbeirosRef = collection(db, "barbeiros");
            const barbeirosSnap = await getDocs(barbeirosRef);
            
            let autorizado = false;
            let perfilUtilizador = "padrao";
            let podeEditarGlobal = false;

            barbeirosSnap.forEach(docItem => {
                const b = docItem.data();
                if (b.email) {
                    const emailCadastrado = String(b.email).trim().toLowerCase();
                    if (emailCadastrado === emailUtilizador) {
                        autorizado = true;
                        perfilUtilizador = b.perfil ? String(b.perfil).trim().toLowerCase() : "admin";
                        podeEditarGlobal = b.podeEditar !== undefined ? Boolean(b.podeEditar) : true;
                    }
                }
            });

            if (!autorizado) {
                alert(`Acesso negado. O e-mail (${user.email}) não está autorizado.`);
                await signOut(auth);
                return;
            }

            // Alternar ecrãs
            if (loginScreen) loginScreen.style.display = "none";
            if (adminPanel) adminPanel.style.display = "block";
            
            const isAdmin = (perfilUtilizador === "admin");
            carregarPainelAdministrativo(isAdmin, podeEditarGlobal, user);

        } catch (error) {
            console.error("Erro ao consultar o Firestore:", error);
            alert("Erro ao validar autorização na base de dados: " + error.message);
            await signOut(auth);
        }
    } else {
        // Utilizador não autenticado
        if (loginScreen) loginScreen.style.display = "flex";
        if (adminPanel) adminPanel.style.display = "none";
    }
});

// 3. Login com E-mail e Senha
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById("login-email");
        const senhaInput = document.getElementById("login-password");
        
        if (!emailInput || !senhaInput) return;

        const email = emailInput.value.trim();
        const senha = senhaInput.value.trim();

        try {
            await signInWithEmailAndPassword(auth, email, senha);
        } catch (error) {
            console.error("Erro no login tradicional:", error);
            alert("Erro ao entrar: Verifique as suas credenciais.");
        }
    });
}

// 4. Login com Conta Google via Redirecionamento
if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithRedirect(auth, provider);
        } catch (error) {
            console.error("Erro ao redirecionar para o Google:", error);
            alert("Erro ao iniciar sessão com o Google.");
        }
    });
}

// 5. Logout
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        if (confirm("Tem a certeza que deseja terminar a sessão?")) {
            await signOut(auth);
        }
    });
}

// 6. Configuração Central do Painel Administrativo
function carregarPainelAdministrativo(isAdmin, podeEditarGlobal, user) {
    const sectionBarbeiros = document.getElementById("section-barbeiros");
    if (sectionBarbeiros) {
        sectionBarbeiros.style.display = isAdmin ? "block" : "none";
    }

    // Formulário de registo de Barbeiros (Visível apenas para admins)
    const barberForm = document.getElementById("barber-form");
    if (isAdmin && barberForm) {
        barberForm.onsubmit = async (e) => {
            e.preventDefault();
            const nome = document.getElementById("barber-nome")?.value.trim() || "";
            const email = document.getElementById("barber-email")?.value.trim().toLowerCase() || "";
            const perfil = document.getElementById("barber-perfil")?.value || "admin";
            const podeEditar = document.getElementById("barber-pode-editar")?.checked || false;

            if (!email) {
                alert("O e-mail é obrigatório.");
                return;
            }

            try {
                await addDoc(collection(db, "barbeiros"), { nome, email, perfil, podeEditar });
                alert("Utilizador autorizado com sucesso!");
                barberForm.reset();
                carregarBarbeirosAdmin(isAdmin);
            } catch (err) {
                console.error("Erro ao adicionar barbeiro:", err);
                alert("Erro ao registar utilizador.");
            }
        };
    }

    // Configurar os outros formulários
    setupFormularioServico(isAdmin);
    setupFormularioParceiro(isAdmin);
    setupFormularioDestaque(isAdmin);

    // Carregar dados nas listas
    carregarBarbeirosAdmin(isAdmin);
    carregarServicosAdmin();
    carregarParceirosAdmin(isAdmin);
    carregarDestaquesAdmin(isAdmin);
    carregarAgendamentosAdmin(user.email, podeEditarGlobal);
}

// ---------------------------------------------------------
// MÓDULO: BARBEIROS / UTILIZADORES
// ---------------------------------------------------------
async function carregarBarbeirosAdmin(isAdmin) {
    const listContainer = document.getElementById("admin-barbers-list");
    if (!listContainer) return;

    listContainer.innerHTML = "<p>A carregar utilizadores...</p>";

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
                        <strong>${b.nome || 'Utilizador'}</strong> (${b.email}) 
                        - <span style="text-transform:uppercase; font-size:0.8rem; background:#1a1a1a; color:white; padding:2px 6px; border-radius:3px;">${b.perfil || 'admin'}</span><br>
                        <small style="color:${b.podeEditar !== false ? 'green' : 'red'};">
                            ${b.podeEditar !== false ? '✔ Pode editar agendamentos' : '✖ Sem permissão de edição'}
                        </small>
                    </div>
                    ${isAdmin ? `<button data-id="${docItem.id}" class="btn-del-barber" style="background:#dc3545; color:#fff; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">Remover</button>` : ''}
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
        listContainer.innerHTML = "<p style='color:red;'>Erro ao carregar a lista de utilizadores.</p>";
    }
}

// ---------------------------------------------------------
// MÓDULO: SERVIÇOS
// ---------------------------------------------------------
function setupFormularioServico(isAdmin) {
    if (!isAdmin) return;
    const serviceForm = document.getElementById("service-form");
    if (!serviceForm) return;

    serviceForm.onsubmit = async (e) => {
        e.preventDefault();
        const nome = document.getElementById("serv-nome")?.value || "";
        const imagemUrl = document.getElementById("serv-img")?.value || "";
        const preco = document.getElementById("serv-preco")?.value || "";
        const descricao = document.getElementById("serv-desc")?.value || "";
        const tempoCarrossel = document.getElementById("serv-tempo")?.value || 4;

        try {
            await addDoc(collection(db, "servicos"), { nome, imagemUrl, preco, descricao, tempoCarrossel });
            alert("Serviço adicionado com sucesso!");
            serviceForm.reset();
            carregarServicosAdmin();
        } catch (err) {
            console.error("Erro ao adicionar serviço:", err);
            alert("Erro ao adicionar serviço.");
        }
    };
}

async function carregarServicosAdmin() {
    const listContainer = document.getElementById("admin-services-list");
    if (!listContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        listContainer.innerHTML = "";

        if (querySnapshot.empty) {
            listContainer.innerHTML = "<p style='color:#666;'>Nenhum serviço registado.</p>";
            return;
        }

        querySnapshot.forEach((docItem) => {
            const s = docItem.data();
            listContainer.innerHTML += `
                <div style="background:#f8f9fa; padding:12px; border:1px solid #ddd; border-radius:6px; text-align:center;">
                    <img src="${s.imagemUrl || 'https://via.placeholder.com/100'}" alt="${s.nome}" style="width:100%; height:80px; object-fit:cover; border-radius:4px; margin-bottom:8px;">
                    <h4 style="margin:5px 0; font-size:1rem;">${s.nome} - €${s.preco}</h4>
                    <button class="btn-del-service" data-id="${docItem.id}" style="background:#dc3545; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem; margin-top:5px; width:100%;">Excluir</button>
                </div>
            `;
        });

        document.querySelectorAll(".btn-del-service").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (confirm("Deseja excluir este serviço permanentemente?")) {
                    await deleteDoc(doc(db, "servicos", btn.getAttribute("data-id")));
                    carregarServicosAdmin();
                }
            });
        });
    } catch (e) {
        console.error("Erro ao carregar serviços:", e);
    }
}

// ---------------------------------------------------------
// MÓDULO: PARCEIROS
// ---------------------------------------------------------
function setupFormularioParceiro(isAdmin) {
    if (!isAdmin) return;
    const partnerForm = document.getElementById("partner-form");
    if (!partnerForm) return;

    partnerForm.onsubmit = async (e) => {
        e.preventDefault();
        const nome = document.getElementById("part-nome")?.value || "";
        const logoUrl = document.getElementById("part-logo")?.value || "";
        const videoUrl = document.getElementById("part-video")?.value || "";

        try {
            await addDoc(collection(db, "parceiros"), { nome, logoUrl, videoUrl });
            alert("Parceiro adicionado com sucesso!");
            partnerForm.reset();
            carregarParceirosAdmin(isAdmin);
        } catch (err) {
            console.error("Erro ao adicionar parceiro:", err);
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
            partContainer.innerHTML += `
                <div style="background:#f8f9fa; padding:12px; border:1px solid #ddd; border-radius:6px; text-align:center;">
                    <img src="${p.logoUrl || 'https://via.placeholder.com/100'}" alt="${p.nome}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; margin-bottom:8px;">
                    <h4 style="margin:5px 0;">${p.nome}</h4>
                    <button class="btn-del-part" data-id="${docItem.id}" style="background:#dc3545; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem; margin-top:5px; width:100%;">Excluir</button>
                </div>
            `;
        });

        if(isAdmin) {
            document.querySelectorAll(".btn-del-part").forEach(btn => {
                btn.addEventListener("click", async () => {
                    if (confirm("Deseja excluir este parceiro?")) {
                        await deleteDoc(doc(db, "parceiros", btn.getAttribute("data-id")));
                        carregarParceirosAdmin(isAdmin);
                    }
                });
            });
        }
    } catch (e) {
        console.error("Erro ao carregar parceiros:", e);
    }
}

// ---------------------------------------------------------
// MÓDULO: DESTAQUES
// ---------------------------------------------------------
function setupFormularioDestaque(isAdmin) {
    if (!isAdmin) return;
    const highlightForm = document.getElementById("highlight-form");
    if (!highlightForm) return;

    highlightForm.onsubmit = async (e) => {
        e.preventDefault();
        const titulo = document.getElementById("high-titulo")?.value || "";
        const imagemUrl = document.getElementById("high-img")?.value || "";
        const descricao = document.getElementById("high-desc")?.value || "";

        try {
            await addDoc(collection(db, "destaques"), { titulo, imagemUrl, descricao });
            alert("Destaque adicionado com sucesso!");
            highlightForm.reset();
            carregarDestaquesAdmin(isAdmin);
        } catch (err) {
            console.error("Erro ao adicionar destaque:", err);
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
            highContainer.innerHTML += `
                <div style="background:#f8f9fa; padding:12px; border:1px solid #ddd; border-radius:6px; text-align:center;">
                    <img src="${d.imagemUrl || 'https://via.placeholder.com/100'}" alt="${d.titulo}" style="width:100%; height:80px; object-fit:cover; border-radius:4px; margin-bottom:8px;">
                    <h4 style="margin:5px 0;">${d.titulo}</h4>
                    <button class="btn-del-high" data-id="${docItem.id}" style="background:#dc3545; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem; margin-top:5px; width:100%;">Excluir</button>
                </div>
            `;
        });

        if(isAdmin) {
            document.querySelectorAll(".btn-del-high").forEach(btn => {
                btn.addEventListener("click", async () => {
                    if (confirm("Deseja excluir este destaque?")) {
                        await deleteDoc(doc(db, "destaques", btn.getAttribute("data-id")));
                        carregarDestaquesAdmin(isAdmin);
                    }
                });
            });
        }
    } catch (e) {
        console.error("Erro ao carregar destaques:", e);
    }
}

// ---------------------------------------------------------
// MÓDULO: AGENDAMENTOS
// ---------------------------------------------------------
async function carregarAgendamentosAdmin(userEmail, podeEditarGlobal) {
    const appContainer = document.getElementById("admin-appointments-list");
    if (!appContainer) return;

    appContainer.innerHTML = "<p>A carregar agendamentos...</p>";

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

            // Formatação amigável de Data e Hora
            let dataFormatada = a.dataHora;
            if (a.dataHora && a.dataHora.includes('T')) {
                const [dataParte, horaParte] = a.dataHora.split('T');
                const [ano, mes, dia] = dataParte.split('-');
                dataFormatada = `${dia}/${mes}/${ano} às ${horaParte}`;
            }

            appContainer.innerHTML += `
                <div style="background:#fff; border-left: 4px solid #d4af37; padding: 12px; margin-bottom: 12px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" id="agendamento-${docId}">
                    <strong>Cliente:</strong> ${a.clienteNome || 'N/A'} <br>
                    <strong>Contacto:</strong> ${a.clienteTelefone || 'N/A'} <br>
                    <strong>Serviço:</strong> ${a.servicoNome || 'N/A'} <br>
                    <strong>Barbeiro:</strong> ${a.barbeiroNome || 'Qualquer'} <br>
                    <strong>Data/Hora:</strong> <span style="font-weight:bold; color:#1a1a1a;">${dataFormatada}</span><br>
                    <strong>Código Reserva:</strong> <span style="background:#eee; padding:2px 4px; border-radius:3px;">${a.codigoUnico || 'N/A'}</span><br>
                    
                    ${podeEditarGlobal ? `
                    <div style="margin-top:12px; display:flex; gap:10px; align-items:center;">
                        <input type="datetime-local" id="novo-dh-${docId}" class="edit-dh-input" style="padding:6px; border:1px solid #ccc; border-radius:4px; flex:1;" value="${a.dataHora}">
                        <button class="btn-editar-dh" data-id="${docId}" style="background:#ffc107; color:#1a1a1a; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Reagendar</button>
                    </div>
                    ` : '<p style="font-size:0.85rem; color:#888; margin-top:8px;">A sua conta não tem permissão para alterar horários.</p>'}
                </div>
            `;
        });

        if (podeEditarGlobal) {
            document.querySelectorAll(".btn-editar-dh").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const id = btn.getAttribute("data-id");
                    const novoInput = document.getElementById(`novo-dh-${id}`).value;

                    if (!novoInput) {
                        alert("Selecione a nova data e horário.");
                        return;
                    }

                    try {
                        btn.innerText = "A guardar...";
                        btn.disabled = true;
                        await updateDoc(doc(db, "agendamentos", id), { dataHora: novoInput });
                        alert("Horário reagendado com sucesso!");
                        carregarAgendamentosAdmin(userEmail, podeEditarGlobal);
                    } catch (err) {
                        console.error("Erro ao atualizar horário:", err);
                        alert("Erro ao atualizar o horário no sistema.");
                        btn.innerText = "Reagendar";
                        btn.disabled = false;
                    }
                });
            });
        }
    } catch (e) {
        console.error("Erro ao carregar agendamentos:", e);
        appContainer.innerHTML = "<p style='color:red;'>Erro ao carregar agendamentos do sistema.</p>";
    }
}
