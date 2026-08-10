function exportToExcel() {
    if (!currentExcelData || currentExcelData.length === 0 || !currentResults) {
        alert("내보낼 데이터가 없습니다.");
        return;
    }

    // Clone original data and add a "점검결과" column
    const exportData = currentResults.map(result => {
        let row = { ...result.originalData };
        let msg = "✅ 이상 없음";
        
        if (result.errors.length > 0) {
            let errorDetails = result.errors.map(err => {
                let parts = [];
                if (err.foundKeywords && err.foundKeywords.length > 0) parts.push(`유의어: ${err.foundKeywords.join(', ')}`);
                if (err.spaceErrors && err.spaceErrors.length > 0) parts.push(`공백오류: ${err.spaceErrors.join(', ')}`);
                return parts.join(' / ');
            }).join(' | ');
            msg = `⚠️ 확인 필요 -> ${errorDetails}`;
        }
        
        row["점검결과"] = msg;
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "점검결과");
    
    // Auto-size columns: 식별/이름(25), 입력 내용(60), 점검결과(80)
    const wscols = [
        {wch: 25}, 
        {wch: 60},
        {wch: 80}
    ];
    worksheet['!cols'] = wscols;

    XLSX.writeFile(workbook, `기재유의어_점검결과_${new Date().getTime()}.xlsx`);
}

function printResult() {
    window.print();
}
