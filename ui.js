// Modals
const modalKeywords = document.getElementById('modal-keywords');
const btnKeywordManage = document.getElementById('btn-keyword-manage');
const closeBtns = document.querySelectorAll('.close-modal');

// Keyword Elements
const keywordListEl = document.getElementById('keyword-list');
const newKeywordInput = document.getElementById('new-keyword-input');
const btnAddKeyword = document.getElementById('btn-add-keyword');
const btnUploadCsv = document.getElementById('btn-upload-csv');
const csvUploadInput = document.getElementById('csv-upload-input');
const btnDownloadCsv = document.getElementById('btn-download-csv');

// Upload Elements
const uploadZone = document.getElementById('upload-zone');
const excelFileInput = document.getElementById('excel-file-input');
const spinner = document.getElementById('loading-spinner');

// Result Elements
const resultArea = document.getElementById('result-area');
const resultTableHead = document.getElementById('result-table-head');
const resultTableBody = document.getElementById('result-table-body');
const btnExportExcel = document.getElementById('btn-export-excel');
const btnPrint = document.getElementById('btn-print');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');

function showModal(modal) {
    modal.classList.remove('hidden');
}

function hideModal(modal) {
    modal.classList.add('hidden');
}

closeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        hideModal(e.target.closest('.modal'));
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        hideModal(e.target);
    }
});

function renderKeywordList(keywords) {
    keywordListEl.innerHTML = '';
    keywords.forEach(kw => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${kw.text}</span>
            <button onclick="deleteKeyword('${kw.id}')">&times;</button>
        `;
        keywordListEl.appendChild(li);
    });
}

function renderResults(results) {
    resultTableHead.innerHTML = '';
    resultTableBody.innerHTML = '';

    if (results.length === 0) return;

    // Header
    const thName = document.createElement('th');
    thName.textContent = '학생 정보';
    resultTableHead.appendChild(thName);

    const thContent = document.createElement('th');
    thContent.textContent = '입력 내용';
    resultTableHead.appendChild(thContent);

    const thStatus = document.createElement('th');
    thStatus.textContent = '점검 결과';
    resultTableHead.appendChild(thStatus);
    
    const thDetails = document.createElement('th');
    thDetails.textContent = '상세 내용';
    resultTableHead.appendChild(thDetails);

    // Body
    results.forEach(res => {
        const tr = document.createElement('tr');
        
        // Name
        const tdName = document.createElement('td');
        tdName.textContent = res.studentName;
        tr.appendChild(tdName);

        // Content
        const tdContent = document.createElement('td');
        // 긴 내용은 적당히 자르거나 그대로 표시 (CSS로 제어)
        tdContent.textContent = res.cellText; 
        tdContent.style.maxWidth = "400px";
        tdContent.style.overflow = "hidden";
        tdContent.style.textOverflow = "ellipsis";
        tdContent.style.whiteSpace = "nowrap";
        tdContent.title = res.cellText; // 마우스 오버 시 전체 내용 표시
        tr.appendChild(tdContent);

        // Status
        const tdStatus = document.createElement('td');
        if (res.errors.length === 0) {
            tdStatus.innerHTML = '<span class="status-ok">✅ 이상 없음</span>';
            const tdDetails = document.createElement('td');
            tdDetails.textContent = '-';
            tr.appendChild(tdStatus);
            tr.appendChild(tdDetails);
        } else {
            tdStatus.innerHTML = '<span class="status-warn">⚠️ 확인 필요</span>';
            tr.appendChild(tdStatus);
            
            const tdDetails = document.createElement('td');
            let detailsHtml = '';
            
            res.errors.forEach(err => {
                let html = `<div>`;
                if (err.foundKeywords.length > 0) {
                    html += `유의어: <span class="highlight-error">${err.foundKeywords.join(', ')}</span> `;
                }
                if (err.spaceErrors.length > 0) {
                    html += `공백오류: <span class="highlight-error">${err.spaceErrors.join(', ')}</span>`;
                }
                html += `</div>`;
                detailsHtml += html;
            });
            tdDetails.innerHTML = detailsHtml;
            tr.appendChild(tdDetails);
        }
        
        resultTableBody.appendChild(tr);
    });

    resultArea.classList.remove('hidden');
}

// Drag & Drop
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

uploadZone.addEventListener('click', () => {
    excelFileInput.click();
});

excelFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    if (!getDb()) {
        alert("먼저 Firebase 설정을 완료하여 유의어 목록을 불러와야 합니다.");
        return;
    }
    
    spinner.classList.remove('hidden');
    resultArea.classList.add('hidden');
    
    // Small delay to allow UI to show spinner
    setTimeout(() => {
        parseExcelFile(file, (success) => {
            if (success) {
                const results = checkData();
                renderResults(results);
            }
            spinner.classList.add('hidden');
            // reset file input so same file can be uploaded again if needed
            excelFileInput.value = '';
        });
    }, 100);
}
