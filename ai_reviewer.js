// AI Reviewer Module

const AI_API_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

const SYSTEM_PROMPT = `
# 역할:
대한민국 교육부의 '2026학년도 고등학교 학교생활기록부 기재요령'을 완벽하게 통달한 최고 수준의 '학생부 기재 및 검토 전문 교사 AI'

## 목표:
사용자가 제공한 학생부 활동 초안(창체, 세특, 행특 등)을 심층 분석하여 사교육 유발 요인 및 기재 금지 사항 위반 여부를 철저히 필터링하고, 규정에 맞게 완벽한 교정안을 도출한다.

## 제약 조건:
* 어떠한 항목에도 다음의 사항을 절대 포함하지 말 것: 공인어학시험 성적, 교외 대회 참여/수상 실적, 교외상, 모의고사 성적, 논문 투고/발표, 도서 출간, 특허 출원, 해외 활동, 부모/친인척의 사회·경제적 지위, 특정 대학/기관/상호/강사명 등.
* 기재 금지 사항 발견 시, 구체적인 사유를 명시할 것.
* 학생의 주도적 참여도, 구체적인 활동 과정, 학업 역량의 변화와 성장을 중심으로 서술 방향을 조언할 것.

## 출력 형식 (JSON):
반드시 다음 구조의 JSON 형식으로만 응답하십시오. 일반 텍스트나 마크다운 코드 블록(\`\`\`json 등)은 포함하지 말고 순수 JSON 객체만 반환하십시오.
{
  "problematic_phrases": ["문제가 되는 텍스트 일부분1", "문제가 되는 텍스트 일부분2"],
  "inspection_result": "기재 금지 사항 검토 결과 (위반 소지 문장 및 사유, 없을 경우 '위반 소지 없음')",
  "feedback": "서술 개선 피드백 (문맥, 어휘 선택, 내용 깊이를 더하기 위한 교사의 전문가적 조언)"
}
※ problematic_phrases에는 원본 텍스트에 존재하는 정확한 문자열만 배열로 넣으십시오. 문제가 없으면 빈 배열 []을 반환하십시오.
`;

function getAiSettings() {
    return {
        apiKey: localStorage.getItem('gemini_api_key') || '',
        model: localStorage.getItem('gemini_model') || 'gemini-1.5-flash'
    };
}

function saveAiSettings(apiKey, model) {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_model', model);
}

async function reviewWithAI(text, callback) {
    const settings = getAiSettings();
    
    if (!settings.apiKey) {
        callback({ error: "API 키가 설정되지 않았습니다. 우측 상단의 [⚙️ AI 설정]에서 키를 등록해주세요." });
        return;
    }

    const url = `${AI_API_URL_BASE}${settings.model}:generateContent?key=${settings.apiKey}`;
    
    const payload = {
        system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [
            {
                role: "user",
                parts: [{ text: text }]
            }
        ],
        generationConfig: {
            responseMimeType: "application/json"
        }
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "API 통신 오류");
        }

        const data = await response.json();
        
        // Gemini API 응답에서 텍스트 추출
        const responseText = data.candidates[0].content.parts[0].text;
        
        try {
            // JSON 파싱
            const jsonResult = JSON.parse(responseText);
            callback({ success: true, data: jsonResult });
        } catch (e) {
            console.error("JSON 파싱 에러:", responseText);
            callback({ error: "AI가 올바른 JSON 형식을 반환하지 않았습니다. 다시 시도해주세요." });
        }

    } catch (error) {
        console.error("AI API 에러:", error);
        callback({ error: "AI 검토 중 오류가 발생했습니다: " + error.message });
    }
}
