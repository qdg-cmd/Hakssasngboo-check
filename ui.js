// Modals
const modalKeywords = document.getElementById('modal-keywords');
const modalManual = document.getElementById('modal-manual');
const modalAiSettings = document.getElementById('modal-ai-settings');
const btnKeywordManage = document.getElementById('btn-keyword-manage');
const btnManual = document.getElementById('btn-manual');
const btnAiSettings = document.getElementById('btn-ai-settings');
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

// Modal Triggers
if (btnKeywordManage) {
    btnKeywordManage.addEventListener('click', () => showModal(modalKeywords));
}
if (btnManual) {
    btnManual.addEventListener('click', () => showModal(modalManual));
}
if (btnAiSettings) {
    btnAiSettings.addEventListener('click', () => {
        // Load settings into modal
        const settings = typeof getAiSettings === 'function' ? getAiSettings() : { apiKey: '', model: 'gemini-1.5-flash' };
        document.getElementById('ai-api-key').value = settings.apiKey;
        document.getElementById('ai-model-select').value = settings.model;
        showModal(modalAiSettings);
    });
}

const btnSaveAiSettings = document.getElementById('btn-save-ai-settings');
if (btnSaveAiSettings) {
    btnSaveAiSettings.addEventListener('click', () => {
        const key = document.getElementById('ai-api-key').value.trim();
        const model = document.getElementById('ai-model-select').value;
        if (typeof saveAiSettings === 'function') {
            saveAiSettings(key, model);
            alert("AI 설정이 저장되었습니다.");
            hideModal(modalAiSettings);
            // API 키가 방금 입력되었다면 화면의 버튼 상태(필요 -> 검토)를 업데이트
            if (window.currentRenderedResults) {
                renderResults(window.currentRenderedResults);
            }
        }
    });
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
    window.currentRenderedResults = results; // 저장을 위해 전역 변수에 할당
    
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
        
        // AI 검토 컨테이너 준비 (tdDetails의 마지막 자식으로 추가)
        const tdDetailsToAppend = tr.lastChild;
        
        const aiReviewBtn = document.createElement('button');
        aiReviewBtn.className = 'btn-ai-review';
        
        const aiFeedbackContainer = document.createElement('div');
        aiFeedbackContainer.className = 'ai-feedback-container hidden';
        
        const currentSettings = typeof getAiSettings === 'function' ? getAiSettings() : { apiKey: '' };
        
        if (!currentSettings.apiKey) {
            // API 키가 없을 때의 동작
            aiReviewBtn.innerHTML = '🔑 API 키 설정 필요';
            aiReviewBtn.style.backgroundColor = '#fff0f0';
            aiReviewBtn.style.color = '#d32f2f';
            aiReviewBtn.style.borderColor = '#ffcdd2';
            aiReviewBtn.addEventListener('click', () => {
                if (btnAiSettings) btnAiSettings.click(); // 설정 모달 열기
            });
        } else {
            // API 키가 있을 때의 정상 동작
            aiReviewBtn.innerHTML = '✨ AI 정밀 검토';
            aiReviewBtn.addEventListener('click', () => {
                if (aiReviewBtn.disabled) return;
                
                aiReviewBtn.disabled = true;
                const originalText = aiReviewBtn.innerHTML;
                aiReviewBtn.innerHTML = '⏳ 검토 중...';
                
                reviewWithAI(res.originalData["입력 내용"], (result) => {
                    aiReviewBtn.innerHTML = originalText;
                    aiReviewBtn.disabled = false;
                    
                    if (result.error) {
                        alert(result.error);
                        return;
                    }
                    
                    // 성공 시 화면 반영
                    const aiData = result.data;
                    
                    // 1. 상세 내용 업데이트
                    aiFeedbackContainer.classList.remove('hidden');
                    aiFeedbackContainer.innerHTML = `
                        <div class="ai-feedback-title">기재 금지 사항 검토 결과</div>
                        <div style="margin-bottom:8px;">${aiData.inspection_result.replace(/\n/g, '<br>')}</div>
                        <div class="ai-feedback-title">서술 개선 피드백</div>
                        <div>${aiData.feedback.replace(/\n/g, '<br>')}</div>
                    `;
                    
                    // 2. 입력 내용 텍스트 하이라이트 업데이트
                    if (aiData.problematic_phrases && aiData.problematic_phrases.length > 0) {
                        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        
                        aiData.problematic_phrases.forEach(phrase => {
                            if (!phrase) return;
                            const regex = new RegExp(escapeRegExp(phrase), 'g');
                            tdContent.innerHTML = tdContent.innerHTML.replace(regex, `<span class="ai-highlight">${phrase}</span>`);
                        });
                    }
                    
                    // AI 검토 결과에 따른 색상 및 상태 표시 변경
                    const noErrorsFound = aiData.inspection_result.includes("기재 금지 위반 사항이 발견되지 않았습니다.") || (aiData.problematic_phrases && aiData.problematic_phrases.length === 0);
                    
                    if (noErrorsFound) {
                        tr.classList.remove('row-error');
                        tr.classList.add('row-ai-success');
                        tr.style.display = '';
                        
                        const statusTd = tr.querySelector('td:nth-child(3)');
                        if (statusTd) {
                            statusTd.innerHTML = '<span class="status-ok">✅ AI 검토 완료<br>(위반 없음)</span>';
                        }
                    } else {
                        tr.classList.add('row-error'); 
                        tr.style.display = '';
                        
                        const statusTd = tr.querySelector('td:nth-child(3)');
                        if (statusTd && statusTd.textContent.includes('이상 없음')) {
                            statusTd.innerHTML = '<span class="status-warn">⚠️ AI 검토 완료</span>';
                        }
                    }
                });
            });
        }
        
        tdDetailsToAppend.appendChild(document.createElement('br'));
        tdDetailsToAppend.appendChild(aiReviewBtn);
        tdDetailsToAppend.appendChild(aiFeedbackContainer);
        
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
