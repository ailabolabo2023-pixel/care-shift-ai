import XLSX from 'xlsx-js-style';

try {
    console.log("XLSX object keys:", Object.keys(XLSX));
    if (!XLSX.utils) {
        console.error("XLSX.utils is missing!");
    } else {
        console.log("XLSX.utils exists.");

        const data = [
            [{ v: "Test", s: { font: { bold: true } } }, "Normal"]
        ];

        console.log("Attempting aoa_to_sheet with objects...");
        const ws = XLSX.utils.aoa_to_sheet(data);
        console.log("Sheet created.");

        // Check cell value
        const cellA1 = ws['A1'];
        console.log("Cell A1:", cellA1);

        if (cellA1 && cellA1.v === "Test" && cellA1.s) {
            console.log("Success: Cell object preserved.");
        } else {
            console.log("Warning: Cell object might not be preserved or recognized.");
            // Standard SheetJS aoa_to_sheet does NOT support cell objects in the AOA.
            // It expects values.
        }
    }
} catch (e) {
    console.error("Crash:", e);
}
