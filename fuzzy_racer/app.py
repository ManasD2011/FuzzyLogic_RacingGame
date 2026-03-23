import os
import json
from flask import Flask, render_template, request, jsonify
from fuzzy.fuzzy_logic import FuzzySystem

app = Flask(__name__)
fuzzy_ai = FuzzySystem()

DATA_DIR = 'data'
LEADERBOARD_FILE = os.path.join(DATA_DIR, 'leaderboard.json')

# Ensure leaderboard file exists
os.makedirs(DATA_DIR, exist_ok=True)
if not os.path.exists(LEADERBOARD_FILE):
    with open(LEADERBOARD_FILE, 'w') as f:
        json.dump({"leaderboard": []}, f)

@app.route('/')
def index():
    """Serve the main HTML file containing the frontend app."""
    return render_template('index.html')

@app.route('/fuzzy-decision', methods=['POST'])
def fuzzy_decision():
    """
    API endpoint for the Frontend game loop to query the Python Fuzzy AI.
    Expected JSON: {"distance": float, "speed": float}
    Returns: {"action": "Brake"|"Maintain Speed"|"Accelerate"}
    """
    data = request.json
    if not data or 'distance' not in data or 'speed' not in data:
        return jsonify({"error": "Invalid input format"}), 400

    try:
        dist = float(data['distance'])
        spd = float(data['speed'])
        lc = float(data.get('leftClearance', 500))
        rc = float(data.get('rightClearance', 500))
        
        result = fuzzy_ai.evaluate(dist, spd, lc, rc)
        
        return jsonify({
            "action": result["speed_action"],
            "path": result["path_action"],
            "distance_membership": result["distance_membership"],
            "speed_membership": result["speed_membership"],
            "rule": result["rule"],
            "defuzzified_value": result["defuzzified_value"]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    """Returns the top 10 scores."""
    try:
        with open(LEADERBOARD_FILE, 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/leaderboard', methods=['POST'])
def post_leaderboard():
    """Adds a new score, sorts, limits to top 10, and saves."""
    data = request.json
    if not data or 'name' not in data or 'score' not in data:
        return jsonify({"error": "Invalid data format"}), 400

    try:
        with open(LEADERBOARD_FILE, 'r') as f:
            lb_data = json.load(f)
        
        leaderboard = lb_data.get('leaderboard', [])
        
        # Add new entry
        leaderboard.append({
            "name": str(data['name']).strip().upper() or "ANON",
            "score": int(data['score'])
        })
        
        # Sort descending and truncate to top 10
        leaderboard = sorted(leaderboard, key=lambda x: x['score'], reverse=True)[:10]
        
        lb_data['leaderboard'] = leaderboard
        
        with open(LEADERBOARD_FILE, 'w') as f:
            json.dump(lb_data, f)
            
        return jsonify({"message": "Score saved successfully", "leaderboard": leaderboard})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
