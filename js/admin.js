async function carregarAgendamentosAdmin(userEmail, podeEditarGlobal) {
    const appContainer = document.getElementById("admin-appointments-list");
    if (!appContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "agendamentos"));
        appContainer.innerHTML = "";

        if (querySnapshot.empty) {
            appContainer.innerHTML = "<p style='color:#666;'>Nenhum agendamento registado.</p>";
            return;
        }

        querySnapshot.forEach((docItem) => {
            const a = docItem.data();
            const docId = docItem.id;
            const dataHoraOriginal = a.dataHora || '';
            const dataHoraTexto = dataHoraOriginal ? dataHoraOriginal.replace('T', ' às ') : 'Data não definida';

            appContainer.innerHTML += `
                <div style="background:#fff; border-left: 4px solid #d4af37; padding: 12px; margin-bottom: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" id="agendamento-${docId}">
                    <strong>Cliente:</strong> ${a.clienteNome || 'Cliente'} (${a.clienteTelefone || ''})<br>
                    <strong>Barbeiro:</strong> ${a.barbeiroNome || 'Qualquer'} <br>
                    <strong>Data/Hora:</strong> <span id="dh-texto-${docId}">${dataHoraTexto}</span><br>
                    <strong>Código:</strong> ${a.codigoUnico || 'N/A'}<br>
                    
                    ${podeEditarGlobal ? `
                    <div style="margin-top:10px; display:flex; gap:10px;">
                        <input type="datetime-local" id="novo-dh-${docId}" value="${dataHoraOriginal}" style="padding:6px; border:1px solid #ccc; border-radius:4px; flex:1;">
                        <button class="btn-editar-dh" data-id="${docId}" style="background:#ffc107; color:#1a1a1a; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;">Alterar Horário</button>
                    </div>
                    ` : '<p style="font-size:0.8rem; color:#888; margin-top:5px;">Sem permissão para editar horários.</p>'}
                </div>
            `;
        });

        if (podeEditarGlobal) {
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
                        alert("Erro ao atualizar horário.");
                    }
                });
            });
        }
    } catch (e) {
        console.error("Erro ao carregar agendamentos:", e);
        appContainer.innerHTML = "<p style='color:red;'>Erro ao carregar agendamentos.</p>";
    }
}
