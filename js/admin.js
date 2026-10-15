import { auth, db } from "./firebase-init.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");

// Monitorar estado de autenticação
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (loginScreen) loginScreen.style.display = "none";
        if (adminPanel) adminPanel.style.display = "block";
    } else {
        if (loginScreen) loginScreen.style.display = "flex";
        if (adminPanel) adminPanel.style.display = "none";
    }
});

// Ação de Login com Alerta Detalhado de Erro
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById("login-email").value.trim();
        const senhaInput = document.getElementById("login-password").value.trim();

        try {
            await signInWithEmailAndPassword(auth, emailInput, senhaInput);
            console.log("Login efetuado com sucesso!");
        } catch (error) {
            console.error("Erro detalhado no login:", error.code, error.message);
            
            let mensagemErro = "Erro ao entrar.";
            if (error.code === 'auth/user-not-found') {
                mensagemErro = "Este e-mail não está cadastrado no Firebase Authentication.";
            } else if (error.code === 'auth/wrong-password') {
                mensagemErro = "Senha incorreta.";
            } else if (error.code === 'auth/invalid-email') {
                mensagemErro = "O formato do e-mail é inválido.";
            } else if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
                mensagemErro = "O login por E-mail/Senha não está ativado no Firebase Console!";
            } else {
                mensagemErro = `Erro: ${error.message}`;
            }
            
            alert(mensagemErro);
        }
    });
}

// Ação de Logout
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Erro ao sair:", error);
        }
    });
}
