import { db } from "./firebase-init.js";
import { collection, getDocs, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const servicosGrid = document.getElementById("servicos-grid");
const destaquesGrid = document.getElementById("destaques-grid");
const parceirosCarrossel = document.getElementById("parceiros-carrossel");
const pubServiceSelect = document.getElementById("pub-service-select");
const publicBookingForm = document.getElementById("public-booking-form");
const historiaTexto = document.getElementById("historia-texto");

// Carregar Dados da Página ao Iniciar
async function carregarPaginaPublica() {
    // 1. Carregar História (Exemplo fixo ou puxado do Firestore se tiver collection config)
    historiaTexto.textContent = "Fundada com a missão de resgatar a clássica barbearia tradicional combinada com as tendências modernas, nossa barbearia é o espaço ideal para cuidar do seu visual com conforto e exclusividade.";

    // 2. Carregar Serviços
    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        servicosGrid.innerHTML = "";
        pubServiceSelect.innerHTML = '<option value="">Selecione o Serviço</option>';
        
        querySnapshot.forEach((doc) => {
            const s = doc.data();
            servicosGrid.innerHTML += `
                <div class="card">
                    <h3>${s.nome}</h3>
                    <p>${s.descricao || "Serviço de alta qualidade."}</p>
                    <span class="price">R$ ${s.preco}</span>
                </div>
            `;
            pubServiceSelect.innerHTML += `<option value="${doc.id}">${s.nome} - R$ ${s.preco}</option>`;
        });
    } catch (e) {
        servicosGrid.innerHTML = "<p>Cadastre os serviços pelo painel admin.</p>";
    }

    // 3. Carregar Destaques
    try {
        const querySnapshot = await getDocs(collection(db, "destaques"));
        destaquesGrid.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const d = doc.data();
            destaquesGrid.innerHTML += `
                <div class="card highlight-card">
                    <img src="${d.imagemUrl || 'https://via.placeholder.com/300'}" alt="${d.titulo}">
                    <h3>${d.titulo}</h3>
                    <p>${d.descricao}</p>
                </div>
            `;
        });
    } catch (e) {
        destaquesGrid.innerHTML = "<p>Nenhum destaque no momento.</p>";
    }

    // 4. Carregar Parceiros e Vídeos
    try {
        const querySnapshot = await getDocs(collection(db, "parceiros"));
        parceirosCarrossel.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const p = doc.data();
            // Suporte a vídeo incorporado (ex: YouTube ou link direto)
            let videoElement = p.videoUrl ? `<iframe src="${p.videoUrl}" frameborder="0" allowfullscreen></iframe>` : "";
            
            parceirosCarrossel.innerHTML += `
                <div class="carousel-item">
                    <img src="${p.logoUrl}" alt="${p.nome}">
                    <h4>${p.nome}</h4>
                    ${videoElement}
                </div>
            `;
        });
    } catch (e) {
        parceirosCarrossel.innerHTML = "<p>Nenhum parceiro cadastrado.</p>";
    }
}

// 5. Enviar Agendamento pelo Site (Origem: Site)
publicBookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const clienteNome = document.getElementById("pub-client-name").value;
    const clienteTelefone = document.getElementById("pub-client-phone").value;
    const servicoId = pubServiceSelect.value;
    const dataHora = document.getElementById("pub-booking-date").value;

    try {
        await addDoc(collection(db, "agendamentos"), {
            clienteNome,
            clienteTelefone,
            servicoId,
            dataHora,
            origem: "Site", // <-- Registrado automaticamente como vindo do site!
            criadoEm: new Date().toISOString()
        });
        alert("Agendamento realizado com sucesso! Aguardamos você.");
        publicBookingForm.reset();
    } catch (e) {
        console.error("Erro ao agendar:", e);
        alert("Erro ao realizar agendamento. Tente novamente.");
    }
});

carregarPaginaPublica();
