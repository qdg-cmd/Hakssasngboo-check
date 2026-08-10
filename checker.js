// Excel Checking Logic

let currentExcelData = []; // Array of objects
let currentHeaders = [];
let currentResults = [];

function parseExcelFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // Assume the first sheet is the one we want
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON array
            const json = XLSX.utils.sheet_to_json(worksheet, {header: 1}); // header: 1 returns 2D array
            
            if (json.length < 1) {
                throw new Error("데이터가 없습니다.");
            }

            currentHeaders = json[0];
            currentExcelData = [];
            
            for (let i = 1; i < json.length; i++) {
                if (json[i].length === 0) continue;
                let rowObj = {};
                currentHeaders.forEach((header, index) => {
                    rowObj[header] = json[i][index] || "";
                });
                currentExcelData.push(rowObj);
            }
            
            callback(true);
        } catch (error) {
            console.error(error);
            alert("엑셀 파일을 읽는 중 오류가 발생했습니다: " + error.message);
            callback(false);
        }
    };
    reader.readAsArrayBuffer(file);
}

function analyzeHeadersAndIdentifyColumns() {
    let nameCol = null;
    let textCols = [];
    
    // Auto-detect Name column
    const nameKeywords = ["성명", "이름", "학생명"];
    for (const h of currentHeaders) {
        if (!h) continue;
        const hStr = h.toString().trim();
        if (nameKeywords.some(kw => hStr.includes(kw))) {
            nameCol = h;
            break;
        }
    }
    
    // If not found, use the first column that has short strings
    if (!nameCol && currentHeaders.length > 0) {
        nameCol = currentHeaders[0]; // fallback
    }

    // Auto-detect Text columns (exclude ID/Name, look for long texts or common headers)
    const excludeKeywords = ["성명", "이름", "학번", "번호", "순번", "성별"];
    for (const h of currentHeaders) {
        if (!h) continue;
        const hStr = h.toString().trim();
        if (!excludeKeywords.some(kw => hStr.includes(kw))) {
            textCols.push(h);
        }
    }
    
    // Fallback: if no textCols, just use all except nameCol
    if (textCols.length === 0) {
        textCols = currentHeaders.filter(h => h !== nameCol);
    }
    
    return { nameCol, textCols };
}

function checkData() {
    const { nameCol, textCols } = analyzeHeadersAndIdentifyColumns();
    const expandedKeywords = getExpandedKeywords();
    
    currentResults = [];

    currentExcelData.forEach(row => {
        let studentName = row[nameCol] || "알수없음";
        let hasErrorInRow = false;
        let rowResult = {
            studentName: studentName,
            originalData: row,
            errors: []
        };
        
        textCols.forEach(col => {
            const cellText = (row[col] || "").toString();
            if (!cellText) return;
            
            // 1. Keyword check
            let foundKeywords = [];
            expandedKeywords.forEach(kw => {
                if (cellText.includes(kw)) {
                    foundKeywords.push(kw);
                }
            });
            
            // 2. Space check
            const isStartSpace = cellText.startsWith(" ");
            const isEndSpace = cellText.endsWith(" ");
            const doubleSpaceMatch = cellText.match(/([가-힣a-zA-Z0-9]+)\s{2,}([가-힣a-zA-Z0-9]+)/);
            const hasDoubleSpace = /\s{2,}/.test(cellText);
            
            let spaceMsgs = [];
            if (isStartSpace) spaceMsgs.push("시작 공백");
            if (isEndSpace) spaceMsgs.push("끝 공백");
            if (hasDoubleSpace) {
                if (doubleSpaceMatch) {
                    spaceMsgs.push(`'${doubleSpaceMatch[1]}'와 '${doubleSpaceMatch[2]}' 사이 연속공백`);
                } else {
                    spaceMsgs.push("연속공백");
                }
            }
            
            if (foundKeywords.length > 0 || spaceMsgs.length > 0) {
                hasErrorInRow = true;
                rowResult.errors.push({
                    column: col,
                    text: cellText,
                    foundKeywords: Array.from(new Set(foundKeywords)),
                    spaceErrors: spaceMsgs
                });
            }
        });
        
        currentResults.push(rowResult);
    });
    
    return currentResults;
}
