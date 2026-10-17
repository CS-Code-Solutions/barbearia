import { db } from "./firebase-init.js";
import { collection, getDocs, getDoc, addDoc, setDoc, onSnapshot, deleteDoc, doc, serverTimestamp, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const servicosCarrosselContainer = document.getElementById("servicos-carrossel-container");
const modalServiceSelect = document.getElementById("modal-service-select");
const modalBookingForm = document.getElementById("modal-booking-form");
const scheduleColumnsContainer = document.getElementById("schedule-columns");
const barberSelectionContainer = document.getElementById("barber-selection-container");
const calendarWrapper = document.getElementById("calendar-wrapper");
const calendarTitle = document.getElementById("calendar-title");

const modalBooking = document.getElementById("modal-booking");
const btnCloseModal = document.getElementById("btn-close-modal");
const modalSelectedTimeLabel = document.getElementById("modal-selected-time-label");

let horarioSelecionadoGlobal = "";
let barbeiroSelecionadoGlobal = "";
let servicosMapGlobal = {};
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

// Converte horário "HH:MM" em minutos totais desde 00:00
function tempoParaMinutos(horaStr) {
    const [h, m] = horaStr.split(':').map(Number);
    return h * 60 + m;
}

// Converte minutos totais em "HH:MM"
function minutosParaTempo(minTotal) {
    const h = Math.floor(minTotal / 60);
    const m = minTotal % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

async function carregarPaginaPublica() {
    // 1. Carregar Serviços
    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        if (modalServiceSelect) modalServiceSelect.innerHTML = '<option value="">Selecione o Serviço</option>';
        if (servicosCarrosselContainer) servicosCarrosselContainer.innerHTML = "";
        servicosMapGlobal = {};
        
        if (!querySnapshot.empty) {
            let trackHTML = '<div class="servicos-carrossel-track" id="servicos-track">';
            let tempoTransicao = 4000;

            querySnapshot.forEach((docItem) => {
                const s = docItem.data();
                const servicoId = docItem.id;
                const nomeServico = s.nome || "Serviço";
                const descServico = s.descricao || "";
                const precoServico = s.preco || "40.00";
                const duracaoMinutos = Number(s.duracaoMinutos) || 30;
                const imagemUrl = s.imagemUrl || 'https://via.placeholder.com/600x380';
                
                servicosMapGlobal[servicoId] = {
                    nome: nomeServico,
                    preco: precoServico,
                    duracaoMinutos: duracaoMinutos
                };

                if (s.tempoCarrossel) tempoTransicao = Number(s.tempoCarrossel) * 1000;

                trackHTML += `
                    <div class="servicos-slide" data-id="${servicoId}">
                        <img src="${imagemUrl}" alt="${nomeServico}">
                        <div class="servicos-slide-caption">
                            <h3>${nomeServico} - R$ ${precoServico} (${duracaoMinutos} min)</h3>
                            <p>Clique para ver detalhes</p>
                        </div>
                    </div>
                `;

                if (modalServiceSelect) {
                    modalServiceSelect.innerHTML += `<option value="${servicoId}">${nomeServico} - R$ ${precoServico} (${duracaoMinutos} min)</option>`;
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

    // 2. Carregar Barbeiros (Primeiro passo do agendamento)
    try {
        const barbeirosSnap = await getDocs(collection(db, "barbeiros"));
        if (barberSelectionContainer) {
            barberSelectionContainer.innerHTML = "";
            
            if (barbeirosSnap.empty) {
                barberSelectionContainer.innerHTML = "<p style='color:#888; text-align:center; grid-column:1/-1;'>Nenhum barbeiro registado. Cadastre no painel admin.</p>";
                return;
            }

            barbeirosSnap.forEach(docItem => {
                const b = docItem.data();
                const nomeBarbeiro = b.nome || 'Barbeiro';

                const card = document.createElement("div");
                card.className = "barber-select-card";
                card.innerHTML = `
                    <h4>✂️ ${nomeBarbeiro}</h4>
                    <p>${b.perfil === 'admin' ? 'Administrador / Barbeiro' : 'Barbeiro Autorizado'}</p>
                `;

                card.addEventListener("click", () => {
                    document.querySelectorAll(".barber-select-card").forEach(c => c.classList.remove("selected"));
                    card.classList.add("selected");
                    barbeiroSelecionadoGlobal = nomeBarbeiro;
                    if (calendarTitle) calendarTitle.textContent = `Agenda de ${nomeBarbeiro}`;
                    if (calendarWrapper) calendarWrapper.style.display = "block";
                    iniciarCalendarioTempoReal();
                });

                barberSelectionContainer.appendChild(card);
            });
        }
    } catch (e) {
        console.error("Erro ao carregar barbeiros:", e);
    }

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
    if (!barbeiroSelecionadoGlobal) return;

    try {
        onSnapshot(collection(db, "agendamentos"), (snapshotAgendamentos) => {
            horariosOcupadosGlobal = [];
            snapshotAgendamentos.forEach(doc => {
                const data = doc.data();
                if (data.status !== "Cancelado" && data.barbeiroNome === barbeiroSelecionadoGlobal) {
                    // Guarda o slot inicial e duração em minutos do serviço agendado
                    let duracao = 30;
                    if (data.servicoId && servicosMapGlobal[data.servicoId]) {
                        duracao = servicosMapGlobal[data.servicoId].duracaoMinutos || 30;
                    }
                    horariosOcupadosGlobal.push({ dataHora: data.dataHora, duracao: duracao });
                }
            });

            onSnapshot(collection(db, "bloqueiosTemporarios"), (snapshotBloqueios) => {
                const agora = new Date().getTime();
                horariosBloqueadosGlobal = [];
                snapshotBloqueios.forEach(doc => {
                    const b = doc.data();
                    if (b.expiraEm && b.expiraEm > agora && b.barbeiroNome === barbeiroSelecionadoGlobal) {
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

    // Horários de 15 em 15 minutos (excluindo almoço das 12:00 às 13:00)
    const horariosDisponiveis = [
        "09:00", "09:15", "09:30", "09:45",
        "10:00", "10:15", "10:30", "10:45",
        "11:00", "11:15", "11:30", "11:45",
        "13:00", "13:15", "13:30", "13:45",
        "14:00", "14:15", "14:30", "14:45",
        "15:00", "15:15", "15:30", "15:45",
        "16:00", "16:15", "16:30", "16:45",
        "17:00", "17:15", "17:30", "17:45",
        "18:00", "18:15", "18:30", "18:45",
        "19:00"
    ];

    // Mapear todos os horários individuais que estão ocupados com base na duração dos serviços
    const slotsOcupadosSet = new Set();
    ocupados.forEach(item => {
        const [dataYMD, horaHM] = item.dataHora.split('T');
        if (!dataYMD || !horaHM) return;
        const inicioMin = tempoParaMinutos(horaHM);
        const slotsCount = Math.ceil(item.duracao / 15);
        for (let s = 0; s < slotsCount; s++) {
            const slotMin = inicioMin + (s * 15);
            slotsOcupadosSet.add(`${dataYMD}T${minutosParaTempo(slotMin)}`);
        }
    });

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

            const isOcupado = slotsOcupadosSet.has(dataHoraCompleta);
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
        modalSelectedTimeLabel.textContent = `Barbeiro: ${barbeiroSelecionadoGlobal} | ${dataFormatadaAmigavel}`;
    }

    if (modalBooking) modalBooking.style.display = "flex";

    try {
        const expiraEm = new Date().getTime() + 120000;
        const docRef = await addDoc(collection(db, "bloqueiosTemporarios"), {
            dataHora: dataHora,
            barbeiroNome: barbeiroSelecionadoGlobal,
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
        const barbeiroNome = barbeiroSelecionadoGlobal;
        const dataHora = horarioSelecionadoGlobal;

        if (!dataHora || !barbeiroNome) {
            alert("Selecione o barbeiro e o horário.");
            return;
        }

        try {
            const codigoUnico = gerarCodigoUnico();
            const agendamentoDocRef = doc(db, "agendamentos", `${barbeiroNome}_${dataHora}`.replace(/[\s:]/g, '_'));
            
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
            <h3 style="color:#28a745; margin-top:0;">Agendamento Confirmado!</h3>
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
