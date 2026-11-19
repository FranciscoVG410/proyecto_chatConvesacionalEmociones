import numpy as np

class VADTracker:
    def __init__(self, safe_space_v=0.6, safe_space_a=0.4):
        self.target_v = safe_space_v
        self.target_a = safe_space_a
        self.history = [] 

    def calculate_distance(self, current_v, current_a):
        # Calculate the distance in 2D space (Valence and Arousal)
        point1 = np.array((current_v, current_a))
        point2 = np.array((self.target_v, self.target_a))
        distance = np.linalg.norm(point1 - point2)
        
        self.history.append((current_v, current_a))
        return distance

    def get_trajectory_trend(self):
        # Indicates whether the trajectory is moving towards or away from the target
        if len(self.history) < 2:
            return "Iniciando seguimiento"
        
        return "Mejorando"