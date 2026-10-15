// Importe os módulos necessários do Firebase CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração do Firebase da Barbearia
const firebaseConfig = {
    apiKey: "AIzaSyArOjf26FUdsndR09hgDEjbijVU_nivseI",
    authDomain: "barbearia-ae3da.firebaseapp.com",
    projectId: "barbearia-ae3da",
    storageBucket: "barbearia-ae3da.firebasestorage.app",
    messagingSenderId: "1008253416467",
    appId: "1:1008253416467:web:e44e111715975692c73be6"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
