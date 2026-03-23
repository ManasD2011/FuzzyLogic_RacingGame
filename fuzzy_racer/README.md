# Fuzzy Logic AI Racer - Setup Instructions

## Problem Fixed
The cars weren't showing because of incorrect file structure and paths.

## Correct Folder Structure
```
fuzzy_racer/
├── app.py
├── fuzzy/
│   ├── __init__.py
│   └── fuzzy_logic.py
├── templates/
│   └── index.html
├── static/
│   ├── css/
│   │   ├── style.css
│   │   ├── vehicles.css
│   │   └── visualizer.css
│   └── js/
│       ├── api.js
│       ├── game.js
│       ├── obstacle.js
│       └── player.js
└── data/
    └── leaderboard.json (created automatically)
```

## Installation Steps

1. **Navigate to the project folder:**
   ```bash
   cd C:\Users\VIT\Downloads\fuzzy_racer
   ```

2. **Install required package:**
   ```bash
   py -m pip install flask
   ```

3. **Run the application:**
   ```bash
   py app.py
   ```

4. **Open your browser:**
   Go to: `http://127.0.0.1:5000`

## Controls

### Driving Controls
- **Arrow Up**: Accelerate
- **Arrow Down**: Brake
- **Arrow Left**: Move left
- **Arrow Right**: Move right

### Menu Controls
- **SPACE**: Start game from main menu
- **R**: Restart game (on Game Over screen)
- **Q**: Quit to main menu (on Game Over screen)

## How It Works
- The **player car (blue)** is controlled by you
- **1 AI car (red/orange)** uses fuzzy logic from Python backend to race against you
- **Obstacles (cones and stones)** appear randomly - avoid them or crash!
- The fuzzy visualizer on the right shows the AI decision-making process in real-time
- Try to get the highest score by driving fast and avoiding crashes!

Enjoy racing!

## Troubleshooting

### Cars not visible?
1. Open browser console (F12) and check for errors
2. Look for debug messages showing car positions
3. Visit `http://127.0.0.1:5000/static/test.html` to test if cars render at all
4. Make sure you're using a modern browser (Chrome, Firefox, Edge)

### Game closes immediately?
- The game should NOT close automatically
- After game over, press **R** to restart or **Q** to quit
- Check the browser console for any JavaScript errors

### Fuzzy logic not updating?
- The visualizer updates 5 times per second when AI car is active
- Green log text shows real-time decisions
- Distance and speed graphs update dynamically

