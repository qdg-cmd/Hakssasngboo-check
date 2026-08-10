let cachedKeywords = [];
let unsubscribe = null;

// Normalize keywords to ignore brackets when generating the expanded list, like the original Excel formula
// However, the original formula:
// expanded = UNIQUE(FLATTEN(MAP(kw_list, LAMBDA(k, SPLIT(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(k, ")", ""), "）", ""), "（", "("), "( ")))))
// This essentially removes closing brackets and splits by "(".
function expandKeyword(kw) {
    const cleaned = kw.replace(/\)|）/g, '').replace(/（/g, '(');
    return cleaned.split('(').map(s => s.trim()).filter(s => s.length > 0);
}

function getExpandedKeywords() {
    let expanded = new Set();
    cachedKeywords.forEach(k => {
        expandKeyword(k.text).forEach(ek => expanded.add(ek));
    });
    return Array.from(expanded);
}

function loadKeywords(renderCallback) {
    const db = getDb();
    if (!db) {
        alert("Firebase 연동이 필요합니다.");
        return;
    }

    if (unsubscribe) unsubscribe();

    unsubscribe = db.collection('keywords').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        cachedKeywords = [];
        snapshot.forEach(doc => {
            cachedKeywords.push({ id: doc.id, text: doc.data().text });
        });
        if (renderCallback) renderCallback(cachedKeywords);
    }, error => {
        console.error("키워드 로드 실패:", error);
    });
}

async function addKeyword(text) {
    const db = getDb();
    if (!db || !text.trim()) return;
    
    try {
        await db.collection('keywords').add({
            text: text.trim(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("추가 실패:", error);
        alert("추가에 실패했습니다.");
    }
}

async function deleteKeyword(id) {
    const db = getDb();
    if (!db) return;
    try {
        await db.collection('keywords').doc(id).delete();
    } catch (error) {
        console.error("삭제 실패:", error);
        alert("삭제에 실패했습니다.");
    }
}

async function uploadCsvKeywords(file) {
    const db = getDb();
    if (!db) {
        alert("Firebase 연동이 필요합니다.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        // Simple CSV parser
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length === 0) return;
        
        // Remove header if it exists (like "목록" or "keyword")
        if (lines[0].includes('목록') || lines[0].includes('keyword')) {
            lines.shift();
        }

        let addedCount = 0;
        const batch = db.batch();
        let currentBatchSize = 0;

        for (const line of lines) {
            // Remove quotes if any
            const kw = line.replace(/(^"|"$)/g, '').trim();
            if (kw) {
                const docRef = db.collection('keywords').doc();
                batch.set(docRef, {
                    text: kw,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                addedCount++;
                currentBatchSize++;
                
                if (currentBatchSize >= 500) {
                    await batch.commit();
                    currentBatchSize = 0;
                }
            }
        }
        
        if (currentBatchSize > 0) {
            await batch.commit();
        }

        alert(`${addedCount}개의 유의어가 업로드 되었습니다.`);
    };
    reader.readAsText(file, 'UTF-8');
    // If UTF-8 fails with Korean, might need to try EUC-KR, but assume UTF-8 for now.
}

function downloadCsvTemplate() {
    const csvContent = "목록\n예시단어\n(대회)\n시험";
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for Excel UTF-8 BOM
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "기재유의어_양식.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
