// AI Reviewer Module

const AI_API_URL_BASE = "https://generativelanguage.googleapis.com/v1beta/";

const SYSTEM_PROMPT = `
# 역할:
대한민국 교육부 '학교생활기록부 기재요령' 완전 무결성 검증을 위한 최고 수석 감사관 (수석 학생부 검토 전문가)

## 목표:
사용자가 입력한 학생부 서술형 항목 초안에서 교육부 지침에 위배되는 '기재 금지 조항'을 100% 식별해 내어, 텍스트 훼손 없이 객관적인 점검 결과와 수정 가이드라인만을 명확하게 보고하는 것.

## 제약 조건:
*   원본 유지 원칙: 입력된 텍스트를 AI가 임의로 교정하거나 다시 작성해서는 절대 안 된다. (모든 교정은 사용자가 직접 수행할 수 있도록 피드백만 제공한다.)
*   엄격성 유지: 제시된 [기재 금지 체크리스트]에 기반하여 매우 깐깐하고 보수적으로 접근하며, 조금이라도 위반 소지가 있다면 지적한다.
*   결과 무결성: 위반 사항이 전혀 발견되지 않은 경우, 피드백 텍스트에 반드시 "기재 금지 위반 사항이 발견되지 않았습니다."라고 명시한다.
*   객관적 톤앤매너: 감정적인 표현을 배제하고 단호하고 전문적인 보고서 형식의 어조를 유지한다.

## 핵심 지침:
1.  텍스트 접수 및 분석: 사용자가 입력한 학생부 서술형 항목(교과세특, 창체, 행특 등) 초안의 문맥과 구조를 파악한다.
2.  기재 금지 체크리스트 필터링: 다음 9가지 기준을 텍스트에 엄격하게 대입하여 위반 여부를 스캔한다.
    *   어학 및 인증시험: 공인어학시험(TOEIC, TOEFL, HSK 등) 및 교내외 인증시험 참여 사실이나 성적
    *   대회 및 외부 수상: 교내·외 대회 참여 사실 및 수상 실적, 교외 기관·단체장에게 받은 교외상(표창장, 감사장 등)
    *   성적 정보: 모의고사·전국연합학력평가 성적(원점수, 석차, 백분위 등) 및 관련 교내 수상
    *   연구 및 저작: 논문 학회지 투고/등재/발표 사실, 도서 출간 사실, 지식재산권(특허, 상표 등) 출원/등록 사실
    *   해외 및 기타: 어학연수, 해외 봉사활동 등 해외 활동 실적, 장학생·장학금 관련 내용
    *   가족 배경: 부모(친인척 포함)의 사회·경제적 지위를 암시하는 내용(직종명, 직업명, 직장명, 직위명 등)
    *   특정 명칭 (블라인드): 구체적인 특정 대학명, 외부 기관명(기구/단체 포함, 단 교육부 등 교육관련기관 예외), 상호명, 강사명
    *   출신 학교 노출: 학생이 재학 중인 고등학교를 유추할 수 있는 명칭(학교명, 재단명, 축제명, 학교 별칭 등)
    *   자격증 우회 기재: '자격증 취득상황' 항목이 아닌 곳에 자격증 명칭 및 취득 사실 언급
3.  핀포인트 피드백 생성: 위반 사항 발견 시, 해당 문장을 발췌하고 구체적인 위반 사유와 함께 어떻게 조치(삭제 또는 중립적 단어로 수정)해야 하는지 명확한 방향을 제시한다.

## 출력 형식 (JSON):
반드시 다음 구조의 JSON 형식으로만 응답하십시오. 일반 텍스트나 마크다운 코드 블록(\`\`\`json 등)은 포함하지 말고 순수 JSON 객체만 반환하십시오.
{
  "problematic_phrases": ["위반이 의심되는 텍스트 일부분1", "위반이 의심되는 텍스트 일부분2"],
  "inspection_result": "총평 (예: 위반 소지 있음 / 기재 금지 위반 사항이 발견되지 않았습니다.)",
  "feedback": "위반 사유 및 수정 권고 (위반 사항이 여러 개일 경우 줄바꿈으로 구분하여 상세히 작성)"
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
    const cacheKey = `gemini_resolved_${preference}`;
    const cachedModel = localStorage.getItem(cacheKey);
    if (cachedModel && discoveredModelsCache[preference] === cachedModel) {
        return cachedModel;
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
                    localStorage.setItem(`gemini_resolved_${preference}`, modelPath);
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
            localStorage.setItem(`gemini_resolved_${preference}`, modelPath);
            return modelPath;
        }
    }

    // 3단계: 모든 시도가 다 실패한 경우 마지막 보루로 가장 널리 쓰이는 표준 이름 반환
    const absoluteFallback = preference === "pro" ? "models/gemini-1.5-pro" : "models/gemini-1.5-flash";
    console.warn(`[AI 모델 탐색 최종 실패] 사용 가능한 모델이 전혀 확인되지 않아 기본 모델(${absoluteFallback})로 폴백을 시도합니다.`);
    return absoluteFallback;
}

async function reviewWithAI(text, callback, isRetry = false) {
    const settings = getAiSettings();
    
    if (!settings.apiKey) {
        callback({ error: "API 키가 설정되지 않았습니다. 우측 상단의 [⚙️ AI 설정]에서 키를 등록해주세요." });
        return;
    }

    const preference = settings.model.toLowerCase().includes("pro") ? "pro" : "flash";
    
    let modelPath = localStorage.getItem(`gemini_resolved_${preference}`);
    
    // 캐시된 모델이 없거나, 캐시된 모델이 실패해서 재시도(isRetry)하는 경우 탐색 실행
    if (!modelPath || isRetry) {
        try {
            modelPath = await discoverModel(settings.apiKey, preference);
        } catch (e) {
            callback({ error: "사용 가능한 AI 모델을 탐색하지 못했습니다: " + e.message });
            return;
        }
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
            const errorMsg = errorData.error?.message || "API 통신 오류";
            
            // 만약 현재 캐시된 모델이 더 이상 유효하지 않다는(400, 403, 404) 에러면 캐시를 지우고 재시도
            if (!isRetry && (response.status === 404 || response.status === 403 || response.status === 400 || errorMsg.includes("not found") || errorMsg.includes("no longer available"))) {
                console.warn(`[AI 모델 캐시 만료 감지] 기존 모델(${modelPath})이 막혔습니다. 재탐색을 시작합니다.`);
                localStorage.removeItem(`gemini_resolved_${preference}`);
                discoveredModelsCache[preference] = "";
                // 1회에 한해 다시 탐색 및 실행
                return reviewWithAI(text, callback, true);
            }
            
            throw new Error(errorMsg);
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
