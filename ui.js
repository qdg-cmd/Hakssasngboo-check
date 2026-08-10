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

// UI Event Listeners and DOM Manipulation

const tabBtns = document.querySelectorAll('.tab-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('upload-zone') || document.getElementById('drop-zone'); // fallback id
const resultArea = document.getElementById('result-area');
const resultTableBody = document.getElementById('result-table-body');
const resultTableHead = document.getElementById('result-table-head');
const printBtn = document.getElementById('print-btn');
const exportBtn = document.getElementById('export-btn');

// Upload Elements
const uploadZone = document.getElementById('upload-zone');
const excelFileInput = document.getElementById('excel-file-input');
const spinner = document.getElementById('loading-spinner');
const btnExportExcel = document.getElementById('btn-export-excel');
const btnPrint = document.getElementById('btn-print');
const btnFilterError = document.getElementById('btn-filter-error');

let isFilterErrorOnly = false;

if (btnFilterError) {
    btnFilterError.addEventListener('click', () => {
        isFilterErrorOnly = !isFilterErrorOnly;
        if (isFilterErrorOnly) {
            btnFilterError.textContent = "모두 보기";
            document.querySelectorAll('.row-normal').forEach(el => el.style.display = 'none');
        } else {
            btnFilterError.textContent = "⚠️ 확인 필요만 보기";
            document.querySelectorAll('.row-normal').forEach(el => el.style.display = '');
        }
    });
}

const NEIS_PATHS = {
    'behavior': "[나이스] - [학급담임] - [학교생활기록부] - [학생부 전체 반영] - (학생부 항목별 조회) - '행발(현재학년) XLS Data로 저장'",
    'creative': "[나이스] - [학급담임] - [학교생활기록부] - [학생부 전체 반영] - (학생부 항목별 조회) - '창체(활동별) XLS Data로 저장'",
    'subject': "[나이스] - [학급담임] - [학교생활기록부] - [학생부 전체 반영] - (학생부 항목별 조회) - '세부능력및특기사항(현재학년) XLS Data로 저장'",
    'subject-single': "[나이스] - [교과담임] - [성적] - [성적처리] - [과목별세부능력및특기사항] - (조회 후 엑셀 내려받기)"
};

function updatePathInfo(type) {
    const pathText = document.getElementById('path-text');
    if (pathText && NEIS_PATHS[type]) {
        pathText.textContent = NEIS_PATHS[type];
    }
}

// Tabs logic
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updatePathInfo(btn.dataset.type);
    });
});

// Initialize path text
document.addEventListener('DOMContentLoaded', () => {
    const activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn) {
        updatePathInfo(activeBtn.dataset.type);
    }
});

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

    const totalCount = results.length;
    const errorCount = results.filter(r => r.errors.length > 0).length;
    
    const summaryText = document.getElementById('summary-text');
    if (summaryText) {
        summaryText.innerHTML = `총 <strong>${totalCount}</strong>명 중 확인 필요 <strong>${errorCount}</strong>명`;
    }

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
        
        if (res.errors && res.errors.length > 0) {
            tr.classList.add('row-error');
        } else {
            tr.classList.add('row-normal');
            if (isFilterErrorOnly) {
                tr.style.display = 'none';
            }
        }
        
        // Name
        const tdName = document.createElement('td');
        tdName.textContent = res.studentName;
        tr.appendChild(tdName);

        // Content
        const tdContent = document.createElement('td');
        
        let highlightedText = res.cellText;
        
        // 하이라이트 적용 (에러가 있는 경우)
        if (res.errors && res.errors.length > 0) {
            // 이스케이프 함수
            const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            res.errors.forEach(err => {
                // 단어 하이라이트
                if (err.foundKeywords && err.foundKeywords.length > 0) {
                    err.foundKeywords.forEach(kw => {
                        const regex = new RegExp(escapeRegExp(kw), 'g');
                        highlightedText = highlightedText.replace(regex, `<span class="highlight-keyword">${kw}</span>`);
                    });
                }
                
                // 공백 하이라이트 (연속, 시작, 끝)
                if (err.spaceErrors && err.spaceErrors.length > 0) {
                    highlightedText = highlightedText.replace(/\s{2,}/g, `<span class="highlight-space">␣␣</span>`);
                    if (err.spaceErrors.includes("시작 공백")) {
                        highlightedText = highlightedText.replace(/^\s+/, `<span class="highlight-space">␣</span>`);
                    }
                    if (err.spaceErrors.includes("끝 공백")) {
                        highlightedText = highlightedText.replace(/\s+$/, `<span class="highlight-space">␣</span>`);
                    }
                }
            });
        }
        
        // 내용을 모두 표시하도록 설정 (기존의 자르기 로직 제거)
        tdContent.innerHTML = highlightedText;
        tdContent.style.whiteSpace = "pre-wrap"; // 줄바꿈과 공백 유지
        tdContent.style.minWidth = "300px";
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
