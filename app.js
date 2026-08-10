// Event Listeners wiring



// Keywords Modal
btnKeywordManage.addEventListener('click', () => {
    if (!getDb()) {
        alert("먼저 Firebase 설정을 연동해주세요.");
        return;
    }
    showModal(modalKeywords);
    // Ensure we are loading if not already
    loadKeywords(renderKeywordList);
});

btnAddKeyword.addEventListener('click', () => {
    const text = newKeywordInput.value;
    if (text) {
        addKeyword(text);
        newKeywordInput.value = '';
    }
});

newKeywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnAddKeyword.click();
    }
});

btnUploadCsv.addEventListener('click', () => {
    csvUploadInput.click();
});

csvUploadInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        uploadCsvKeywords(e.target.files[0]);
        e.target.value = ''; // reset
    }
});

btnDownloadCsv.addEventListener('click', downloadCsvTemplate);

// Tabs logic (purely visual for now, checking logic auto-detects columns anyway)
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // We could re-filter data if we loaded multiple sheets, 
        // but for now we assume user uploads the specific file for the selected tab.
    });
});

// Export & Print
btnExportExcel.addEventListener('click', exportToExcel);
btnPrint.addEventListener('click', printResult);

// Initialization
window.addEventListener('DOMContentLoaded', () => {
    if (getDb()) {
        loadKeywords(renderKeywordList);
    }
});
