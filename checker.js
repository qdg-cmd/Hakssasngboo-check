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

    // 탭별로 확인할 열 인덱스 설정 (A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9)
    // - 행동발달: 성명 B(1), 내용 D(3)
    // - 교과세특: 성명 B(1), 내용 C(2)
    // - 창체: 성명 B(1), 내용 F(5)
    // - 단일과목: 성명 H(7), 내용 J(9), 학년 C(2), 반/번호 G(6)
    
    let nameColIdx = 1; // 기본 성명 열
    let contentColIdx = 3; // 기본 내용 열

    if (tabType === 'behavior') {
        contentColIdx = 3; // D열
    } else if (tabType === 'subject') {
        contentColIdx = 2; // C열
    } else if (tabType === 'creative') {
        contentColIdx = 5; // F열
    } else if (tabType === 'subject-single') {
        nameColIdx = 7; // H열
        contentColIdx = 9; // J열
    }

    currentExcelData.forEach((row, rowIndex) => {
        // 데이터가 충분히 긴지 확인
        if (!row || row.length <= Math.max(nameColIdx, contentColIdx)) return;
        
        let studentName = (row[nameColIdx] || "").toString().trim();
        const cellText = (row[contentColIdx] || "").toString();

        // 단일과목의 경우 학년과 반/번호를 성명 앞에 붙여서 식별하기 쉽게 만들기
        if (tabType === 'subject-single' && studentName && studentName !== "성명" && studentName !== "이름") {
            const grade = (row[2] || "").toString().trim();
            const classNum = (row[6] || "").toString().trim();
            if (grade || classNum) {
                studentName = `[${grade}학년 ${classNum}] ${studentName}`;
            }
        }

        // 이름이 없거나, 내용이 없거나, '성명' 같은 헤더 행이면 건너뛰기
        if (!studentName || !cellText || studentName === "성명" || studentName === "이름") {
            return;
        }
        
        let hasErrorInRow = false;
        let rowResult = {
            studentName: studentName,
            originalData: {
                "학생 성명": studentName,
                "검사 내용": cellText
            },
            errors: []
        };
        
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
            rowResult.errors.push({
                column: "내용",
                text: cellText,
                foundKeywords: Array.from(new Set(foundKeywords)),
                spaceErrors: spaceMsgs
            });
        }
        
        currentResults.push(rowResult);
    });
    
    return currentResults;
}
