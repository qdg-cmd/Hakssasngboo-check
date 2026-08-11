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

    // 전체 파일을 스캔하여 전역 오프셋(열 밀림 현상)을 한 번만 결정
    let globalOffset = 0;
    for (let i = 0; i < Math.min(20, currentExcelData.length); i++) {
        let r = currentExcelData[i];
        if (!r || r.length === 0) continue;
        let rowStr = r.join("").replace(/\s/g, '');
        if (rowStr.includes("성명") || rowStr.includes("이름")) {
            if (r[0] === undefined || r[0] === null || r[0].toString().trim() === "") {
                globalOffset = 1;
            }
            break;
        }
    }

    let lastRowIndex = -1;

    // 1단계: 엑셀 행을 순회하며 학생별로 데이터를 모두 이어붙임 (페이지 잘림, 진로활동 줄바꿈 등 해결)
    currentExcelData.forEach((row, index) => {
        if (!row || row.length === 0) return;
        
        let studentNum = "";
        let studentName = "";
        let extraInfo = ""; 
        let cellText = "";

        if (tabType === 'behavior') {
            studentNum = (row[0 + globalOffset] || "").toString().trim();
            studentName = (row[1 + globalOffset] || "").toString().trim();
            cellText = (row[3 + globalOffset] || "").toString();
        } else if (tabType === 'subject') {
            studentNum = (row[0 + globalOffset] || "").toString().trim();
            studentName = (row[1 + globalOffset] || "").toString().trim();
            cellText = (row[3 + globalOffset] || "").toString(); 
        } else if (tabType === 'creative') {
            studentNum = (row[0 + globalOffset] || "").toString().trim();
            studentName = (row[1 + globalOffset] || "").toString().trim();
            extraInfo = (row[3 + globalOffset] || "").toString().trim(); 
            cellText = (row[5 + globalOffset] || "").toString(); 

            // 진로활동의 경우 첫 번째 줄(F열)은 '희망분야' 등의 라벨 및 희망직업이므로 AI 검토 대상(특기사항)이 아님.
            // 실제 활동 내용은 다음 줄부터 시작하므로 첫 줄은 비워둡니다.
            if (extraInfo.replace(/\s/g, '').includes("진로활동")) {
                cellText = "";
            }
        } else if (tabType === 'subject-single') {
            // 단일과목은 양식이 복잡하여 고정
            studentNum = (row[6] || "").toString().trim(); 
            studentName = (row[7] || "").toString().trim();
            extraInfo = (row[2] || "").toString().trim(); 
            cellText = (row[9] || "").toString();
        }

        const hasNumber = /\d/.test(studentNum);
        
        // 페이지가 넘어갈 때 반복해서 출력되는 표 머리글이나 꼬리말(페이지 번호) 무시
        const cleanStudentName = studentName.replace(/\s/g, '');
        const cleanCellText = cellText ? cellText.replace(/\s/g, '') : '';
        
        const isHeaderJunk = cleanStudentName === "성명" || cleanStudentName === "이름" || cleanStudentName === "학생명" || 
                             (cellText && (cleanCellText.includes("학교생활기록부") || cleanCellText.includes("검사내용") || cleanCellText === "내용" || cleanCellText === "세부능력및특기사항" || cleanCellText.includes("행동특성및종합의견")));
        const isPageNumber = cellText && (
            cellText.trim().match(/^-\s*\d+\s*-$/) || 
            cellText.trim().match(/\d+\s*\/\s*\d+/)
        );
        
        if (isHeaderJunk || isPageNumber) return;

        // 새로운 학생 시작 또는 이름이 다시 적힌 연장선 처리
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
            
            // 만약 방금 추출한 학생 식별자(번호+이름)가 직전에 파싱한 학생과 완전히 똑같다면,
            // 이는 새로운 학생이 아니라 페이지가 넘어가며 엑셀에 이름이 다시 출력된 '연장선'임!
            if (lastValidStudent && lastValidStudent.displayId === displayId) {
                if (cellText) {
                    if (index === lastRowIndex + 1) {
                        lastValidStudent.cellText += "\n" + cellText;
                    } else {
                        lastValidStudent.cellText += cellText;
                    }
                }
            } else {
                // 새로운 학생 시작
                lastValidStudent = {
                    displayId: displayId,
                    cellText: cellText || ""
                };
                parsedStudents.push(lastValidStudent);
            }
            lastRowIndex = index;
        } 
        // 학생 정보는 비어있지만 텍스트가 있는 경우 (페이지 잘림으로 이름 칸이 비어있는 병합 셀 연장선)
        else if ((!studentName || !hasNumber) && cellText && lastValidStudent) {
            if (lastValidStudent.cellText) {
                // 엑셀에서 페이지가 잘릴 때 띄어쓰기 없이 문장 중간이 뚝 끊기므로 그대로 이어붙임
                // 단, 바로 다음 줄(인덱스 차이 1)인 경우는 진로활동의 2번째 줄이거나 구조적인 줄바꿈이므로 개행(\n)으로 이어붙임
                if (index === lastRowIndex + 1) {
                    lastValidStudent.cellText += "\n" + cellText;
                } else {
                    lastValidStudent.cellText += cellText;
                }
            } else {
                lastValidStudent.cellText = cellText;
            }
            lastRowIndex = index;
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
