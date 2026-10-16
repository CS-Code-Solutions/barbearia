import { auth, db } from "./firebase-init.js";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const emailUtilizador = user.email ? user.email.trim().toLowerCase() : "";

        try {
            // Acede ao documento que contém o array de e-mails permitidos
            // (Exemplo: coleção "config", documento "rg_allowed_emails")
            const docRef = doc(db, "config", "rg_allowed_emails");
            const docSnap = await getDoc(docRef);

            let autorizado = false;

            if (docSnap.exists()) {
                const dados = docSnap.data();
                // Assume que o array está no campo "content" como na sua imagem
                const listaEmails = dados.content || [];
                
                // Verifica se o e-mail do utilizador está presente no array
                autorizado = listaEmails.some(e => String(e).trim().toLowerCase() === emailUtilizador);
            }

            if (!autorizado) {
                alert(`O e-mail (${user.email}) não está autorizado na base de dados.`);
                await signOut(auth);
                return;
            }

            // Se for autorizado, libera o painel com privilégios de administrador total
            if (loginScreen) loginScreen.style.display = "none";
            if (adminPanel) adminPanel.style.display = "block";
            
            carregarPainelAdministrativo(true, true, user);

        } catch (error) {
            console.error("Erro ao validar permissões:", error);
            alert("Erro ao validar autorização.");
            await signOut(auth);
        }
    } else {
        if (loginScreen) loginScreen.style.display = "flex";
        if (adminPanel) adminPanel.style.display = "none";
    }
});
