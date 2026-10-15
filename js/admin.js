import { auth, db } from "./firebase-init.js";
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    addCollection, // Ajustado para uso padrão abaixo
    getDocs, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginScreen = document.getElementById("login-screen");
const dashboard = document.getElementById("admin-dashboard");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const loginError = document.getElementById("login-error");
const manualForm = document.getElementById("manual-booking-form");
const appointmentsList = document.getElementById("appointments-list");
const serviceSelect = document.getElementById("service-select");

// 1. Monitorar Estado de Autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.style.display = "none";
        dashboard.style.display = "block";
        carregarDadosPainel();
    } else {
        loginScreen.style.display = "flex";
        dashboard.style.display = "none";
    }
});

// 2. Fazer Login
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-password").value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        loginError.textContent = "";
    } catch (error) {
        loginError.textContent = "Erro ao entrar: Verifique e-mail e senha.";
    }
});

// 3. Fazer Logout
logoutBtn.addEventListener("click", () => {
    signOut(auth);
});

// 4. Carregar Serviços e Monitorar Agendamentos em Tempo Real
async function carregarDadosPainel() {
    // Carregar opções de serviços no select
    try {
        const querySnapshot = await getDocs(collection(db, "servicos"));
        serviceSelect.innerHTML = '<option value="">Selecione o Serviço</option>';
        querySnapshot.forEach((doc) => {
            const serv = doc.data();
            serviceSelect.innerHTML += `<option value="${doc.id}">${serv.nome} - R$ ${serv.preco}</option>`;
        });
    } catch (e) {
        console.log("Erro ao carregar serviços (adicione alguns no Firestore):", e);
    }

    // Ouvir Agendamentos em Tempo Real (Firestore Snapshot)
    const q = query(collection(db, "agendamentos"), orderBy("dataHora", "asc"));
    onSnapshot(q, (snapshot) => {
        appointmentsList.innerHTML = "";
        if (snapshot.empty) {
            appointmentsList.innerHTML = "<p>Nenhum agendamento cadastrado.</p>";
            return;
        }

        snapshot.forEach((doc) => {
            const ag = doc.data();
            const dataFormatada = new Date(ag.dataHora).toLocaleString("pt-BR");
            
            appointmentsList.innerHTML += `
                <div class="appointment-card">
                    <strong>${ag.clienteNome}</strong> (${ag.clienteTelefone})<br>
                    Data: ${dataFormatada}<br>
                    Origem: <span class="badge ${ag.origem.toLowerCase()}">${ag.origem}</span>
                </div>
            `;
        });
    });
}

// 5. Adicionar Agendamento Manual (Independente do canal)
manualForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const clienteNome = document.getElementById("client-name").value;
    const clienteTelefone = document.getElementById("client-phone").value;
    const servicoId = serviceSelect.value;
    const dataHora = document.getElementById("booking-date").value;
    const origem = document.getElementById("booking-origin").value;

    try {
        await addDoc(collection(db, "agendamentos"), {
            clienteNome,
            clienteTelefone,
            servicoId,
            dataHora,
            origem,
            criadoEm: new Date().toISOString()
        });
        alert("Agendamento adicionado com sucesso!");
        manualForm.reset();
    } catch (e) {
        console.error("Erro ao adicionar agendamento: ", e);
        alert("Erro ao salvar agendamento.");
    }
});
