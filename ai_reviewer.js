// AI Reviewer Module

const AI_API_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/";

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

const FLASH_CANDIDATES = [
    "models/gemini-1.5-flash-latest",
    "models/gemini-1.5-flash",
    "models/gemini-1.5-flash-8b",
    "models/gemini-2.0-flash",
    "models/gemini-2.0-flash-exp",
    "models/gemini-2.5-flash"
];

const PRO_CANDIDATES = [
    "models/gemini-1.5-pro-latest",
    "models/gemini-1.5-pro",
    "models/gemini-2.0-pro",
    "models/gemini-2.5-pro"
];

function getAiSettings() {
    return {
        apiKey: localStorage.getItem('gemini_api_key') || '',
        model: localStorage.getItem('gemini_model') || 'flash'
    };
}

function saveAiSettings(apiKey, model) {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('gemini_model', model);
}

let discoveredModelsCache = {
    flash: "",
    pro: ""
};

// 특정 모델이 실제로 호출 가능한지 가볍게 테스트하는 함수
async function testModelAccess(apiKey, modelPath) {
    const testUrl = `${AI_API_URL_BASE}${modelPath}:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: "ping" }] }],
        generationConfig: { maxOutputTokens: 1 }
    };
    try {
        const res = await fetch(testUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            return true;
        }
        const data = await res.json();
        console.warn(`[AI 모델 테스트 실패] ${modelPath}:`, data.error?.message);
        return false;
    } catch (e) {
        console.warn(`[AI 모델 네트워크 실패] ${modelPath}:`, e);
        return false;
    }
}

// 자동 모델 탐색 및 실 사용 테스트까지 진행하는 초강력 모델 해결기
async function discoverModel(apiKey, preference) {
    if (discoveredModelsCache[preference]) {
        return discoveredModelsCache[preference];
    }

    const candidates = preference === "pro" ? PRO_CANDIDATES : FLASH_CANDIDATES;
    
    // 1단계: API 키의 권한이 허용하는 경우, 사용 가능한 공식 모델 목록을 직접 받아옴
    try {
        const listUrl = `${AI_API_URL_BASE}models?key=${apiKey}`;
        const res = await fetch(listUrl);
        if (res.ok) {
            const data = await res.json();
            const models = data.models || [];
            
            // 사용 가능한 모델 중 generateContent를 지원하는 gemini 계열 필터링
            const listedGeminiModels = models
                .filter(m => 
                    m.supportedGenerationMethods && 
                    m.supportedGenerationMethods.includes("generateContent") &&
                    m.name.includes("models/gemini")
                )
                .map(m => m.name);

            // 해당 목록 중 preference(flash 또는 pro)에 맞는 모델들을 우선순위 정렬
            const matchedModels = listedGeminiModels.filter(name => name.toLowerCase().includes(preference));
            const otherModels = listedGeminiModels.filter(name => !name.toLowerCase().includes(preference));
            const searchQueue = [...matchedModels, ...otherModels];

            // 사용 가능한 후보군에 대해 실제로 호출이 가능한지 1개씩 순서대로 테스트
            for (const modelPath of searchQueue) {
                const isAccessible = await testModelAccess(apiKey, modelPath);
                if (isAccessible) {
                    console.log(`[AI 모델 자동 탐색 성공] 실제 호출 가능한 모델 결정: ${modelPath}`);
                    discoveredModelsCache[preference] = modelPath;
                    return modelPath;
                }
            }
        }
    } catch (listError) {
        console.warn("[AI 모델 목록 조회 실패] API 키 권한 제한 등으로 인해 후보군 순차 직접 검증을 진행합니다.", listError);
    }

    // 2단계: API 키에 모델 목록 조회 권한이 없거나 목록에 있는 모델이 차단된 경우,
    // 정의된 최신 후보 리스트(CANDIDATES)를 순서대로 직접 찔러보며 통과하는 모델을 찾음
    console.log(`[AI 모델 수동 검증 시작] 선호 유형: ${preference}`);
    for (const modelPath of candidates) {
        const isAccessible = await testModelAccess(apiKey, modelPath);
        if (isAccessible) {
            console.log(`[AI 모델 수동 검증 성공] 사용 가능한 모델 발견: ${modelPath}`);
            discoveredModelsCache[preference] = modelPath;
            return modelPath;
        }
    }

    // 3단계: 모든 시도가 다 실패한 경우 마지막 보루로 가장 널리 쓰이는 표준 이름 반환
    const absoluteFallback = preference === "pro" ? "models/gemini-1.5-pro" : "models/gemini-1.5-flash";
    console.warn(`[AI 모델 탐색 최종 실패] 사용 가능한 모델이 전혀 확인되지 않아 기본 모델(${absoluteFallback})로 폴백을 시도합니다.`);
    return absoluteFallback;
}

async function reviewWithAI(text, callback) {
    const settings = getAiSettings();
    
    if (!settings.apiKey) {
        callback({ error: "API 키가 설정되지 않았습니다. 우측 상단의 [⚙️ AI 설정]에서 키를 등록해주세요." });
        return;
    }

    const preference = settings.model.toLowerCase().includes("pro") ? "pro" : "flash";
    
    let modelPath;
    try {
        modelPath = await discoverModel(settings.apiKey, preference);
    } catch (e) {
        callback({ error: "사용 가능한 AI 모델을 탐색하지 못했습니다: " + e.message });
        return;
    }

    const url = `${AI_API_URL_BASE}${modelPath}:generateContent?key=${settings.apiKey}`;
    
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
