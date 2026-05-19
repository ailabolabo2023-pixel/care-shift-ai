
import { ShiftEngine } from './src/logic/ShiftEngine.js';

// Mock Data reproducing the issue environment
const mockData = {
    'マスタ': [
        { '氏名': '荒木', '専属': '〇', '勤務日数/週': 5, '早可': true, '日可': true, '遅可': true },
        { '氏名': '三好', '専属': '〇', '勤務日数/週': 5, '早可': true, '日可': true },
        // Add dummy staff to fill requirements
        ...Array.from({ length: 10 }).map((_, i) => ({ '氏名': `Staff${i}`, '専属': '', '早可': true, '日可': true, '遅可': true }))
    ],
    '要員数': Array.from({ length: 31 }).map((_, i) => ({
        '日付': `2025/10/${String(i + 1).padStart(2, '0')}`,
        '早必要': 2, '日必要': 2, '遅必要': 2, '夜必要': 0
    })),
    '希望': [],
    '繰越': [] // Optional
};

const targetYm = "2025-10";

console.log("=== Starting Verification Test ===");
try {
    const engine = new ShiftEngine(mockData, targetYm, { '2025-10': { monthlyHoliday: 9 } });
    const result = engine.execute();

    if (result.success) {
        console.log("SUCCESS: Engine executed without errors.");

        // Araki check
        const araki = result.table.find(s => s.name === '荒木');
        if (araki) {
            let workDays = 0;
            Object.values(araki.shifts).forEach(SH => {
                if (['早', '日', '遅', '夜'].includes(SH)) workDays++;
            });
            console.log(`CHECK: Araki Work Days: ${workDays}`);
            if (workDays < 18) {
                console.log("FAIL: Araki work days too low (Expected ~20-22)");
            } else {
                console.log("PASS: Araki work days sufficient.");
            }
        } else {
            console.log("FAIL: Araki not found in result.");
        }

    } else {
        console.log("FAIL: Engine returned success=false.");
        console.log("Error:", result.error);
    }
} catch (e) {
    console.log("CRITICAL FAIL: Exception thrown during execution.");
    console.error(e);
}
console.log("=== Test Finished ===");
