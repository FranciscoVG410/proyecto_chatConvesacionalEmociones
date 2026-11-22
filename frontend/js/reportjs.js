document.addEventListener("DOMContentLoaded", () => {
  try {
    const vadDataEl = document.getElementById("vad-data");
    const vadPoints = vadDataEl ? JSON.parse(vadDataEl.textContent) : [];

    // 1. RENDERIZADO DEL CUBO 3D GABINETE
    const cubeCanvas = document.getElementById("vadCubeCanvas");
    if (cubeCanvas) {
      const cubeCtx = cubeCanvas.getContext("2d");

      function project3DToCabinet(v, a, d) {
        const width = cubeCanvas.width;
        const height = cubeCanvas.height;
        const scale = Math.min(width, height) * 0.30;

        const centerX = width / 2 - 40;
        const centerY = height / 2 + 30;

        const angle = Math.PI / 4;
        const depthFactor = 0.45;
        const depthShift = (d + 1) * scale * depthFactor;

        return {
          x: centerX + v * scale + depthShift * Math.cos(angle),
          y: centerY - a * scale - depthShift * Math.sin(angle)
        };
      }

      function draw3DCubeScene() {
        cubeCtx.clearRect(0, 0, cubeCanvas.width, cubeCanvas.height);

        const rawCorners = [
          { v: -1, a: -1, d: -1 }, { v: 1, a: -1, d: -1 }, { v: 1, a: 1, d: -1 }, { v: -1, a: 1, d: -1 },
          { v: -1, a: -1, d: 1 }, { v: 1, a: -1, d: 1 }, { v: 1, a: 1, d: 1 }, { v: -1, a: 1, d: 1 }
        ];
        const vertices = rawCorners.map((c) => project3DToCabinet(c.v, c.a, c.d));

        const edges = [
          [0, 1], [1, 2], [2, 3], [3, 0],
          [4, 5], [5, 6], [6, 7], [7, 4],
          [0, 4], [1, 5], [2, 6], [3, 7]
        ];

        cubeCtx.lineWidth = 2;
        cubeCtx.strokeStyle = "#16a34a";
        cubeCtx.setLineDash([]);

        edges.forEach((edge) => {
          const p1 = vertices[edge[0]];
          const p2 = vertices[edge[1]];
          cubeCtx.beginPath();
          cubeCtx.moveTo(p1.x, p1.y);
          cubeCtx.lineTo(p2.x, p2.y);
          cubeCtx.stroke();
        });

        cubeCtx.save();
        cubeCtx.strokeStyle = "#94a3b8";
        cubeCtx.lineWidth = 1.5;
        cubeCtx.setLineDash([4, 4]);

        const vStart = project3DToCabinet(-1, 0, -1), vEnd = project3DToCabinet(1, 0, -1);
        cubeCtx.beginPath(); cubeCtx.moveTo(vStart.x, vStart.y); cubeCtx.lineTo(vEnd.x, vEnd.y); cubeCtx.stroke();

        const aStart = project3DToCabinet(0, -1, -1), aEnd = project3DToCabinet(0, 1, -1);
        cubeCtx.beginPath(); cubeCtx.moveTo(aStart.x, aStart.y); cubeCtx.lineTo(aEnd.x, aEnd.y); cubeCtx.stroke();

        const dStart = project3DToCabinet(0, 0, -1), dEnd = project3DToCabinet(0, 0, 1);
        cubeCtx.beginPath(); cubeCtx.moveTo(dStart.x, dStart.y); cubeCtx.lineTo(dEnd.x, dEnd.y); cubeCtx.stroke();
        cubeCtx.restore();

        cubeCtx.fillStyle = "#334155";
        cubeCtx.font = "bold 11px Segoe UI";
        const labelV = project3DToCabinet(0, -1, -1);
        cubeCtx.fillText("Valencia (V)", labelV.x - 25, labelV.y + 18);
        const labelA = project3DToCabinet(-1, 0, -1);
        cubeCtx.fillText("Activación (A)", labelA.x - 75, labelA.y + 4);
        const labelD = project3DToCabinet(1, 1, 0);
        cubeCtx.fillText("Dominancia (D)", labelD.x + 12, labelD.y);

        if (vadPoints && vadPoints.length > 0) {
          cubeCtx.beginPath();
          cubeCtx.strokeStyle = "#4f46e5";
          cubeCtx.lineWidth = 2.5;
          cubeCtx.setLineDash([]);

          vadPoints.forEach((pt, index) => {
            const p = project3DToCabinet(pt.v, pt.a, pt.d);
            if (index === 0) cubeCtx.moveTo(p.x, p.y);
            else cubeCtx.lineTo(p.x, p.y);
          });
          cubeCtx.stroke();

          vadPoints.forEach((pt, index) => {
            const p = project3DToCabinet(pt.v, pt.a, pt.d);
            const pFloor = project3DToCabinet(pt.v, -1, pt.d);
            const pWall = project3DToCabinet(-1, pt.a, pt.d);

            cubeCtx.save();
            cubeCtx.setLineDash([3, 3]);
            cubeCtx.strokeStyle = "rgba(79, 70, 229, 0.45)";
            cubeCtx.lineWidth = 1;

            cubeCtx.beginPath(); cubeCtx.moveTo(p.x, p.y); cubeCtx.lineTo(pFloor.x, pFloor.y); cubeCtx.stroke();
            cubeCtx.beginPath(); cubeCtx.moveTo(p.x, p.y); cubeCtx.lineTo(pWall.x, pWall.y); cubeCtx.stroke();
            cubeCtx.restore();

            cubeCtx.beginPath();
            cubeCtx.arc(p.x, p.y, 6, 0, Math.PI * 2);

            if (pt.is_critical) {
              cubeCtx.fillStyle = "#f59e0b";
              cubeCtx.strokeStyle = "#b45309";
            } else if (index === vadPoints.length - 1) {
              cubeCtx.fillStyle = "#ef4444";
              cubeCtx.strokeStyle = "#991b1b";
            } else {
              cubeCtx.fillStyle = "#4f46e5";
              cubeCtx.strokeStyle = "#312e81";
            }

            cubeCtx.lineWidth = 2;
            cubeCtx.fill();
            cubeCtx.stroke();

            cubeCtx.fillStyle = "#1e293b";
            cubeCtx.font = "bold 11px Segoe UI";
            cubeCtx.fillText(pt.label, p.x + 10, p.y - 4);
          });
        }
      }

      draw3DCubeScene();
    }

    // 2. RENDERIZADO DE LAS GRÁFICAS 2D DUALES
    const dualCanvas = document.getElementById("vadDualCanvas");
    if (dualCanvas) {
      const dualCtx = dualCanvas.getContext("2d");

      function drawCartesianAxes(ctx, centerX, centerY, scale, labelX, labelY) {
        ctx.save();
        ctx.strokeStyle = "#64748b";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(centerX - scale, centerY);
        ctx.lineTo(centerX + scale, centerY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(centerX, centerY - scale);
        ctx.lineTo(centerX, centerY + scale);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = "#334155";
        ctx.font = "bold 11px Segoe UI";
        ctx.fillText(labelX, centerX + scale - 35, centerY + 18);
        ctx.fillText(labelY, centerX - 35, centerY - scale - 8);
      }

      function drawPointsAndPath2D(ctx, projectionFn) {
        if (!vadPoints || vadPoints.length === 0) return;

        ctx.beginPath();
        ctx.strokeStyle = "#4f46e5";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);

        vadPoints.forEach((pt, index) => {
          const p = projectionFn(pt);
          if (index === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        vadPoints.forEach((pt, index) => {
          const p = projectionFn(pt);

          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);

          if (pt.is_critical) {
            ctx.fillStyle = "#f59e0b";
            ctx.strokeStyle = "#b45309";
          } else if (index === vadPoints.length - 1) {
            ctx.fillStyle = "#ef4444";
            ctx.strokeStyle = "#991b1b";
          } else {
            ctx.fillStyle = "#4f46e5";
            ctx.strokeStyle = "#312e81";
          }

          ctx.lineWidth = 2;
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#1e293b";
          ctx.font = "bold 11px Segoe UI";
          ctx.fillText(pt.label, p.x + 10, p.y - 4);
        });
      }

      function drawDual2DScene() {
        dualCtx.clearRect(0, 0, dualCanvas.width, dualCanvas.height);
        const width = dualCanvas.width;
        const height = dualCanvas.height;

        const boxSize = Math.min(width * 0.38, height * 0.65);
        const scale = boxSize / 2;

        const centerLeftX = width * 0.28;
        const centerRightX = width * 0.72;
        const centerY = height * 0.52;

        drawCartesianAxes(dualCtx, centerLeftX, centerY, scale, "Valencia (V)", "Activación (A)");
        drawPointsAndPath2D(dualCtx, (pt) => ({
          x: centerLeftX + pt.v * scale,
          y: centerY - pt.a * scale
        }));

        drawCartesianAxes(dualCtx, centerRightX, centerY, scale, "Dominancia (D)", "Activación (A)");
        drawPointsAndPath2D(dualCtx, (pt) => ({
          x: centerRightX + pt.d * scale,
          y: centerY - pt.a * scale
        }));
      }

      drawDual2DScene();
    }
  } catch (err) {
    console.error("Error al renderizar las gráficas en el reporte:", err);
  }
});

async function downloadReport() {
  const btn = document.querySelector(".btn-download");
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Generando PDF...";
    }

    const rawPseudo = document.body.dataset.pseudonym || "";
    const cleanPseudo = rawPseudo
      .replace(/^GENERAL.*$/i, "general")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_|_$/g, "");

    if (btn) btn.style.display = "none";

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `reporte_socius_${cleanPseudo || "general"}.pdf`,
      image: { type: "png", quality: 1 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] }
    };

    await html2pdf().set(opt).from(document.body).save();
  } catch (err) {
    console.error("Error al generar el PDF:", err);
    alert("No se pudo generar el PDF del reporte.");
  } finally {
    if (btn) {
      btn.style.display = "";
      btn.disabled = false;
      btn.textContent = "Descargar Reporte";
    }
  }
}