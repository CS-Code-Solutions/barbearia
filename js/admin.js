import { db } from "./firebase-init.js";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log("admin.js iniciado com sucesso!");

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM totalmente carregado. A iniciar painel...");
    
    carregarAgendamentosAdmin();
    carregarServicosAdmin();
    carregarParceirosAdmin();
    carregarDestaquesAdmin();
    carregarBarbeirosAdmin();
    setupFormularioServico();
    setupFormularioBarbeiro();
});

// Função auxiliar para converter ficheiro em Base64
function converterImagemParaBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function setupFormularioServico() {
    const serviceForm = document.getElementById("service-form");
    if (!serviceForm) return;

    serviceForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const nomeInput = document.getElementById("serv-nome");
        const fileInput = document.getElementById("serv-img-file");
        const precoInput = document.getElementById("serv-preco");
        const descInput = document.getElementById("serv-desc");
        const tempoInput = document.getElementById("serv-tempo");

        const nome = nomeInput ? nomeInput.value.trim() : "";
        const preco = precoInput ? precoInput.value.trim() : "";
        const descricao = descInput ? descInput.value.trim() : "";
        const tempoCarrossel = tempoInput ? tempoInput.value : 4;

        if (!fileInput || fileInput.files.length === 0) {
            alert("Por favor, selecione uma imagem para o serviço.");
            return;
        }

        try {
            const imagemUrl = await converterImagemParaBase64(fileInput.files[0]);
            
            await addDoc(collection(db, "servicos"), { 
                nome: nome, 
                imagemUrl: imagemUrl, 
                preco: preco, 
                descricao: descricao, 
                tempoCarrossel: tempoCarrossel 
            });

            alert("Serviço adicionado com sucesso!");
            serviceForm.reset();
            carregarServicosAdmin();
        } catch (err) {
            alert("Erro ao adicionar serviço: " + err.message);
        }
    };
}

function setupFormularioBarbeiro() {
    const barberForm = document.getElementById("barber-form");
    if (!barberForm) return;

    barberForm.onsubmit = async (e) => {
        e.preventDefault();
        const nome = document.getElementById("barber-nome").value.trim();
        const email = document.getElementById("barber-email").value.trim();
        const perfil = document.getElementById("barber-perfil").value;
        const podeEditar = document.getElementById("barber-pode-editar").checked;

        try {
            await addDoc(collection(db, "barbeiros"), {
                nome,
                email,
                perfil,
                podeEditar
            });
            alert("Utilizador autorizado salvo com sucesso!");
            barberForm.reset();
            carregarBarbeirosAdmin();
        } catch (err) {
            alert("Erro ao salvar utilizizador: " + err.message);
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
            const nomeServico = s.nome || s.titulo || "Serviço sem nome";
            const precoServico = s.preco || "0.00";
            const descServico = s.descricao || "";
            const imagemServico = s.imagemUrl || 'https://via.placeholder.com/100';

            listContainer.innerHTML += `
                <div style="background:#f8f9fa; padding:15px; border:1px solid #ddd; border-radius:8px; display:flex; align-items:center; gap:15px; text-align:left; margin-bottom:10px;">
                    <img src="${imagemServico}" alt="${nomeServico}" style="width:80px; height:80px; object-fit:cover; border-radius:6px; border:1px solid #ccc;">
                    <div style="flex:1;">
                        <h4 style="margin:0 0 5px 0; color:#1a1a1a;">${nomeServico} - <span style="color:#d4af37;">R$ ${precoServico}</span></h4>
                        <p style="margin:0 0 8px 0; font-size:0.85rem; color:#666;">${descServico}</p>
                        <div style="display:flex; gap:8px;">
                            <button class="btn-editar-servico" data-id="${docItem.id}" data-nome="${nomeServico}" data-preco="${precoServico}" data-desc="${descServico}" style="background:#ffc107; color:#1a1a1a; border:none; padding:5px 10px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.8rem;">Editar</button>
                            <button class="btn-del-service" data-id="${docItem.id}" style="background:#dc3545; color:#fff; border:none; padding:5px 10px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.8rem;">Excluir</button>
                        </div>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll(".btn-del-service").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (confirm("Deseja excluir este serviço?")) {
                    try {
                        await deleteDoc(doc(db, "servicos", btn.getAttribute("data-id")));
                        alert("Serviço excluído com sucesso!");
                        carregarServicosAdmin();
                    } catch (err) {
                        alert("Erro ao excluir serviço.");
                    }
                }
            });
        });

        document.querySelectorAll(".btn-editar-servico").forEach(btn => {
            btn.addEventListener("click", () => {
                document.getElementById("serv-nome").value = btn.getAttribute("data-nome");
                document.getElementById("serv-preco").value = btn.getAttribute("data-preco");
                document.getElementById("serv-desc").value = btn.getAttribute("data-desc");

                window.scrollTo({ top: 0, behavior: 'smooth' });
                alert("Altere os dados no formulário acima.");
            });
        });

    } catch (e) {
        console.error("Erro ao carregar serviços:", e);
        listContainer.innerHTML = "<p style='color:red;'>Erro ao carregar serviços.</p>";
    }
}

async function carregarAgendamentosAdmin() {
    const appContainer = document.getElementById("admin-appointments-list");
    if (!appContainer) return;

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
            
            let dataHoraTexto = 'Data não definida';
            if (dataHoraOriginal) {
                const partes = dataHoraOriginal.split('T');
                if (partes.length === 2) {
                    const [ano, mes, dia] = partes[0].split('-');
                    dataHoraTexto = `${dia}/${mes}/${ano} às ${partes[1]}`;
                } else {
                    dataHoraTexto = dataHoraOriginal;
                }
            }

            appContainer.innerHTML += `
                <div style="background:#fff; border-left: 4px solid #d4af37; padding: 15px; margin-bottom: 15px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); color: #1a1a1a;" id="agendamento-${docId}">
                    <p style="margin: 4px 0;"><strong>Cliente:</strong> ${a.clienteNome || 'Cliente'} (${a.clienteTelefone || ''})</p>
                    <p style="margin: 4px 0;"><strong>Barbeiro:</strong> ${a.barbeiroNome || 'Qualquer'}</p>
                    <p style="margin: 4px 0;"><strong>Data/Hora:</strong> ${dataHoraTexto}</p>
                    <p style="margin: 4px 0;"><strong>Código:</strong> <span style="color:#b8860b; font-weight:bold;">${a.codigoUnico || 'N/A'}</span></p>
                    
                    <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                        <input type="datetime-local" id="novo-dh-${docId}" value="${dataHoraOriginal}" style="padding:8px; border:1px solid #ccc; border-radius:4px; flex:1; min-width:200px; background:#fff; color:#1a1a1a;">
                        <button class="btn-editar-dh" data-id="${docId}" style="background:#ffc107; color:#1a1a1a; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Alterar Horário</button>
                        <button class="btn-excluir-agendamento" data-id="${docId}" style="background:#dc3545; color:#fff; border:none; padding:8px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Excluir</button>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll(".btn-editar-dh").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const novoInput = document.getElementById(`novo-dh-${id}`).value;
                if (!novoInput) { alert("Selecione a nova data e horário."); return; }

                try {
                    await updateDoc(doc(db, "agendamentos", id), { dataHora: novoInput });
                    alert("Horário reagendado com sucesso!");
                    carregarAgendamentosAdmin();
                } catch (err) { alert("Erro ao atualizar horário: " + err.message); }
            });
        });

        document.querySelectorAll(".btn-excluir-agendamento").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                if (confirm("Deseja realmente excluir este agendamento?")) {
                    try {
                        await deleteDoc(doc(db, "agendamentos", id));
                        alert("Agendamento excluído com sucesso!");
                        carregarAgendamentosAdmin();
                    } catch (err) { alert("Erro ao excluir agendamento: " + err.message); }
                }
            });
        });

    } catch (e) {
        appContainer.innerHTML = `<p style='color:red;'>Erro ao carregar agendamentos: ${e.message}</p>`;
    }
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
        listContainer.innerHTML = "";

        if (querySnapshot.empty) {
            listContainer.innerHTML = "<p style='color:#888; font-size:0.9rem;'>Nenhum utilizador registado.</p>";
            return;
        }

        querySnapshot.forEach((docItem) => {
            const b = docItem.data();
            const docId = docItem.id;
            const nomeBarbeiro = b.nome || 'Utilizador';
            const emailBarbeiro = b.email || '';
            const perfilBarbeiro = b.perfil || 'barbeiro';
            const podeEditar = b.podeEditar !== false;

            listContainer.innerHTML += `
                <div style="background:#1a1a1a; padding:15px; border:1px solid #333; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; color:#fff;">
                    <div>
                        <h4 style="margin:0 0 5px 0; color:#d4af37;">${nomeBarbeiro} <span style="font-size:0.8rem; color:#aaa; font-weight:normal;">(${perfilBarbeiro})</span></h4>
                        <p style="margin:0; font-size:0.85rem; color:#888;">${emailBarbeiro} | Edição permitida: ${podeEditar ? 'Sim' : 'Não'}</p>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-editar-barbeiro" data-id="${docId}" data-nome="${nomeBarbeiro}" data-email="${emailBarbeiro}" data-perfil="${perfilBarbeiro}" data-podeeditar="${podeEditar}" style="background:#ffc107; color:#1a1a1a; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.8rem;">Editar</button>
                        <button class="btn-del-barbeiro" data-id="${docId}" style="background:#dc3545; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.8rem;">Excluir</button>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll(".btn-del-barbeiro").forEach(btn => {
            btn.addEventListener("click", async () => {
                if (confirm("Deseja excluir este utilizador autorizado?")) {
                    try {
                        await deleteDoc(doc(db, "barbeiros", btn.getAttribute("data-id")));
                        alert("Utilizador excluído com sucesso!");
                        carregarBarbeirosAdmin();
                    } catch (err) {
                        alert("Erro ao excluir utilizador: " + err.message);
                    }
                }
            });
        });

        document.querySelectorAll(".btn-editar-barbeiro").forEach(btn => {
            btn.addEventListener("click", () => {
                document.getElementById("barber-nome").value = btn.getAttribute("data-nome");
                document.getElementById("barber-email").value = btn.getAttribute("data-email");
                document.getElementById("barber-perfil").value = btn.getAttribute("data-perfil");
                document.getElementById("barber-pode-editar").checked = btn.getAttribute("data-podeeditar") === "true";

                window.scrollTo({ top: 0, behavior: 'smooth' });
                alert("Altere os dados no formulário acima e clique em salvar.");
            });
        });

    } catch (e) {
        console.error("Erro ao carregar barbeiros:", e);
        listContainer.innerHTML = "<p style='color:red;'>Erro ao carregar utilizadores.</p>";
    }
}
