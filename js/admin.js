import { db } from "./firebase-init.js";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log("admin.js iniciado com sucesso!");

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM totalmente carregado. A iniciar painel...");
    
    // Força o carregamento direto
    carregarAgendamentosAdmin();
    carregarServicosAdmin();
    carregarParceirosAdmin();
    carregarDestaquesAdmin();
    carregarBarbeirosAdmin();
});

async function carregarAgendamentosAdmin() {
    const appContainer = document.getElementById("admin-appointments-list");
    if (!appContainer) {
        console.error("Elemento 'admin-appointments-list' não encontrado no HTML!");
        return;
    }

    appContainer.innerHTML = "<p style='color:#007bff;'>A carregar agendamentos do Firestore...</p>";

    try {
        const querySnapshot = await getDocs(collection(db, "agendamentos"));
        appContainer.innerHTML = "";

        if (querySnapshot.empty) {
            appContainer.innerHTML = "<p style='color:#666;'>Nenhum agendamento registado na base de dados.</p>";
            return;
        }

        querySnapshot.forEach((docItem) => {
            const a = docItem.data();
            const docId = docItem.id;
            const dataHoraOriginal = a.dataHora || '';
            const dataHoraTexto = dataHoraOriginal ? dataHoraOriginal.replace('T', ' às ') : 'Data não definida';

            appContainer.innerHTML += `
                <div style="background:#fff; border-left: 4px solid #d4af37; padding: 12px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" id="agendamento-${docId}">
                    <strong>Cliente:</strong> ${a.clienteNome || 'Cliente'} (${a.clienteTelefone || ''})<br>
                    <strong>Barbeiro:</strong> ${a.barbeiroNome || 'Qualquer'} <br>
                    <strong>Data/Hora:</strong> ${dataHoraTexto}<br>
                    <strong>Código:</strong> ${a.codigoUnico || 'N/A'}<br>
                    
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <input type="datetime-local" id="novo-dh-${docId}" value="${dataHoraOriginal}" style="padding:6px; border:1px solid #ccc; border-radius:4px; flex:1;">
                        <button class="btn-editar-dh" data-id="${docId}" style="background:#ffc107; color:#1a1a1a; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Alterar Horário</button>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll(".btn-editar-dh").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const novoInput = document.getElementById(`novo-dh-${id}`).value;

                if (!novoInput) {
                    alert("Selecione a nova data e horário.");
                    return;
                }

                try {
                    await updateDoc(doc(db, "agendamentos", id), { dataHora: novoInput });
                    alert("Horário reagendado com sucesso!");
                    carregarAgendamentosAdmin();
                } catch (err) {
                    alert("Erro ao atualizar horário: " + err.message);
                }
            });
        });

    } catch (e) {
        console.error("Erro crítico ao carregar agendamentos:", e);
        appContainer.innerHTML = `<p style='color:red; font-weight:bold;'>Erro ao carregar agendamentos: ${e.message}</p>`;
    }
}

async function carregarServicosAdmin() {
    const listContainer = document.getElementById("admin-services-list");
    if (!listContainer) return;
    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        listContainer.innerHTML = querySnapshot.empty ? "<p style='color:#666;'>Nenhum serviço registado.</p>" : "";
        querySnapshot.forEach((docItem) => {
            const s = docItem.data();
            listContainer.innerHTML += `<div style="background:#f8f9fa; padding:12px; border:1px solid #ddd; border-radius:6px; text-align:center;"><h4>${s.nome} - R$ ${s.preco}</h4></div>`;
        });
    } catch (e) { console.error(e); }
}

async function carregarParceirosAdmin() {
    const partContainer = document.getElementById("admin-partners-list");
    if (!partContainer) return;
    try {
        const querySnapshot = await getDocs(collection(db, "parceiros"));
        partContainer.innerHTML = querySnapshot.empty ? "<p style='color:#666;'>Nenhum parceiro registado.</p>" : "";
        querySnapshot.forEach((docItem) => {
            const p = docItem.data();
            partContainer.innerHTML += `<div style="background:#f8f9fa; padding:12px; border:1px solid #ddd; border-radius:6px; text-align:center;"><h4>${p.nome}</h4></div>`;
        });
    } catch (e) { console.error(e); }
}

async function carregarDestaquesAdmin() {
    const highContainer = document.getElementById("admin-highlights-list");
    if (!highContainer) return;
    try {
        const querySnapshot = await getDocs(collection(db, "destaques"));
        highContainer.innerHTML = querySnapshot.empty ? "<p style='color:#666;'>Nenhum destaque registado.</p>" : "";
        querySnapshot.forEach((docItem) => {
            const d = docItem.data();
            highContainer.innerHTML += `<div style="background:#f8f9fa; padding:12px; border:1px solid #ddd; border-radius:6px; text-align:center;"><h4>${d.titulo}</h4></div>`;
        });
    } catch (e) { console.error(e); }
}

async function carregarBarbeirosAdmin() {
    const listContainer = document.getElementById("admin-barbers-list");
    if (!listContainer) return;
    try {
        const querySnapshot = await getDocs(collection(db, "barbeiros"));
        listContainer.innerHTML = querySnapshot.empty ? "<p style='color:#666;'>Nenhum utilizador registado.</p>" : "";
        querySnapshot.forEach((docItem) => {
            const b = docItem.data();
            listContainer.innerHTML += `<div style="background:#f8f9fa; padding:10px; margin-bottom:6px; border-radius:4px; border:1px solid #ddd;"><strong>${b.nome || 'Utilizador'}</strong> (${b.email})</div>`;
        });
    } catch (e) { console.error(e); }
}
