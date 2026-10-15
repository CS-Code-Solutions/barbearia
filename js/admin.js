import { auth, db } from "./firebase-init.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");

// Monitorar autenticação e definir permissões por perfil
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (loginScreen) loginScreen.style.display = "none";
        if (adminPanel) adminPanel.style.display = "block";
        
        // Verificar se o utilizador é Admin ou Barbeiro (com base no e-mail ou custom claims)
        const emailUtilizador = user.email;
        const isAdmin = emailUtilizador.includes("admin") || emailUtilizador === "cristian@barbearia.com"; // Ajuste o seu e-mail de admin aqui
        
        carregarPainelAdministrativo(isAdmin);
    } else {
        if (loginScreen) loginScreen.style.display = "flex";
        if (adminPanel) adminPanel.style.display = "none";
    }
});

// Ação de Login
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

// Ação de Logout
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
    });
}

// Carregar Dados e Funcionalidades do Painel Admin
async function carregarPainelAdministrativo(isAdmin) {
    const painelContainer = document.getElementById("admin-panel");
    
    // Injetar estrutura completa de gestão no painel se ainda não existir
    painelContainer.innerHTML = `
        <div class="admin-header">
            <h2>Painel da Barbearia (${isAdmin ? 'Administrador' : 'Barbeiro'})</h2>
            <button id="logout-btn-real" class="btn-logout">Sair</button>
        </div>

        ${isAdmin ? `
        <div class="admin-section">
            <h3>Cadastrar Novo Serviço</h3>
            <form id="service-form">
                <input type="text" id="serv-nome" placeholder="Nome do Serviço (ex: Corte Degradê)" required style="width:100%; padding:10px; margin:5px 0;">
                <input type="text" id="serv-desc" placeholder="Descrição curta" required style="width:100%; padding:10px; margin:5px 0;">
                <input type="text" id="serv-preco" placeholder="Preço (ex: 45.00)" required style="width:100%; padding:10px; margin:5px 0;">
                <button type="submit" style="background:#1a1a1a; color:#fff; padding:10px 20px; border:none; border-radius:4px; cursor:pointer; margin-top:10px;">Adicionar Serviço</button>
            </form>
        </div>
        ` : ''}

        <div class="admin-section">
            <h3>Lista de Serviços (Arraste para reordenar)</h3>
            <div id="admin-services-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
        </div>

        <div class="admin-section">
            <h3>Agendamentos Confirmados</h3>
            <div id="admin-appointments-list">A carregar agendamentos...</div>
        </div>
    `;

    // Reatribuir evento de logout
    document.getElementById("logout-btn-real").addEventListener("click", async () => {
        await signOut(auth);
    });

    // Se for admin, permitir criar serviços
    if (isAdmin) {
        const serviceForm = document.getElementById("service-form");
        serviceForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const nome = document.getElementById("serv-nome").value;
            const descricao = document.getElementById("serv-desc").value;
            const preco = document.getElementById("serv-preco").value;

            try {
                await addDoc(collection(db, "servicos"), { nome, descricao, preco });
                alert("Serviço adicionado com sucesso!");
                serviceForm.reset();
                carregarPainelAdministrativo(isAdmin);
            } catch (err) {
                alert("Erro ao adicionar serviço.");
            }
        });
    }

    // Carregar e listar serviços com Arrastar e Soltar (Drag and Drop)
    carregarServicosAdmin(isAdmin);
    carregarAgendamentosAdmin();
}

async function carregarServicosAdmin(isAdmin) {
    const listContainer = document.getElementById("admin-services-list");
    if (!listContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        listContainer.innerHTML = "";

        querySnapshot.forEach((docItem) => {
            const s = docItem.data();
            const itemDiv = document.createElement("div");
            itemDiv.className = "admin-item";
            itemDiv.setAttribute("draggable", "true");
            itemDiv.style.cssText = "background: #f8f9fa; padding: 12px; border: 1px solid #ddd; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; cursor: grab;";
            
            itemDiv.innerHTML = `
                <div>
                    <strong>${s.nome || s.Nome || 'Serviço'}</strong> - R$ ${s.preco || '0.00'}
                    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #666;">${s.descricao || ''}</p>
                </div>
                ${isAdmin ? `<button data-id="${docItem.id}" class="btn-delete-serv" style="background:#dc3545; color:#white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Excluir</button>` : ''}
            `;

            // Lógica de Drag and Drop
            itemDiv.addEventListener("dragstart", () => {
                itemDiv.classList.add("dragging");
            });
            itemDiv.addEventListener("dragend", () => {
                itemDiv.classList.remove("dragging");
            });

            listContainer.appendChild(itemDiv);

            // Botão excluir (apenas para Admin)
            if (isAdmin) {
                itemDiv.querySelector(".btn-delete-serv").addEventListener("click", async () => {
                    if (confirm("Deseja mesmo excluir este serviço?")) {
                        await deleteDoc(doc(db, "servicos", docItem.id));
                        carregarServicosAdmin(isAdmin);
                    }
                });
            }
        });

        // Evento global para reposicionar os itens ao arrastar
        listContainer.addEventListener("dragover", (e) => {
            e.preventDefault();
            const draggingItem = document.querySelector(".dragging");
            const siblings = [...listContainer.querySelectorAll(".admin-item:not(.dragging)")];
            
            const nextSibling = siblings.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = e.clientY - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: NegativeInfinity = Number.NEGATIVE_INFINITY }).element;

            if (nextSibling == null) {
                listContainer.appendChild(draggingItem);
            } else {
                listContainer.insertBefore(draggingItem, nextSibling);
            }
        });

    } catch (e) {
        console.error("Erro ao carregar serviços no admin:", e);
    }
}

async function carregarAgendamentosAdmin() {
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
            appContainer.innerHTML += `
                <div style="background:#fff; border-left: 4px solid #d4af37; padding: 10px; margin-bottom: 8px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <strong>Cliente:</strong> ${a.clienteNome} (${a.clienteTelefone})<br>
                    <strong>Data/Hora:</strong> ${a.dataHora.replace('T', ' às ')}<br>
                    <strong>Origem:</strong> ${a.origem || 'Site'}
                </div>
            `;
        });
    } catch (e) {
        console.error("Erro ao carregar agendamentos:", e);
    }
}
