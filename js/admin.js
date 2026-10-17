async function carregarAgendamentosAdmin(userEmail, podeEditarGlobal) {
    const appContainer = document.getElementById("admin-appointments-list");
    if (!appContainer) return;

    appContainer.innerHTML = "<p style='color:#007bff;'>A ligar ao Firestore para buscar agendamentos...</p>";

    try {
        const snapshot = await getDocs(collection(db, "agendamentos"));
        
        if (snapshot.empty) {
            appContainer.innerHTML = "<p style='color:#666;'>A coleção 'agendamentos' está vazia na base de dados.</p>";
            return;
        }

        appContainer.innerHTML = "";
        snapshot.forEach((docItem) => {
            const a = docItem.data();
            const docId = docItem.id;
            const dataHoraOriginal = a.dataHora || '';
            const dataHoraTexto = dataHoraOriginal ? dataHoraOriginal.replace('T', ' às ') : 'Data não definida';

            appContainer.innerHTML += `
                <div style="background:#fff; border-left: 4px solid #d4af37; padding: 12px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" id="agendamento-${docId}">
                    <strong>Cliente:</strong> ${a.clienteNome || 'Cliente'} (${a.clienteTelefone || ''})<br>
                    <strong>Barbeiro:</strong> ${a.barbeiroNome || 'Qualquer'} <br>
                    <strong>Data/Hora:</strong> ${dataHoraTexto}<br>
                    <strong>Código:</strong> ${a.codigoUnico || 'N/A'}<br>
                    
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <input type="datetime-local" id="novo-dh-${docId}" value="${dataHoraOriginal}" style="padding:6px; border:1px solid #ccc; border-radius:4px; flex:1;">
                        <button class="btn-editar-dh" data-id="${docId}" style="background:#ffc107; color:#1a1a1a; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Alterar Horário</button>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll(".btn-editar-dh").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const novoInput = document.getElementById(`novo-dh-${id}`).value;

                if (!novoInput) {
                    alert("Selecione a nova data e horário.");
                    return;
                }

                try {
                    await updateDoc(doc(db, "agendamentos", id), { dataHora: novoInput });
                    alert("Horário reagendado com sucesso!");
                    carregarAgendamentosAdmin(userEmail, podeEditarGlobal);
                } catch (err) {
                    alert("Erro ao atualizar horário: " + err.message);
                }
            });
        });

    } catch (e) {
        console.error("Erro crítico ao carregar agendamentos:", e);
        appContainer.innerHTML = `<p style='color:red; font-weight:bold;'>Erro de Acesso ao Firestore: ${e.message}</p><p style='font-size:0.85rem; color:#555;'>Verifique se a coleção se chama exatamente 'agendamentos' e se as regras de segurança permitem leitura.</p>`;
    }
}
