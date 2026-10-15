import { db } from "./firebase-init.js";
import { collection, getDocs, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const servicosGrid = document.getElementById("servicos-grid");
const destaquesGrid = document.getElementById("destaques-grid");
const parceirosCarrossel = document.getElementById("parceiros-carrossel");
const pubServiceSelect = document.getElementById("pub-service-select");
const publicBookingForm = document.getElementById("public-booking-form");
const historiaTexto = document.getElementById("historia-texto");
const scheduleColumnsContainer = document.getElementById("schedule-columns");
const selectedDatetimeInput = document.getElementById("selected-datetime");

let bloqueioTemporarioId = null;

// Carregar Dados da Página ao Iniciar
async function carregarPaginaPublica() {
    console.log("A carregar página pública...");
    if (historiaTexto) {
        historiaTexto.textContent = "Fundada com a missão de resgatar a clássica barbearia tradicional combinada com as tendências modernas, nossa barbearia é o espaço ideal para cuidar do seu visual com conforto e exclusividade.";
    }

    // 1. Verificar e criar serviços iniciais se a coleção estiver vazia
    try {
        const servicosRef = collection(db, "servicos");
        const snapshotInicial = await getDocs(servicosRef);
        
        if (snapshotInicial.empty) {
            const servicosIniciais = [
                { nome: "Corte de Cabelo", descricao: "Corte moderno ou clássico com acabamento na navalha", preco: "40.00" },
                { nome: "Corte de Barba", descricao: "Barba alinhada com toalha quentinha e produtos especiais", preco: "30.00" },
                { nome: "Corte de Cabelo e Barba", descricao: "Combo completo para renovar o visual com estilo", preco: "60.00" }
            ];

            for (let s of servicosIniciais) {
                await addDoc(servicosRef, s);
            }
            console.log("Serviços iniciais criados com sucesso!");
        }
    } catch (e) {
        console.error("Erro ao criar serviços padrão:", e);
    }

    // 2. Carregar Serviços para a Grid e para o Select (Com compatibilidade total de nomes de campos)
    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        if (servicosGrid) servicosGrid.innerHTML = "";
        if (pubServiceSelect) pubServiceSelect.innerHTML = '<option value="">Selecione o Serviço</option>';
        
        if (querySnapshot.empty) {
            if (servicosGrid) servicosGrid.innerHTML = '<div class="empty-msg">Nenhum serviço cadastrado no momento.</div>';
        } else {
            querySnapshot.forEach((docItem) => {
                const s = docItem.data();
                
                // Mapeia flexível para identificar o nome, descrição e preço independentemente de como foram gravados
                const chaves = Object.keys(s);
                const nomeServico = s.nome || s[chaves.find(k => k.toLowerCase().includes('corte') || k.toLowerCase().includes('nome'))] || "Serviço";
                const descServico = s.descricao || s[chaves.find(k => k.toLowerCase().includes('desc') || k.toLowerCase().includes('moderno'))] || "Serviço de alta qualidade.";
                const precoServico = s.preco || s[chaves.find(k => k.toLowerCase().includes('preco') || k.toLowerCase().includes('preço'))] || "40.00";

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

    // 3. Carregar Destaques
    try {
        const querySnapshot = await getDocs(collection(db, "destaques"));
        if (destaquesGrid && !querySnapshot.empty) {
            destaquesGrid.innerHTML = "";
            querySnapshot.forEach((docItem) => {
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
    } catch (e) {
        console.error("Erro ao carregar destaques:", e);
    }

    // 4. Carregar Parceiros
    try {
        const querySnapshot = await getDocs(collection(db, "parceiros"));
        if (parceirosCarrossel && !querySnapshot.empty) {
            parceirosCarrossel.innerHTML = "";
            querySnapshot.forEach((docItem) => {
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
    } catch (e) {
        console.error("Erro ao carregar parceiros:", e);
    }

    // 5. Iniciar Calendário em Colunas
    iniciarCalendarioSeguro();
}

function iniciarCalendarioSeguro() {
    try {
        onSnapshot(collection(db, "agendamentos"), (snapshotAgendamentos) => {
            const agendamentosOcupados = [];
            snapshotAgendamentos.forEach(doc => {
                agendamentosOcupados.push(doc.data().dataHora);
            });

            onSnapshot(collection(db, "bloqueiosTemporarios"), (snapshotBloqueios) => {
                const agora = new Date().getTime();
                const horariosBloqueados = [];

                snapshotBloqueios.forEach(doc => {
                    const b = doc.data();
                    if (b.expiraEm && b.expiraEm > agora) {
                        horariosBloqueados.push(b.dataHora);
                    }
                });

                construirColunasCalendario(agendamentosOcupados, horariosBloqueados);
            }, (err) => {
                construirColunasCalendario(agendamentosOcupados, []);
            });
        }, (err) => {
            construirColunasCalendario([], []);
        });
    } catch (e) {
        construirColunasCalendario([], []);
    }
}

// Construção visual das colunas de dias com os horários
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

// Lógica de Seleção e Bloqueio Temporário por 2 Minutos
async function selecionarHorario(dataHora, botaoElemento) {
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
        } catch (e) { console.log(e); }
    }

    try {
        const expiraEm = new Date().getTime() + 120000; 
        const docRef = await addDoc(collection(db, "bloqueiosTemporarios"), {
            dataHora: dataHora,
            expiraEm: expiraEm,
            criadoEm: serverTimestamp()
        });
        bloqueioTemporarioId = docRef.id;
    } catch (e) {
        console.error("Erro ao bloquear horário:", e);
    }
}

// Enviar Agendamento Final
if (publicBookingForm) {
    publicBookingForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const clienteNome = document.getElementById("pub-client-name").value;
        const clienteTelefone = document.getElementById("pub-client-phone").value;
        const servicoId = pubServiceSelect.value;
        const dataHora = selectedDatetimeInput ? selectedDatetimeInput.value : "";

        if (!dataHora) {
            alert("Por favor, selecione um horário disponível nas colunas acima.");
            return;
        }

        try {
            await addDoc(collection(db, "agendamentos"), {
                clienteNome,
                clienteTelefone,
                servicoId,
                dataHora,
                origem: "Site",
                criadoEm: new Date().toISOString()
            });

            if (bloqueioTemporarioId) {
                await deleteDoc(doc(db, "bloqueiosTemporarios", bloqueioTemporarioId));
                bloqueioTemporarioId = null;
            }

            alert("Agendamento realizado com sucesso! Aguardamos você.");
            publicBookingForm.reset();
            if (selectedDatetimeInput) selectedDatetimeInput.value = "";
            carregarPaginaPublica();
        } catch (e) {
            console.error("Erro ao agendar:", e);
            alert("Erro ao realizar agendamento. Tente novamente.");
        }
    });
}

carregarPaginaPublica();
