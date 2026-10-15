import { auth, db } from "./firebase-init.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (loginScreen) loginScreen.style.display = "none";
        if (adminPanel) adminPanel.style.display = "block";
        
        const emailUtilizador = user.email;
        const isAdmin = emailUtilizador.includes("admin") || emailUtilizador === "cristian@barbearia.com";
        
        carregarPainelAdministrativo(isAdmin, user);
    } else {
        if (loginScreen) loginScreen.style.display = "flex";
        if (adminPanel) adminPanel.style.display = "none";
    }
});

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

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
    });
}

function carregarPainelAdministrativo(isAdmin, user) {
    const painelContainer = document.getElementById("admin-panel");
    
    painelContainer.innerHTML = `
        <div class="admin-header">
            <h2>Painel da Barbearia (${isAdmin ? 'Administrador' : 'Barbeiro'})</h2>
            <button id="logout-btn-real" class="btn-logout">Sair</button>
        </div>

        ${isAdmin ? `
        <div class="admin-section">
            <h3>Cadastrar Barbeiro e Permissões</h3>
            <form id="barber-form">
                <input type="text" id="barber-nome" placeholder="Nome do Barbeiro" required style="width:100%; padding:10px; margin:5px 0; border:1px solid #ccc; border-radius:4px;">
                <input type="email" id="barber-email" placeholder="E-mail de Acesso" required style="width:100%; padding:10px; margin:5px 0; border:1px solid #ccc; border-radius:4px;">
                <label style="display:block; margin:10px 0; font-size:0.9rem;">
                    <input type="checkbox" id="barber-pode-editar" checked> Permitir que este barbeiro edite horários agendados
                </label>
                <button type="submit" style="background:#1a1a1a; color:#fff; padding:10px 20px; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">Cadastrar Barbeiro</button>
            </form>
        </div>
        ` : ''}

        <div class="admin-section">
            <h3>Barbeiros Registados</h3>
            <div id="admin-barbers-list">A carregar barbeiros...</div>
        </div>

        <div class="admin-section">
            <h3>Agendamentos Confirmados (Gestão e Edição)</h3>
            <div id="admin-appointments-list">A carregar agendamentos...</div>
        </div>
    `;

    document.getElementById("logout-btn-real").addEventListener("click", async () => {
        await signOut(auth);
    });

    if (isAdmin) {
        const barberForm = document.getElementById("barber-form");
        barberForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const nome = document.getElementById("barber-nome").value;
            const email = document.getElementById("barber-email").value;
            const podeEditar = document.getElementById("barber-pode-editar").checked;

            try {
                await addDoc(collection(db, "barbeiros"), { nome, email, podeEditar });
                alert("Barbeiro cadastrado com sucesso!");
                barberForm.reset();
                carregarBarbeirosAdmin(isAdmin);
            } catch (err) {
                alert("Erro ao cadastrar barbeiro.");
            }
        });
    }

    carregarBarbeirosAdmin(isAdmin);
    carregarAgendamentosAdmin(user.email, isAdmin);
}

async function carregarBarbeirosAdmin(isAdmin) {
    const listContainer = document.getElementById("admin-barbers-list");
    if (!listContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "barbeiros"));
        listContainer.innerHTML = "";

        if (querySnapshot.empty) {
            listContainer.innerHTML = "<p style='color:#666;'>Nenhum barbeiro registado.</p>";
            return;
        }

        querySnapshot.forEach((docItem) => {
            const b = docItem.data();
            listContainer.innerHTML += `
                <div style="background:#f8f9fa; padding:10px; margin-bottom:6px; border-radius:4px; border:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${b.nome}</strong> (${b.email})<br>
                        <small style="color:${b.podeEditar ? 'green' : 'red'};">${b.podeEditar ? '✔ Pode editar agendamentos' : '✖ Sem permissão de edição'}</small>
                    </div>
                    ${isAdmin ? `<button data-id="${docItem.id}" class="btn-del-barber" style="background:#dc3545; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">Excluir</button>` : ''}
                </div>
            `;
        });
    } catch (e) {
        console.error("Erro ao carregar barbeiros:", e);
    }
}

async function carregarAgendamentosAdmin(userEmail, isAdmin) {
    const appContainer = document.getElementById("admin-appointments-list");
    if (!appContainer) return;

    try {
        // Verificar permissão de edição do utilizador logado caso não seja admin
        let podeEditarGlobal = isAdmin;
        if (!isAdmin) {
            const barbeirosSnap = await getDocs(collection(db, "barbeiros"));
            barbeirosSnap.forEach(docItem => {
                const b = docItem.data();
                if (b.email === userEmail && b.podeEditar) {
                    podeEditarGlobal = true;
                }
            });
        }

        const querySnapshot = await getDocs(collection(db, "agendamentos"));
        appContainer.innerHTML = "";

        if (querySnapshot.empty) {
            appContainer.innerHTML = "<p style='color:#666;'>Nenhum agendamento registado.</p>";
            return;
        }

        querySnapshot.forEach((docItem) => {
            const a = docItem.data();
            const docId = docItem.id;

            appContainer.innerHTML += `
                <div style="background:#fff; border-left: 4px solid #d4af37; padding: 12px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" id="agendamento-${docId}">
                    <strong>Cliente:</strong> ${a.clienteNome} (${a.clienteTelefone})<br>
                    <strong>Barbeiro:</strong> ${a.barbeiroNome || 'Qualquer'} <br>
                    <strong>Data/Hora:</strong> <span id="dh-texto-${docId}">${a.dataHora.replace('T', ' às ')}</span><br>
                    <strong>Código:</strong> ${a.codigoUnico || 'N/A'}<br>
                    
                    ${podeEditarGlobal ? `
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <input type="datetime-local" id="novo-dh-${docId}" style="padding:6px; border:1px solid #ccc; border-radius:4px; flex:1;">
                        <button class="btn-editar-dh" data-id="${docId}" style="background:#ffc107; color:#1a1a1a; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Alterar Horário</button>
                    </div>
                    ` : '<p style="font-size:0.8rem; color:#888; margin-top:5px;">A sua conta não tem permissão para editar horários.</p>'}
                </div>
            `;
        });

        // Adicionar eventos de alteração de horário se tiver permissão
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
                        // Formatar para o padrão YYYY-MM-DDTHH:mm
                        await updateDoc(doc(db, "agendamentos", id), { dataHora: novoInput });
                        alert("Horário reagendado com sucesso pelo painel!");
                        carregarAgendamentosAdmin(userEmail, isAdmin);
                    } catch (err) {
                        alert("Erro ao atualizar horário.");
                    }
                });
            });
        }

    } catch (e) {
        console.error("Erro ao carregar agendamentos:", e);
    }
}
