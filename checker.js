// Excel Checking Logic

let currentExcelData = []; // Array of arrays (raw rows)
let currentResults = [];
let currentHeaders = ["학생 성명", "검사 내용"]; // Standardized for export

function parseExcelFile(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 2D 배열로 읽기
            const json = XLSX.utils.sheet_to_json(worksheet, {header: 1, defval: ""}); 
            
            if (json.length < 1) {
                throw new Error("데이터가 없습니다.");
            }

            currentExcelData = json;
            callback(true);
        } catch (error) {
            console.error(error);
            alert("엑셀 파일을 읽는 중 오류가 발생했습니다: " + error.message);
            callback(false);
        }
    };
    reader.readAsArrayBuffer(file);
}

function getActiveTabType() {
    const activeBtn = document.querySelector('.tab-btn.active');
    return activeBtn ? activeBtn.dataset.type : 'behavior';
}

function checkData() {
    const tabType = getActiveTabType();
    const expandedKeywords = getExpandedKeywords();
    
    currentResults = [];
    let parsedStudents = [];
    let lastValidStudent = null;

    // 1단계: 엑셀 행을 순회하며 학생별로 데이터를 모두 이어붙임 (페이지 잘림, 진로활동 줄바꿈 등 해결)
    currentExcelData.forEach((row) => {
        if (!row || row.length === 0) return;
        
        let studentNum = "";
        let studentName = "";
        let extraInfo = ""; 
        let cellText = "";

        if (tabType === 'behavior') {
            studentNum = (row[0] || "").toString().trim();
            studentName = (row[1] || "").toString().trim();
            cellText = (row[3] || "").toString();
        } else if (tabType === 'subject') {
            studentNum = (row[0] || "").toString().trim();
            studentName = (row[1] || "").toString().trim();
            cellText = (row[3] || "").toString(); 
        } else if (tabType === 'creative') {
            studentNum = (row[0] || "").toString().trim();
            studentName = (row[1] || "").toString().trim();
            extraInfo = (row[3] || "").toString().trim(); 
            cellText = (row[5] || "").toString(); 
        } else if (tabType === 'subject-single') {
            studentNum = (row[6] || "").toString().trim(); 
            studentName = (row[7] || "").toString().trim();
            extraInfo = (row[2] || "").toString().trim(); 
            cellText = (row[9] || "").toString();
        }

        const hasNumber = /\d/.test(studentNum);
        
        // 페이지가 넘어갈 때 반복해서 출력되는 표 머리글이나 꼬리말(페이지 번호) 무시
        const isHeaderJunk = studentName === "성명" || studentName === "이름" || studentName === "학생명" || 
                             (cellText && (cellText.includes("학교생활기록부") || cellText.includes("검사 내용") || cellText === "내용"));
        const isPageNumber = cellText && cellText.trim().match(/^-\s*\d+\s*-$/);
        
        if (isHeaderJunk || isPageNumber) return;

        // 새로운 학생 시작
        if (studentName && hasNumber) {
            let displayId = "";
            if (tabType === 'subject-single') {
                displayId = `[${extraInfo}학년 ${studentNum}] ${studentName}`;
            } else {
                displayId = studentNum ? `[${studentNum}번] ${studentName}` : studentName;
                if (tabType === 'creative' && extraInfo) {
                    displayId += ` (${extraInfo})`;
                }
            }
            
            lastValidStudent = {
                displayId: displayId,
                cellText: cellText || ""
            };
            parsedStudents.push(lastValidStudent);
        } 
        // 학생 정보는 비어있지만 텍스트가 있는 경우 (페이지 잘림으로 이어지는 문장이거나, 진로활동처럼 한 칸 아래에 적힌 경우)
        else if ((!studentName || !hasNumber) && cellText && lastValidStudent) {
            if (lastValidStudent.cellText) {
                // 엑셀에서 페이지가 잘릴 때 띄어쓰기 없이 문장 중간이 뚝 끊기므로そのまま 이어붙임
                lastValidStudent.cellText += cellText;
            } else {
                lastValidStudent.cellText = cellText;
            }
        }
    });

    // 2단계: 완벽하게 하나로 합쳐진 텍스트를 대상으로 금지어 및 공백 오류 검사 수행
    parsedStudents.forEach(student => {
        if (!student.cellText) return; // 내용이 아예 없는 경우는 건너뜀

        let originalData = {
            "식별/이름": student.displayId,
            "입력 내용": student.cellText
        };

        let rowResult = {
            studentName: student.displayId,
            cellText: student.cellText,
            originalData: originalData,
            errors: []
        };
        
        // 1. Keyword check
        let foundKeywords = [];
        expandedKeywords.forEach(kw => {
            if (student.cellText.includes(kw)) {
                foundKeywords.push(kw);
            }
        });
        
        // 2. Space check
        const isStartSpace = student.cellText.startsWith(" ");
        const isEndSpace = student.cellText.endsWith(" ");
        const doubleSpaceMatch = student.cellText.match(/([가-힣a-zA-Z0-9]+)\s{2,}([가-힣a-zA-Z0-9]+)/);
        const hasDoubleSpace = /\s{2,}/.test(student.cellText);
        
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
            rowResult.errors.push({
                foundKeywords: Array.from(new Set(foundKeywords)),
                spaceErrors: spaceMsgs
            });
        }
        
        currentResults.push(rowResult);
    });
    
    return currentResults;
}
