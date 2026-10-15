import { db } from "./firebase-init.js";
import { collection, getDocs, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const servicosGrid = document.getElementById("servicos-grid");
const destaquesGrid = document.getElementById("destaques-grid");
const parceirosCarrossel = document.getElementById("parceiros-carrossel");
const pubServiceSelect = document.getElementById("pub-service-select");
const pubBarberSelect = document.getElementById("pub-barber-select");
const publicBookingForm = document.getElementById("public-booking-form");
const historiaTexto = document.getElementById("historia-texto");
const scheduleColumnsContainer = document.getElementById("schedule-columns");
const selectedDatetimeInput = document.getElementById("selected-datetime");

let bloqueioTemporarioId = null;
let horariosOcupadosGlobal = [];
let horariosBloqueadosGlobal = [];

function gerarCodigoUnico() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let codigo = "BARB-";
    for (let i = 0; i < 8; i++) {
        codigo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return codigo;
}

async function carregarPaginaPublica() {
    if (historiaTexto) {
        historiaTexto.textContent = "Fundada com a missão de resgatar a clássica barbearia tradicional combinada com as tendências modernas, nossa barbearia é o espaço ideal para cuidar do seu visual com conforto e exclusividade.";
    }

    // Carregar Serviços
    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        if (pubServiceSelect) pubServiceSelect.innerHTML = '<option value="">Selecione o Serviço</option>';
        if (servicosGrid) servicosGrid.innerHTML = "";
        
        if (querySnapshot.empty) {
            if (servicosGrid) servicosGrid.innerHTML = '<div class="empty-msg">Nenhum serviço cadastrado no momento.</div>';
        } else {
            querySnapshot.forEach((docItem) => {
                const s = docItem.data();
                const chaves = Object.keys(s);
                const nomeServico = s.nome || s[chaves.find(k => k.toLowerCase().includes('corte') || k.toLowerCase().includes('nome'))] || "Serviço";
                const descServico = s.descricao || "Serviço de alta qualidade.";
                const precoServico = s.preco || "40.00";

                if (servicosGrid) {
                    servicosGrid.innerHTML += `
                        <div class="card">
                            <h3>${nomeServico}</h3>
                            <p>${descServico}</p>
                            <span class="price">R$ ${precoServico}</span>
                        </div>
                    `;
                }
                if (pubServiceSelect) {
                    pubServiceSelect.innerHTML += `<option value="${docItem.id}">${nomeServico} - R$ ${precoServico}</option>`;
                }
            });
        }
    } catch (e) {
        console.error("Erro ao carregar serviços:", e);
    }

    // Carregar Barbeiros
    try {
        const barbeirosSnap = await getDocs(collection(db, "barbeiros"));
        if (pubBarberSelect) {
            pubBarberSelect.innerHTML = '<option value="">Qualquer Barbeiro Disponível</option>';
            barbeirosSnap.forEach(docItem => {
                const b = docItem.data();
                pubBarberSelect.innerHTML += `<option value="${b.nome}">${b.nome}</option>`;
            });
        }
    } catch (e) {
        console.error("Erro ao carregar barbeiros:", e);
    }

    // Carregar Destaques e Parceiros
    try {
        const queryDestaques = await getDocs(collection(db, "destaques"));
        if (destaquesGrid && !queryDestaques.empty) {
            destaquesGrid.innerHTML = "";
            queryDestaques.forEach((docItem) => {
                const d = docItem.data();
                destaquesGrid.innerHTML += `
                    <div class="card highlight-card">
                        <img src="${d.imagemUrl || 'https://via.placeholder.com/300'}" alt="${d.titulo}">
                        <h3>${d.titulo}</h3>
                        <p>${d.descricao}</p>
                    </div>
                `;
            });
        }
    } catch (e) {}

    try {
        const queryParceiros = await getDocs(collection(db, "parceiros"));
        if (parceirosCarrossel && !queryParceiros.empty) {
            parceirosCarrossel.innerHTML = "";
            queryParceiros.forEach((docItem) => {
                const p = docItem.data();
                let videoElement = p.videoUrl ? `<div class="video-container"><iframe src="${p.videoUrl}" frameborder="0" allowfullscreen></iframe></div>` : "";
                parceirosCarrossel.innerHTML += `
                    <div class="carousel-item card">
                        <img src="${p.logoUrl || 'https://via.placeholder.com/150'}" alt="${p.nome}">
                        <h4>${p.nome}</h4>
                        ${videoElement}
                    </div>
                `;
            });
        }
    } catch (e) {}

    iniciarCalendarioTempoReal();
    injetarSecaoGerenciarAgendamento();
}

function iniciarCalendarioTempoReal() {
    try {
        onSnapshot(collection(db, "agendamentos"), (snapshotAgendamentos) => {
            horariosOcupadosGlobal = [];
            snapshotAgendamentos.forEach(doc => {
                const data = doc.data();
                if (data.status !== "Cancelado") {
                    horariosOcupadosGlobal.push(data.dataHora);
                }
            });

            onSnapshot(collection(db, "bloqueiosTemporarios"), (snapshotBloqueios) => {
                const agora = new Date().getTime();
                horariosBloqueadosGlobal = [];

                snapshotBloqueios.forEach(doc => {
                    const b = doc.data();
                    if (b.expiraEm && b.expiraEm > agora) {
                        horariosBloqueadosGlobal.push(b.dataHora);
                    }
                });

                construirColunasCalendario(horariosOcupadosGlobal, horariosBloqueadosGlobal);
            }, () => construirColunasCalendario(horariosOcupadosGlobal, []));
        }, () => construirColunasCalendario([], []));
    } catch (e) {
        construirColunasCalendario([], []);
    }
}

function construirColunasCalendario(ocupados, bloqueados) {
    if (!scheduleColumnsContainer) return;
    scheduleColumnsContainer.innerHTML = "";
    const horariosDisponiveis = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];

    for (let i = 0; i < 5; i++) {
        const dataDia = new Date();
        dataDia.setDate(dataDia.getDate() + i);
        
        const ano = dataDia.getFullYear();
        const mes = String(dataDia.getMonth() + 1).padStart(2, '0');
        const dia = String(dataDia.getDate()).padStart(2, '0');
        const dataFormatadaYMD = `${ano}-${mes}-${dia}`;
        
        const nomeDiaSemana = dataDia.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'numeric' });

        const column = document.createElement("div");
        column.className = "date-column";
        
        const header = document.createElement("div");
        header.className = "date-header";
        header.textContent = nomeDiaSemana;
        column.appendChild(header);

        const list = document.createElement("div");
        list.className = "slots-list";

        horariosDisponiveis.forEach(hora => {
            const dataHoraCompleta = `${dataFormatadaYMD}T${hora}`;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = hora;

            const isOcupado = ocupados.includes(dataHoraCompleta);
            const isBloqueado = bloqueados.includes(dataHoraCompleta);

            if (isOcupado || isBloqueado) {
                btn.className = "slot-btn busy";
                btn.disabled = true;
            } else {
                btn.className = "slot-btn available";
                btn.addEventListener("click", () => selecionarHorario(dataHoraCompleta, btn));
            }

            list.appendChild(btn);
        });

        column.appendChild(list);
        scheduleColumnsContainer.appendChild(column);
    }
}

// Seleção e Bloqueio Instantâneo com Verificação em Tempo Real
async function selecionarHorario(dataHora, botaoElemento) {
    if (horariosOcupadosGlobal.includes(dataHora) || horariosBloqueadosGlobal.includes(dataHora)) {
        alert("Este horário acabou de ser ocupado por outro cliente.");
        iniciarCalendarioTempoReal();
        return;
    }

    document.querySelectorAll(".slot-btn").forEach(b => {
        if (!b.classList.contains("busy")) b.classList.add("available");
        b.classList.remove("selected");
    });

    botaoElemento.classList.remove("available");
    botaoElemento.classList.add("selected");
    if (selectedDatetimeInput) selectedDatetimeInput.value = dataHora;

    if (bloqueioTemporarioId) {
        try {
            await deleteDoc(doc(db, "bloqueiosTemporarios", bloqueioTemporarioId));
        } catch (e) {}
    }

    try {
        const expiraEm = new Date().getTime() + 120000; // 2 minutos
        const docRef = await addDoc(collection(db, "bloqueiosTemporarios"), {
            dataHora: dataHora,
            expiraEm: expiraEm,
            criadoEm: serverTimestamp()
        });
        bloqueioTemporarioId = docRef.id;
    } catch (e) {
        console.error("Erro ao bloquear temporariamente:", e);
    }
}

// Submissão com Validação Segura
if (publicBookingForm) {
    publicBookingForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const clienteNome = document.getElementById("pub-client-name").value;
        const clienteTelefone = document.getElementById("pub-client-phone").value;
        const servicoId = pubServiceSelect.value;
        const barbeiroNome = pubBarberSelect ? (pubBarberSelect.value || "Qualquer Barbeiro") : "Qualquer Barbeiro";
        const dataHora = selectedDatetimeInput ? selectedDatetimeInput.value : "";

        if (!dataHora) {
            alert("Por favor, selecione um horário disponível nas colunas acima.");
            return;
        }

        if (horariosOcupadosGlobal.includes(dataHora)) {
            alert("Atenção: Este horário foi ocupado por outro cliente. Escolha outro horário.");
            carregarPaginaPublica();
            return;
        }

        try {
            const codigoUnico = gerarCodigoUnico();

            await addDoc(collection(db, "agendamentos"), {
                clienteNome,
                clienteTelefone,
                servicoId,
                barbeiroNome,
                dataHora,
                codigoUnico,
                status: "Confirmado",
                origem: "Site",
                criadoEm: new Date().toISOString()
            });

            if (bloqueioTemporarioId) {
                await deleteDoc(doc(db, "bloqueiosTemporarios", bloqueioTemporarioId));
                bloqueioTemporarioId = null;
            }

            mostrarModalSucessoAgendamento(codigoUnico, dataHora);
            publicBookingForm.reset();
            if (selectedDatetimeInput) selectedDatetimeInput.value = "";
            carregarPaginaPublica();
        } catch (e) {
            console.error("Erro ao agendar:", e);
            alert("Erro ao realizar agendamento. Tente novamente.");
        }
    });
}

function mostrarModalSucessoAgendamento(codigo, dataHora) {
    const modalExistente = document.getElementById("modal-codigo-sucesso");
    if (modalExistente) modalExistente.remove();

    const modal = document.createElement("div");
    modal.id = "modal-codigo-sucesso";
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:9999;";
    
    modal.innerHTML = `
        <div style="background:white; padding:30px; border-radius:10px; max-width:400px; text-align:center; box-shadow:0 4px 15px rgba(0,0,0,0.3);">
            <h3 style="color:#28a745; margin-top:0;">Agendamento Confirmado!</h3>
            <p>Guarde o seu <strong>Código Único</strong> para consultar ou cancelar o seu horário:</p>
            <div style="background:#f8f9fa; border:2px dashed #d4af37; padding:15px; font-size:1.2rem; font-weight:bold; margin:15px 0; letter-spacing:1px; color:#1a1a1a;">${codigo}</div>
            <button id="btn-copiar-codigo" style="background:#1a1a1a; color:white; border:none; padding:10px 20px; border-radius:5px; font-weight:bold; cursor:pointer; width:100%; margin-bottom:10px;">Copiar Código</button>
            <button id="btn-fechar-modal" style="background:#ccc; color:#333; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; width:100%;">Fechar</button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btn-copiar-codigo").addEventListener("click", () => {
        navigator.clipboard.writeText(codigo);
        alert("Código copiado para a área de transferência!");
    });

    document.getElementById("btn-fechar-modal").addEventListener("click", () => {
        modal.remove();
    });
}

function injetarSecaoGerenciarAgendamento() {
    const secaoAgendar = document.getElementById("agendar");
    if (!secaoAgendar || document.getElementById("gerenciar-agendamento-box")) return;

    const divGerenciar = document.createElement("div");
    divGerenciar.id = "gerenciar-agendamento-box";
    divGerenciar.style.cssText = "background:white; padding:25px; border-radius:12px; box-shadow:0 6px 15px rgba(0,0,0,0.1); max-width:900px; margin:30px auto 0 auto; border-top:4px solid #1a1a1a; text-align:center;";
    
    divGerenciar.innerHTML = `
        <h3 style="margin-top:0; color:#1a1a1a;">Já tem um agendamento?</h3>
        <p style="color:#666; font-size:0.9rem;">Insira o seu <strong>Código Único</strong> para consultar ou cancelar:</p>
        <div style="display:flex; gap:10px; max-width:400px; margin:0 auto;">
            <input type="text" id="input-codigo-busca" placeholder="Ex: BARB-8X92" style="flex:1; padding:10px; border:1px solid #ccc; border-radius:5px;">
            <button id="btn-buscar-codigo" style="background:#1a1a1a; color:white; border:none; padding:10px 20px; border-radius:5px; font-weight:bold; cursor:pointer;">Consultar</button>
        </div>
        <div id="resultado-busca-agendamento" style="margin-top:15px; text-align:left;"></div>
    `;

    secaoAgendar.querySelector(".container").appendChild(divGerenciar);

    document.getElementById("btn-buscar-codigo").addEventListener("click", async () => {
        const codigoBuscado = document.getElementById("input-codigo-busca").value.trim();
        const resultadoDiv = document.getElementById("resultado-busca-agendamento");
        
        if (!codigoBuscado) {
            alert("Insira um código válido.");
            return;
        }

        resultadoDiv.innerHTML = "A procurar agendamento...";

        try {
            const q = query(collection(db, "agendamentos"), where("codigoUnico", "==", codigoBuscado));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                resultadoDiv.innerHTML = "<p style='color:red; text-align:center;'>Nenhum agendamento encontrado com este código.</p>";
                return;
            }

            querySnapshot.forEach((docItem) => {
                const agendamento = docItem.data();
                const docId = docItem.id;

                resultadoDiv.innerHTML = `
                    <div style="background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #ddd;">
                        <p><strong>Cliente:</strong> ${agendamento.clienteNome}</p>
                        <p><strong>Barbeiro:</strong> ${agendamento.barbeiroNome || 'Qualquer'}</p>
                        <p><strong>Data/Hora Atual:</strong> ${agendamento.dataHora.replace('T', ' às ')}</p>
                        <p><strong>Estado:</strong> ${agendamento.status || 'Confirmado'}</p>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button id="btn-cancelar-reserva" style="background:#dc3545; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold; flex:1;">Cancelar Agendamento</button>
                        </div>
                    </div>
                `;

                document.getElementById("btn-cancelar-reserva").addEventListener("click", async () => {
                    if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
                        await updateDoc(doc(db, "agendamentos", docId), { status: "Cancelado" });
                        alert("Agendamento cancelado com sucesso!");
                        resultadoDiv.innerHTML = "";
                        carregarPaginaPublica();
                    }
                });
            });
        } catch (err) {
            console.error("Erro ao procurar agendamento:", err);
            resultadoDiv.innerHTML = "<p style='color:red;'>Erro ao consultar código.</p>";
        }
    });
}

carregarPaginaPublica();
