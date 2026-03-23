/**
 * Wrapper for API calls to the Python Flask backend.
 */
const api = {
    // Queries the Python Fuzzy Logic engine asynchronously
    getFuzzyDecision: async (distance, speed, leftClearance = 500, rightClearance = 500) => {
        try {
            const response = await fetch('/fuzzy-decision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ distance, speed, leftClearance, rightClearance })
            });
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data; // Returns { action: "...", path: "..." }
        } catch (error) {
            console.error('Fuzzy API Error:', error);
            return { action: "Maintain Speed", path: "Keep Lane" }; // Failsafe
        }
    },

    // Fetches top 10 scores
    getLeaderboard: async () => {
        try {
            const response = await fetch('/leaderboard');
            const data = await response.json();
            return data.leaderboard || [];
        } catch (error) {
            console.error('Leaderboard Fetch Error:', error);
            return [];
        }
    },

    // Saves a new score
    saveScore: async (name, score) => {
        try {
            const response = await fetch('/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, score })
            });
            const data = await response.json();
            return data.leaderboard || [];
        } catch (error) {
            console.error('Score Save Error:', error);
            return [];
        }
    }
};
