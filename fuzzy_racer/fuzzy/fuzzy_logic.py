class FuzzySystem:
    def __init__(self):
        pass

    def trapmf(self, x, a, b, c, d):
        if x <= a or x >= d:
            return 0.0
        if a < x <= b:
            return (x - a) / (b - a)
        if b < x <= c:
            return 1.0
        if c < x < d:
            return (d - x) / (d - c)
        return 0.0

    def trimf(self, x, a, b, c):
        if x <= a or x >= c:
            return 0.0
        if x == b:
            return 1.0
        if a < x < b:
            return (x - a) / (b - a)
        if b < x < c:
            return (c - x) / (c - b)
        return 0.0

    def fuzzify_distance(self, dist):
        return {
            "Near": self.trapmf(dist, float('-inf'), 0, 150, 250),
            "Medium": self.trimf(dist, 150, 300, 450),
            "Far": self.trapmf(dist, 350, 500, float('inf'), float('inf'))
        }

    def fuzzify_speed(self, relative_speed):
        return {
            "Slow": self.trapmf(relative_speed, float('-inf'), -10, -3, 0),
            "Normal": self.trimf(relative_speed, -1, 0, 3),
            "Fast": self.trapmf(relative_speed, 1, 5, float('inf'), float('inf'))
        }

    def fuzzify_clearance(self, clear):
        """
        Calculates if the adjacent lane is blocked or open.
        Input is distance to nearest obstacle in that lane.
        """
        return {
            "Blocked": self.trapmf(clear, float('-inf'), 0, 50, 150),
            "Open": self.trapmf(clear, 100, 200, float('inf'), float('inf'))
        }

    def evaluate(self, distance, relative_speed, left_clearance=500, right_clearance=500):
        d = self.fuzzify_distance(distance)
        s = self.fuzzify_speed(relative_speed)
        cl = self.fuzzify_clearance(left_clearance)
        cr = self.fuzzify_clearance(right_clearance)

        # Speed Rules
        brake_weight = 0.0
        maintain_weight = 0.0
        accelerate_weight = 0.0

        # Core race/avoidance rules.
        brake_weight = max(brake_weight, min(d["Near"], s["Fast"]))
        brake_weight = max(brake_weight, min(d["Near"], s["Normal"]))
        maintain_weight = max(maintain_weight, min(d["Medium"], s["Normal"]))
        accelerate_weight = max(accelerate_weight, min(d["Medium"], s["Slow"]))

        # When close and slower than the target, push to accelerate to keep racing.
        accelerate_weight = max(accelerate_weight, min(d["Near"], s["Slow"]))

        # Replace unconditional "Far => Accelerate" with speed-aware far rules.
        accelerate_weight = max(accelerate_weight, min(d["Far"], s["Slow"]))
        maintain_weight = max(maintain_weight, min(d["Far"], s["Normal"]))
        maintain_weight = max(maintain_weight, min(d["Far"], s["Fast"]))

        numerator = (brake_weight * 0) + (maintain_weight * 50) + (accelerate_weight * 100)
        denominator = brake_weight + maintain_weight + accelerate_weight
        crisp_speed = 50.0 if denominator == 0 else numerator / denominator

        if crisp_speed < 40:
            speed_action = "Brake"
        elif crisp_speed > 60:
            speed_action = "Accelerate"
        else:
            speed_action = "Maintain Speed"

        # Path Rules (Lane Changing)
        # If distance is Near and speed is Fast (we need to evade)
        evade_urgency = min(d["Near"], sum([s["Fast"], s["Normal"]]))
        
        shift_left = min(evade_urgency, cl["Open"])
        shift_right = min(evade_urgency, cr["Open"], 1.0 - shift_left) # bias left

        if shift_left > shift_right and shift_left > 0.4:
            path_action = "Shift Left"
        elif shift_right > shift_left and shift_right > 0.4:
            path_action = "Shift Right"
        else:
            path_action = "Keep Lane"

        # Determine the most active rule for logging
        active_rule = "None"
        max_activation = 0
        if min(d["Near"], s["Fast"]) > max_activation:
            max_activation = min(d["Near"], s["Fast"])
            active_rule = "IF Distance Near AND Speed Fast THEN Brake"
        if min(d["Near"], s["Normal"]) > max_activation:
            max_activation = min(d["Near"], s["Normal"])
            active_rule = "IF Distance Near AND Speed Normal THEN Brake"
        if min(d["Medium"], s["Normal"]) > max_activation:
            max_activation = min(d["Medium"], s["Normal"])
            active_rule = "IF Distance Medium AND Speed Normal THEN Maintain"
        if min(d["Near"], s["Slow"]) > max_activation:
            max_activation = min(d["Near"], s["Slow"])
            active_rule = "IF Distance Near AND Speed Slow THEN Accelerate"
        if min(d["Medium"], s["Slow"]) > max_activation:
            max_activation = min(d["Medium"], s["Slow"])
            active_rule = "IF Distance Medium AND Speed Slow THEN Accelerate"
        if min(d["Far"], s["Slow"]) > max_activation:
            max_activation = min(d["Far"], s["Slow"])
            active_rule = "IF Distance Far AND Speed Slow THEN Accelerate"
        if min(d["Far"], s["Normal"]) > max_activation:
            max_activation = min(d["Far"], s["Normal"])
            active_rule = "IF Distance Far AND Speed Normal THEN Maintain"
        if min(d["Far"], s["Fast"]) > max_activation:
            max_activation = min(d["Far"], s["Fast"])
            active_rule = "IF Distance Far AND Speed Fast THEN Maintain"

        return {
            "speed_action": speed_action,
            "path_action": path_action,
            "distance_membership": d,
            "speed_membership": s,
            "rule": active_rule,
            "defuzzified_value": crisp_speed
        }
