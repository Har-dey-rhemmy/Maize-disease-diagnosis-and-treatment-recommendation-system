document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.querySelector('.auth-buttons');
    const loggedInUser = localStorage.getItem('maizeUser');

    if (loggedInUser && authContainer) {
        const formattedName = loggedInUser.charAt(0).toUpperCase() + loggedInUser.slice(1);
        authContainer.innerHTML = `
            <div class="user-profile dropdown" id="profileDropdown">
                <div class="profile-trigger" id="profileTrigger">
                    <i class="fa-solid fa-circle-user profile-icon"></i>
                    <span class="profile-name">Hi, ${formattedName}</span>
                    <i class="fa-solid fa-chevron-down caret-icon"></i>
                </div>
                
                <div class="dropdown-menu" id="dropdownMenu">
                    <a href="/history/" class="dropdown-item"><i class="fa-solid fa-clock-rotate-left"></i> Scan History</a>
                    <a href="/settings/" class="dropdown-item"><i class="fa-solid fa-gear"></i> Settings</a>
                    
                    <div class="dropdown-divider"></div>
                    <button id="logoutBtn" class="dropdown-item logout-action">
                        <i class="fa-solid fa-right-from-bracket"></i> Logout
                    </button>
                </div>
            </div>
        `;

        // Dropdown Interaction Logic
        const profileTrigger = document.getElementById('profileTrigger');
        const dropdownMenu = document.getElementById('dropdownMenu');

        profileTrigger.addEventListener('click', (e) => {
            e.stopPropagation(); 
            dropdownMenu.classList.toggle('show');
            profileTrigger.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!profileTrigger.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('show');
                profileTrigger.classList.remove('active');
            }
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('maizeUser');
            localStorage.removeItem('maizeToken'); 
            window.location.reload(); 
        });
    }

    const cameraButton = document.getElementById('cameraButton');
    const browseButton = document.getElementById('browseButton'); 
    const cameraInput = document.getElementById('cameraInput');
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultModal = document.getElementById('resultModal');
    const closeModal = document.getElementById('closeModal');
    const resetBtn = document.getElementById('resetBtn');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const diseaseName = document.getElementById('diseaseName') || document.getElementById('modalDiseaseName');
    const treatmentList = document.getElementById('treatmentList') || document.getElementById('modalTreatment');

    let selectedFile = null;

    // --- BUTTON CLICK LISTENERS ---
    if (browseButton && fileInput) {
        browseButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents dropZone events from interfering
            fileInput.click();
        });
    }

    if (cameraButton && cameraInput) {
        cameraButton.addEventListener('click', (e) => {
            e.stopPropagation();
            cameraInput.click();
        });
    }

    // --- FILE INPUT LISTENERS ---
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            handleFile(this.files[0]);
        });
    }

    if (cameraInput) {
        cameraInput.addEventListener('change', function() {
            handleFile(this.files[0]);
        });
    }

    // --- DRAG AND DROP LISTENERS ---
    if(dropZone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
                dropZone.style.border = "2px dashed #0d6efd"; // Highlight zone
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                dropZone.style.border = "2px dashed #ccc"; // Reset zone
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            handleFile(dt.files[0]);
        });
    }

    // --- CENTRAL IMAGE HANDLER ---
    function handleFile(file) {
        if (file && file.type.startsWith('image/')) {
            selectedFile = file; // Save globally for the API request
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = function() {
                if(imagePreview) imagePreview.src = reader.result;
                if(dropZone) dropZone.style.display = 'none';
                if(previewContainer) previewContainer.style.display = 'block';
            }
        } else {
            alert("Please upload a valid image file.");
        }
    }

    // --- API SUBMISSION ---
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!selectedFile) return;

            const originalBtnHtml = analyzeBtn.innerHTML;
            analyzeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing Leaf...`;
            analyzeBtn.disabled = true;

            const formData = new FormData();
            formData.append('image', selectedFile);

            const token = localStorage.getItem('maizeToken');
            const headers = {};
            if (token) headers['Authorization'] = `Token ${token}`;
            
            const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
            if (csrfInput) headers['X-CSRFToken'] = csrfInput.value;
            
            try {
                const response = await fetch('/api/scan/', {
                    method: 'POST',
                    headers: headers,
                    body: formData
                });
                
                const data = await response.json();

                if (response.ok) {
                    if (diseaseName) diseaseName.textContent = data.disease_name;
                    if (treatmentList) {
                        if (treatmentList.tagName === 'UL') {
                            treatmentList.innerHTML = ''; 
                            const steps = data.treatment.split('. ');
                            steps.forEach(step => {
                                if(step.trim()) {
                                    const li = document.createElement('li');
                                    li.textContent = step + (step.endsWith('.') ? '' : '.');
                                    treatmentList.appendChild(li);
                                }
                            });
                        } else {
                            treatmentList.textContent = data.treatment;
                        }
                    }

                    const confEl = document.getElementById('modalConfidence');
                    if (confEl) confEl.textContent = data.confidence;
                    
                    const threatEl = document.getElementById('modalThreatLevel');
                    if (threatEl) {
                        threatEl.textContent = data.threat_level;
                        threatEl.style.color = (data.threat_level === 'High' || data.threat_level === 'Severe') ? 'red' : 'orange';
                    }

                    const sympEl = document.getElementById('modalSymptoms');
                    if (sympEl) sympEl.textContent = data.symptoms;

                    if (resultModal) resultModal.classList.add('active');
                } else {
                    alert("Analysis Error: " + (data.error || JSON.stringify(data)));
                }
            } catch (error) {
                console.error('Network Error:', error);
                alert("Could not reach the analysis server. Ensure your Django backend is running.");
            } finally {
                analyzeBtn.innerHTML = originalBtnHtml;
                analyzeBtn.disabled = false;
            }
        });
    }

    // --- MODAL & RESET LOGIC ---
    function closeModalWindow() {
        if (resultModal) resultModal.classList.remove('active');
    }

    function resetScanner() {
        closeModalWindow();
        if (fileInput) fileInput.value = '';
        if (cameraInput) cameraInput.value = ''; // Ensure camera input clears too
        if (imagePreview) imagePreview.src = '';
        selectedFile = null; 
        if (previewContainer) previewContainer.style.display = 'none';
        if (dropZone) dropZone.style.display = 'block';
    }

    if (closeModal) closeModal.addEventListener('click', closeModalWindow);
    if (resetBtn) resetBtn.addEventListener('click', resetScanner);
    if (removeFileBtn) removeFileBtn.addEventListener('click', resetScanner);
});