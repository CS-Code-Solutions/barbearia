import { auth, db } from "./firebase-init.js";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, getDocs, getDoc, addDoc, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const loginScreen = document.getElementById("login-screen");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("login-form");
const googleLoginBtn = document.getElementById("btn-google-login");
const logoutBtn = document.getElementById("logout-btn");

// Monitorizar autenticação consultando diretamente o documento pelo e-mail
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const emailUtilizador = user.email ? user.email.trim().toLowerCase() : "";
        console.log("Tentativa de login com o e-mail:", emailUtilizador);

        try {
            // Consulta direta ao documento com ID igual ao e-mail do utilizador
            const docRef = doc(db, "barbeiros", emailUtilizador);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                alert(`O e-mail (${user.email}) não foi encontrado como ID na coleção 'barbeiros'.`);
                await signOut(auth);
                return;
            }

            const b = docSnap.data();
            const perfilUtilizador = b.perfil ? String(b.perfil).trim().toLowerCase() : "user";
            const podeEditarGlobal = Boolean(b.podeEditar);

            if (loginScreen) loginScreen.style.display = "none";
            if (adminPanel) adminPanel.style.display = "block";
            
            const isAdmin = (perfilUtilizador === "admin");
            carregarPainelAdministrativo(isAdmin, podeEditarGlobal, user);

        } catch (error) {
            console.error("Erro ao consultar o Firestore:", error);
            alert("Erro ao validar autorização na base de dados: " + error.message);
            await signOut(auth);
        }
    } else {
        if (loginScreen) loginScreen.style.display = "flex";
        if (adminPanel) adminPanel.style.display = "none";
    }
});
