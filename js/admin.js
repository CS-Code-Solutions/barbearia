import { db } from "./firebase-init.js";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

console.log("admin.js iniciado com sucesso!");

let agendamentosCacheGlobal = [];
let servicosCacheAdmin = {};

document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM totalmente carregado. A iniciar painel...");
    
    await carregarCacheServicos();
    await carregarBarbeirosAdmin();
    carregarAgendamentosAdmin();
    carregarParceirosAdmin();
    carregarDestaquesAdmin();
    setupFormularioServico();
    setupFormularioBarbeiro();
    
    const filtroBarbeiroSelect = document.getElementById("filtro-barbeiro-admin");
    if (filtroBarbeiroSelect) {
        filtroBarbeiroSelect.addEventListener("change", () => {
            renderizarListaAgendamentos(agendamentosCacheGlobal);
        });
    }
});

async function carregarCacheServicos() {
    try {
        const snap = await getDocs(collection(db, "servicos"));
        servicosCacheAdmin = {};
        snap.forEach(d => {
            servicosCacheAdmin[d.id] = d.data();
        });
    } catch (e) {
        console.error("Erro ao carregar serviços:", e);
    }
}

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
    const btnSubmitServico = document.getElementById("btn-submit-servico");
    const btnCancelarServico = document.getElementById("btn-cancelar-servico");
    const editIdInput = document.getElementById("serv-edit-id");

    if (!serviceForm) return;

    if (btnCancelarServico) {
        btnCancelarServico.onclick = () => {
            serviceForm.reset();
            editIdInput.value = "";
            btnSubmitServico.textContent = "Adicionar Serviço";
            btnCancelarServico.style.display = "none";
            document.getElementById("serv-img-file").required = true;
        };
    }

    serviceForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const editId = editIdInput ? editIdInput.value.trim() : "";
        const nomeInput = document.getElementById("serv-nome");
        const fileInput = document.getElementById("serv-img-file");
        const precoInput = document.getElementById("serv-preco");
        const duracaoInput = document.getElementById("serv-duracao");
        const descInput = document.getElementById("serv-desc");
        const tempoInput = document.getElementById("serv-tempo");

        const nome = nomeInput ? nomeInput.value.trim() : "";
        const preco = precoInput ? precoInput.value.trim() : "";
        const duracaoMinutos = duracaoInput ? Number(duracaoInput.value) : 30;
        const descricao = descInput ? descInput.value.trim() : "";
        const tempoCarrossel = tempoInput ? tempoInput.value : 4;

        try {
            let imagemUrl = "";
            if (fileInput && fileInput.files.length > 0) {
                imagemUrl = await converterImagemParaBase64(fileInput.files[0]);
            }

            if (editId) {
                const dadosAtualizados = {
                    nome: nome,
                    preco: preco,
                    duracaoMinutos: duracaoMinutos,
                    descricao: descricao,
                    tempoCarrossel: tempoCarrossel
                };
                if (imagemUrl) {
                    dadosAtualizados.imagemUrl = imagemUrl;
                }

                await updateDoc(doc(db, "servicos", editId), dadosAtualizados);
                alert("Serviço atualizado com sucesso!");
                
                editIdInput.value = "";
                btnSubmitServico.textContent = "Adicionar Serviço";
                if (btnCancelarServico) btnCancelarServico.style.display = "none";
                document.getElementById("serv-img-file").required = true;
            } else {
                if (!fileInput || fileInput.files.length === 0) {
                    alert("Por favor, selecione uma imagem para o novo serviço.");
                    return;
                }

                await addDoc(collection(db, "servicos"), { 
                    nome: nome, 
                    imagemUrl: imagemUrl, 
                    preco: preco, 
                    duracaoMinutos: duracaoMinutos,
                    descricao: descricao, 
                    tempoCarrossel: tempoCarrossel 
                });

                alert("Serviço adicionado com sucesso!");
            }

            serviceForm.reset();
            await carregarCacheServicos();
            carregarServicosAdmin();
        } catch (err) {
            alert("Erro ao salvar serviço: " + err.message);
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
            const docId = docItem.id;
            const nomeServico = s.nome || "Serviço sem nome";
            const precoServico = s.preco || "0.00";
            const duracaoMinutos = s.duracaoMinutos || 30;
            const descServico = s.descricao || "";
            const tempoCarrossel = s.tempoCarrossel || 4;
            const imagemServico = s.imagemUrl || 'https://via.placeholder.com/100';

            listContainer.innerHTML += `
                <div style="background:#f8f9fa; padding:15px; border:1px solid #ddd; border-radius:8px; display:flex; align-items:center; gap:15px; text-align:left; margin-bottom:10px;">
                    <img src="${imagemServico}" alt="${nomeServico}" style="width:80px; height:80px; object-fit:cover; border-radius:6px; border:1px solid #ccc;">
                    <div style="flex:1;">
                        <h4 style="margin:0 0 5px 0; color:#1a1a1a;">${nomeServico} - <span style="color:#d4af37;">R$ ${precoServico}</span></h4>
                        <p style="margin:0 0 5px 0; font-size:0.85rem; color:#444;"><strong>Duração:</strong> ${duracaoMinutos} min | <strong>Carrossel:</strong> ${tempoCarrossel}s</p>
                        <p style="margin:0 0 8px 0; font-size:0.85rem; color:#666;">${descServico}</p>
                        <div style="display:flex; gap:8px;">
                            <button class="btn-editar-servico" data-id="${docId}" data-nome="${encodeURIComponent(nomeServico)}" data-preco="${precoServico}" data-duracao="${duracaoMinutos}" data-desc="${encodeURIComponent(descServico)}" data-tempo="${tempoCarrossel}" style="background:#ffc107; color:#1a1a1a; border:none; padding:5px 10px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.8rem;">Editar</button>
                            <button class="btn-del-service" data-id="${docId}" style="background:#dc3545; color:#fff; border:none; padding:5px 10px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.8rem;">Excluir</button>
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
                        await carregarCacheServicos();
                        carregarServicosAdmin();
                    } catch (err) {
                        alert("Erro ao excluir serviço.");
                    }
                }
            });
        });

        document.querySelectorAll(".btn-editar-servico").forEach(btn => {
            btn.addEventListener("click", () => {
                document.getElementById("serv-edit-id").value = btn.getAttribute("data-id");
                document.getElementById("serv-nome").value = decodeURIComponent(btn.getAttribute("data-nome"));
                document.getElementById("serv-preco").value = btn.getAttribute("data-preco");
                document.getElementById("serv-duracao").value = btn.getAttribute("data-duracao");
                document.getElementById("serv-desc").value = decodeURIComponent(btn.getAttribute("data-desc"));
                document.getElementById("serv-tempo").value = btn.getAttribute("data-tempo");

                document.getElementById("serv-img-file").required = false;
                document.getElementById("btn-submit-servico").textContent = "Atualizar Serviço";
                document.getElementById("btn-cancelar-servico").style.display = "block";

                window.scrollTo({ top: 0, behavior: 'smooth' });
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
        agendamentosCacheGlobal = [];

        querySnapshot.forEach((docItem) => {
            agendamentosCacheGlobal.push({ id: docItem.id, ...docItem.data() });
        });

        renderizarListaAgendamentos(agendamentosCacheGlobal);
    } catch (e) {
        appContainer.innerHTML = `<p style='color:red;'>Erro ao carregar agendamentos: ${e.message}</p>`;
    }
}

function renderizarListaAgendamentos(lista) {
    const appContainer = document.getElementById("admin-appointments-list");
    const filtroBarbeiro = document.getElementById("filtro-barbeiro-admin")?.value || "";
    if (!appContainer) return;

    appContainer.innerHTML = "";

    const agora = new Date().getTime();
    let listaFiltrada = [];

    lista.forEach(a => {
        if (a.status === "Cancelado") return;

        const dataHoraOriginal = a.dataHora || '';
        if (!dataHoraOriginal) return;

        // Calcular duração total
        let duracaoMin = 30;
        const listaServicos = a.servicosIds || (a.servicoId ? [a.servicoId] : []);
        if (listaServicos.length > 0) {
            duracaoMin = 0;
            listaServicos.forEach(sId => {
                if (servicosCacheAdmin[sId]) {
                    duracaoMin += Number(servicosCacheAdmin[sId].duracaoMinutos) || 30;
                }
            });
        }
        if (duracaoMin === 0) duracaoMin = Number(a.duracaoTotal) || 30;

        const inicioMs = new Date(dataHoraOriginal).getTime();
        const fimMs = inicioMs + (duracaoMin * 60000);

        // Se o horário final já passou, está concluído e sai da tela
        if (agora > fimMs) return;

        // Verificar filtro por barbeiro
        if (filtroBarbeiro && a.barbeiroNome !== filtroBarbeiro) return;

        // Determinar status dinâmico ("Em atendimento" ou "Confirmado")
        let statusDinamico = "Confirmado";
        let statusBadgeStyle = "background: #28a745; color: white;";
        
        if (agora >= inicioMs && agora <= fimMs) {
            statusDinamico = "Em atendimento";
            statusBadgeStyle = "background: #ffc107; color: #1a1a1a; font-weight: bold; animation: pulse 1.5s infinite;";
        }

        listaFiltrada.push({ ...a, statusDinamico, statusBadgeStyle, dataHoraOriginal });
    });

    if (listaFiltrada.length === 0) {
        appContainer.innerHTML = "<p style='color:#666;'>Nenhum agendamento ativo no momento.</p>";
        return;
    }

    listaFiltrada.forEach(a => {
        const docId = a.id;
        const dataHoraOriginal = a.dataHoraOriginal;
        const servicosTexto = a.nomesServicos || 'Serviço';
        
        let dataHoraTexto = 'Data não definida';
        if (dataHoraOriginal) {
            const partes = dataHoraOriginal.split
