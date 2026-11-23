window.addEventListener("DOMContentLoaded", () => {
  const currentPseudonym = localStorage.getItem("socius_pseudonym");
  if (currentPseudonym) {
    document.getElementById("sessionInfo").textContent = `Participante: ${currentPseudonym}`;
  } else {
    window.location.href = "/";
  }
});

function sendQuick(text) {
  document.getElementById("txt").value = text;
  send();
}

function clearChat() {
  document.getElementById("msgs").innerHTML = `
    <div class="msg bot">
      Nueva sesión iniciada. ¿En qué te puedo ayudar ahora?
    </div>
  `;
}

function endSession() {
  if (confirm("¿Estás seguro de finalizar la sesión? Recuerda guardar tu pseudónimo si deseas reingresar en los siguientes días.")) {
    localStorage.removeItem("socius_pseudonym");
    window.location.replace("/thanks");
  }
}

async function send() {
  const txt = document.getElementById("txt");
  const msgs = document.getElementById("msgs");
  const typing = document.getElementById("typing");

  if (!txt.value.trim()) return;

  const userVal = txt.value;

  msgs.innerHTML += `<div class="msg user">${userVal}</div>`;
  txt.value = "";
  msgs.scrollTop = msgs.scrollHeight;

  typing.style.display = "block";

  const currentPseudonym = localStorage.getItem("socius_pseudonym") || "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userVal,
        pseudonym: currentPseudonym
      })
    });

    const data = await res.json();
    const botReply = data.response ?? data.reply ?? data.message ?? data.bot_msg ?? data.detail;

    typing.style.display = "none";

    if (!botReply) {
      console.warn("Respuesta inesperada de /api/chat:", data);
      msgs.innerHTML += `<div class="msg bot" style="color: #ef4444;">El servidor no devolvió un mensaje de texto.</div>`;
    } else {
      msgs.innerHTML += `<div class="msg bot">${botReply}</div>`;
    }
  } catch (error) {
    typing.style.display = "none";
    msgs.innerHTML += `<div class="msg bot" style="color: #ef4444;">No se pudo conectar con el servidor.</div>`;
  }

  msgs.scrollTop = msgs.scrollHeight;
}