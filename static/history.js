document.addEventListener('DOMContentLoaded', async () => {
    const historyGrid = document.getElementById('historyGrid');
    const token = localStorage.getItem('maizeToken');
    const BASE_URL = 'http://127.0.0.1:8000/api';

    if (!token) {
        window.location.href = "auth.html";
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/history/`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            renderHistory(data);
        } else {
            localStorage.removeItem('maizeToken');
            localStorage.removeItem('maizeUser');
            window.location.href = "auth.html";
        }
    } catch (error) {
        console.error('Error fetching history:', error);
        historyGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fa-solid fa-triangle-exclamation" style="color: #d32f2f;"></i>
                <p>Could not connect to the server. Please ensure Django is running.</p>
            </div>
        `;
    }

    function renderHistory(scans) {
        if (scans.length === 0) {
            historyGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <i class="fa-solid fa-leaf"></i>
                    <p>You haven't scanned any leaves yet.</p>
                    <a href="/" class="nav-btn" style="display: inline-block; margin-top: 1rem;">Start a Scan</a>
                </div>
            `;
            return;
        }

        historyGrid.innerHTML = '';

        scans.forEach(scan => {
            const card = document.createElement('div');
            card.className = 'history-card';
            
            const confidencePercent = (parseFloat(scan.confidence) * 100).toFixed(1);

            card.innerHTML = `
                <img src="${scan.image_url || 'placeholder.jpg'}" alt="Leaf Scan" class="history-img" onerror="this.src='https://via.placeholder.com/300x200?text=Image+Unavailable'">
                <div class="history-details">
                    <div class="history-disease">${scan.disease_name}</div>
                    <div class="history-meta">
                        <span><i class="fa-regular fa-calendar"></i> ${scan.date}</span>
                        <span class="confidence-badge">${confidencePercent}% Match</span>
                    </div>
                </div>
            `;
            historyGrid.appendChild(card);
        });
    }
});