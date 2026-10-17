import { db } from "./firebase-init.js";
import { collection, getDocs, getDoc, addDoc, setDoc, onSnapshot, deleteDoc, doc, serverTimestamp, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const servicosCarrosselContainer = document.getElementById("servicos-carrossel-container");
const modalServiceSelect = document.getElementById("modal-service-select");
const modalBarberSelect = document.getElementById("modal-barber-select");
const modalBookingForm = document.getElementById("modal-booking-form");
const scheduleColumnsContainer = document.getElementById("schedule-columns");

const modalBooking = document.getElementById("modal-booking");
const btnCloseModal = document.getElementById("btn-close-modal");
const modalSelectedTimeLabel = document.getElementById("modal-selected-time-label");

const historiaTexto = document.getElementById("historia-texto");

let horarioSelecionadoGlobal = "";
let bloqueioTemporarioId = null;
let horariosOcupadosGlobal = [];
let horariosBloqueadosGlobal = [];
let carrosselInterval = null;

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
        historiaTexto.textContent = "Fundada com a missão de resgatar a clássica barbearia tradicional...";
    }

    // Carregar Serviços
    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        if (modalServiceSelect) modalServiceSelect.innerHTML = '<option value="">Selecione o Serviço</option>';
        if (servicosCarrosselContainer) servicosCarrosselContainer.innerHTML = "";
        
        if (!querySnapshot.empty) {
            let trackHTML = '<div class="servicos-carrossel-track" id="servicos-track">';
            let tempoTransicao = 4000;

            querySnapshot.forEach((docItem) => {
                const s = docItem.data();
                const nomeServico = s.nome || "Serviço";
                const descServico = s.descricao || "";
                const precoServico = s.preco || "40.00";
                const imagemUrl = s.imagemUrl || 'https://via.placeholder.com/600x380';
                
                if (s.tempoCarrossel) tempoTransicao = Number(s.tempoCarrossel) * 1000;

                trackHTML += `
                    <div class="servicos-slide" data-id="${docItem.id}" data-nome="${nomeServico}" data-desc="${descServico}" data-preco="${precoServico}" data-img="${imagemUrl}">
                        <img src="${imagemUrl}" alt="${nomeServico}">
                        <div class="servicos-slide-caption">
                            <h3>${nomeServico} - R$ ${precoServico}</h3>
                            <p>Clique para ver detalhes</p>
                        </div>
                    </div>
                `;

                if (modalServiceSelect) {
                    modalServiceSelect.innerHTML += `<option value="${docItem.id}">${nomeServico} - R$ ${precoServico}</option>`;
                }
            });

            trackHTML += '</div>';
            if (servicosCarrosselContainer) {
                servicosCarrosselContainer.innerHTML = `<div class="servicos-carrossel-wrapper">${trackHTML}</div>`;
                iniciarLogicaCarrossel(tempoTransicao);
            }
        }
    } catch (e) {
        console.error("Erro ao carregar serviços:", e);
    }

    // Carregar Barbeiros
    try {
        const barbeirosSnap = await getDocs(collection(db, "barbeiros"));
        if (modalBarberSelect) {
            modalBarberSelect.innerHTML = '<option value="">Qualquer Barbeiro Disponível</option>';
            barbeirosSnap.forEach(docItem => {
                const b = docItem.data();
                modalBarberSelect.innerHTML += `<option value="${b.nome}">${b.nome}</option>`;
            });
        }
    } catch (e) {}

    iniciarCalendarioTempoReal();
    injetarSecaoGerenciarAgendamento();
}

function iniciarLogicaCarrossel(tempoMs) {
    const track = document.getElementById("servicos-track");
    if (!track) return;
    const slides = track.querySelectorAll(".servicos-slide");
    if (slides.length === 0) return;

    let index = 0;
    if (carrosselInterval) clearInterval(carrosselInterval);

    carrosselInterval = setInterval(() => {
        index = (index + 1) % slides.length;
        track.style.transform = `translateX(-${index * 100}%)`;
    }, tempoMs);
}

// Fechar Modal
if (btnCloseModal && modalBooking) {
    btnCloseModal.addEventListener("click", async () => {
        modalBooking.style.display = "none";
        if (bloqueioTemporarioId) {
            try {
                await deleteDoc(doc(db, "bloqueiosTemporarios", bloqueioTemporarioId));
                bloqueioTemporarioId = null;
            } catch (e) {}
        }
        iniciarCalendarioTempoReal();
    });
}

function iniciarCalendarioTempoReal() {
    try {
        onSnapshot(collection(db, "agendamentos"), (snapshotAgendamentos) => {
            horariosOcupadosGlobal = [];
            snapshotAgendamentos.forEach(doc => {
                const data = doc.data();
                if (data.status !== "Cancelado") horariosOcupadosGlobal.push(data.dataHora);
            });

            onSnapshot(collection(db, "bloqueiosTemporarios"), (snapshotBloqueios) => {
                const agora = new Date().getTime();
                horariosBloqueadosGlobal = [];
                snapshotBloqueios.forEach(doc => {
                    const b = doc.data();
                    if (b.expiraEm && b.expiraEm > agora) horariosBloqueadosGlobal.push(b.dataHora);
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
                btn.addEventListener("click", () => abrirModalReserva(dataHoraCompleta));
            }

            list.appendChild(btn);
        });

        column.appendChild(list);
        scheduleColumnsContainer.appendChild(column);
    }
}

async function abrirModalReserva(dataHora) {
    horarioSelecionadoGlobal = dataHora;
    const [dataParte, horaParte] = dataHora.split('T');
    const [ano, mes, dia] = dataParte.split('-');
    const dataFormatadaAmigavel = `${dia}/${mes}/${ano} às ${horaParte}`;

    if (modalSelectedTimeLabel) {
        modalSelectedTimeLabel.textContent = `Horário: ${dataFormatadaAmigavel}`;
    }

    if (modalBooking) modalBooking.style.display = "flex";

    try {
        const expiraEm = new Date().getTime() + 120000;
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

if (modalBookingForm) {
    modalBookingForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const clienteNome = document.getElementById("modal-client-name").value;
        const clienteTelefone = document.getElementById("modal-client-phone").value;
        const servicoId = modalServiceSelect.value;
        const barbeiroNome = modalBarberSelect ? (modalBarberSelect.value || "Qualquer Barbeiro") : "Qualquer Barbeiro";
        const dataHora = horarioSelecionadoGlobal;

        if (!dataHora) {
            alert("Nenhum horário selecionado.");
            return;
        }

        try {
            const codigoUnico = gerarCodigoUnico();
            const agendamentoDocRef = doc(db, "agendamentos", dataHora);
            
            await setDoc(agendamentoDocRef, {
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
                try {
                    await deleteDoc(doc(db, "bloqueiosTemporarios", bloqueioTemporarioId));
                    bloqueioTemporarioId = null;
                } catch (err) {}
            }

            if (modalBooking) modalBooking.style.display = "none";
            mostrarModalSucessoAgendamento(codigoUnico);
            modalBookingForm.reset();
            carregarPaginaPublica();
        } catch (e) {
            console.error("Erro ao confirmar agendamento:", e);
            alert("Este horário já foi ocupado. Escolha outro.");
            if (modalBooking) modalBooking.style.display = "none";
            carregarPaginaPublica();
        }
    });
}

function mostrarModalSucessoAgendamento(codigo) {
    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:9999;";
    
    modal.innerHTML = `
        <div style="background:#141414; border:1px solid #d4af37; padding:30px; border-radius:12px; max-width:400px; text-align:center; color:#fff;">
            <h3 style="color:#28a745; margin-top:0;">Agendamento Confirmado![cite: 6]</h3>
            <p style="color:#ccc;">Guarde o seu <strong>Código Único</strong> para consultar ou cancelar:</p>
            <div style="background:#1a1a1a; border:2px dashed #d4af37; padding:15px; font-size:1.3rem; font-weight:bold; margin:15px 0; letter-spacing:1px; color:#d4af37;">${codigo}</div>
            <button id="btn-copiar-codigo" class="btn-primary-custom" style="width:100%; margin-bottom:10px; padding:12px;">Copiar Código</button>
            <button id="btn-fechar-sucesso" style="background:none; border:1px solid #444; color:#aaa; padding:8px; border-radius:6px; cursor:pointer; width:100%;">Fechar</button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("btn-copiar-codigo").addEventListener("click", () => {
        navigator.clipboard.writeText(codigo);
        alert("Código copiado!");
    });

    document.getElementById("btn-fechar-sucesso").addEventListener("click", () => {
        modal.remove();
    });
}

function injetarSecaoGerenciarAgendamento() {
    const secaoAgendar = document.getElementById("agendar");
    if (!secaoAgendar || document.getElementById("gerenciar-agendamento-box")) return;

    const divGerenciar = document.createElement("div");
    divGerenciar.id = "gerenciar-agendamento-box";
    divGerenciar.style.cssText = "background:#141414; padding:25px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.5); max-width:900px; margin:30px auto 0 auto; border:1px solid #222; text-align:center;";
    
    divGerenciar.innerHTML = `
        <h3 style="margin-top:0; color:#f4f4f4; font-family:Georgia, serif;">Já tem um agendamento?</h3>
        <p style="color:#888; font-size:0.9rem;">Insira o seu <strong>Código Único</strong> para consultar, reagendar ou cancelar:</p>
        <div style="display:flex; gap:10px; max-width:400px; margin:0 auto;">
            <input type="text" id="input-codigo-busca" placeholder="Ex: BARB-8X92" style="flex:1; padding:12px; background:#1a1a1a; border:1px solid #333; color:#fff; border-radius:8px;">
            <button id="btn-buscar-codigo" class="btn-primary-custom" style="padding:0 20px;">Consultar</button>
        </div>
        <div id="resultado-busca-agendamento" style="margin-top:15px; text-align:left;"></div>
    `;

    secaoAgendar.querySelector(".container").appendChild(divGerenciar);

    document.getElementById("btn-buscar-codigo").addEventListener("click", async () => {
        const codigoBuscado = document.getElementById("input-codigo-busca").value.trim();
        const resultadoDiv = document.getElementById("resultado-busca-agendamento");
        
        if (!codigoBuscado) { alert("Insira um código válido."); return; }
        resultadoDiv.innerHTML = "<p style='color:#d4af37; text-align:center;'>A procurar agendamento...</p>";

        try {
            const q = query(collection(db, "agendamentos"), where("codigoUnico", "==", codigoBuscado));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                resultadoDiv.innerHTML = "<p style='color:#e74c3c; text-align:center;'>Nenhum agendamento encontrado com este código.</p>";
                return;
            }

            querySnapshot.forEach((docItem) => {
                const agendamento = docItem.data();
                const docId = docItem.id;
                const dataHoraOriginal = agendamento.dataHora || '';

                resultadoDiv.innerHTML = `
                    <div style="background:#1a1a1a; padding:15px; border-radius:8px; border:1px solid #333; color:#ccc;">
                        <p><strong>Cliente:</strong> ${agendamento.clienteNome}</p>
                        <p><strong>Barbeiro:</strong> ${agendamento.barbeiroNome || 'Qualquer'}</p>
                        <p><strong>Data/Hora Atual:</strong> ${dataHoraOriginal.replace('T', ' às ')}</p>
                        <p><strong>Estado:</strong> ${agendamento.status || 'Confirmado'}</p>
                        
                        <div style="margin-top:15px; border-top:1px solid #333; padding-top:10px;">
                            <label style="font-size:0.85rem; font-weight:bold; display:block; margin-bottom:5px; color:#888;">Escolha a nova data e horário:</label>
                            <input type="datetime-local" id="novo-horario-cliente-${docId}" value="${dataHoraOriginal}" style="width:100%; padding:10px; background:#141414; border:1px solid #333; color:#fff; border-radius:6px; margin-bottom:10px; box-sizing:border-box;">
                            
                            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                <button id="btn-reagendar-reserva" class="btn-primary-custom" style="flex:1; padding:10px;">Reagendar</button>
                                <button id="btn-cancelar-reserva" style="background:#dc3545; color:white; border:none; padding:10px 15px; border-radius:6px; cursor:pointer; font-weight:bold; flex:1;">Cancelar</button>
                            </div>
                        </div>
                    </div>
                `;

                document.getElementById("btn-reagendar-reserva").addEventListener("click", async () => {
                    const novoInput = document.getElementById(`novo-horario-cliente-${docId}`).value;
                    if (!novoInput) { alert("Selecione a nova data."); return; }
                    try {
                        await updateDoc(doc(db, "agendamentos", docId), { dataHora: novoInput });
                        alert("Horário reagendado com sucesso!");
                        resultadoDiv.innerHTML = "";
                        carregarPaginaPublica();
                    } catch (err) { alert("Erro ao reagendar: " + err.message); }
                });

                document.getElementById("btn-cancelar-reserva").addEventListener("click", async () => {
                    if (confirm("Tem certeza que deseja cancelar?")) {
                        await updateDoc(doc(db, "agendamentos", docId), { status: "Cancelado" });
                        alert("Agendamento cancelado!");
                        resultadoDiv.innerHTML = "";
                        carregarPaginaPublica();
                    }
                });
            });
        } catch (err) {
            resultadoDiv.innerHTML = "<p style='color:#e74c3c;'>Erro ao consultar código.</p>";
        }
    });
}

carregarPaginaPublica();
