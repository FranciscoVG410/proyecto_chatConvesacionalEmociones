let assignedPseudonym = "";

function showNewForm() {
  document.getElementById("modeSelector").style.display = "none";
  document.getElementById("newParticipantForm").style.display = "block";
  if (!assignedPseudonym) {
    fetchUniquePseudonym();
  }
}

function showReturningForm() {
  document.getElementById("modeSelector").style.display = "none";
  document.getElementById("returningForm").style.display = "block";
}

function goBack() {
  document.getElementById("newParticipantForm").style.display = "none";
  document.getElementById("returningForm").style.display = "none";
  document.getElementById("modeSelector").style.display = "flex";
}

async function fetchUniquePseudonym() {
  try {
    const response = await fetch("/api/generate-pseudonym");
    const data = await response.json();
    if (response.ok) {
      assignedPseudonym = data.pseudonym;
      document.getElementById("pseudonymText").textContent = assignedPseudonym;
      const btn = document.getElementById("submitNewBtn");
      btn.disabled = false;
      btn.textContent = "Registrarse y Comenzar";
    } else {
      alert("Error al generar pseudónimo: " + data.detail);
    }
  } catch (err) {
    console.error(err);
    document.getElementById("pseudonymText").textContent = "Error de conexión";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const newForm = document.getElementById("newParticipantForm");
  const returningForm = document.getElementById("returningForm");

  if (newForm) {
    newForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (!assignedPseudonym) {
        alert("El pseudónimo aún no se ha generado. Espera un momento.");
        return;
      }

      const ageInput = document.getElementById("age");
      const rawAge = ageInput.value.trim();
      const parsedAge = parseInt(rawAge, 10);

      if (!/^\d+$/.test(rawAge) || Number.isNaN(parsedAge) || parsedAge < 17 || parsedAge > 120) {
        alert("Debes ingresar una edad válida de 17 años en adelante.");
        ageInput.focus();
        return;
      }

      const genderSelect = document.getElementById("gender");
      const genderVal = genderSelect.value;
      if (!genderVal) {
        alert("Selecciona una opción de género.");
        genderSelect.focus();
        return;
      }

      const payload = {
        pseudonym: assignedPseudonym,
        age: parsedAge,
        gender: genderVal
      };

      try {
        const res = await fetch("/api/register-participant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const resultData = await res.json();

        if (res.ok) {
          localStorage.setItem("socius_pseudonym", assignedPseudonym);
          window.location.href = "/chat-app";
        } else {
          alert("Error en el registro: " + (resultData.detail || "Desconocido"));
        }
      } catch (error) {
        console.error("Error de red:", error);
        alert("No se pudo conectar con el servidor para registrar el usuario.");
      }
    });
  }

  if (returningForm) {
    returningForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const pseudonymVal = document.getElementById("existingPseudonym").value.trim().toUpperCase();

      try {
        const res = await fetch("/api/login-participant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pseudonym: pseudonymVal })
        });

        const resultData = await res.json();

        if (res.ok) {
          localStorage.setItem("socius_pseudonym", pseudonymVal);
          window.location.href = "/chat-app";
        } else {
          alert("Error: " + (resultData.detail || "Pseudónimo no encontrado"));
        }
      } catch (error) {
        console.error("Error de red:", error);
        alert("No se pudo conectar con el servidor.");
      }
    });
  }
});