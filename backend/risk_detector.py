import math

# Palabras clave críticas de alerta inmediata (violencia, autodaño explícito)
CRITICAL_KEYWORDS = [
    "matar", "matarme", "morir", "suicid", "golpear", "herir", "sangre", 
    "armas", "hacer daño", "destruir", "explotar", "amenaza", "violencia"
]

def analyze_risk_and_shifts(user_msg: str, current_v: float, current_a: float, previous_record: dict = None):
    alerts = []
    is_critical = False
    msg_lower = user_msg.lower()

    # 1. Detección inmediata por lenguaje crítico/violento (palabras prohibidas)
    found_keywords = [kw for kw in CRITICAL_KEYWORDS if kw in msg_lower]
    if found_keywords:
        is_critical = True
        alerts.append(f"Contenido crítico detectado: '{', '.join(found_keywords)}'")

    # 2. Detección de negatividad / dolor sostenido (2 veces seguidas o más)
    # Consideramos un mensaje negativo si su Valencia (v) es menor a -0.3 (zona de malestar/tristeza/ira)
    is_negative_current = current_v < -0.3

    # Obtener cuántas veces seguidas venía acumulando negatividad el mensaje anterior
    consecutive_negative_count = 0
    if previous_record:
        # Si el anterior fue crítico por negatividad sostenida o ya traía un contador, se hereda
        consecutive_negative_count = previous_record.get("consecutive_negative_count", 0)

    if is_negative_current:
        consecutive_negative_count += 1
    else:
        consecutive_negative_count = 0  # Se reinicia si el usuario expresa algo neutral o positivo

    # Si hay 2 o más mensajes seguidos con negatividad/dolor, se dispara la alerta
    if consecutive_negative_count >= 2:
        is_critical = True
        alerts.append(f"Patrón negativo sostenido ({consecutive_negative_count} mensajes seguidos de dolor/malestar)")

    return {
        "is_critical": is_critical,
        "alerts": alerts,
        "consecutive_negative_count": consecutive_negative_count
    }