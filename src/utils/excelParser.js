import * as XLSX from 'xlsx';

/**
 * Reads an Excel file and returns all sheets as JSON
 * @param {File} file - The uploaded file
 * @returns {Promise<Object>} - Object with sheet names as keys and array of objects as values
 */
export const readExcelData = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const result = {};

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        result[sheetName] = XLSX.utils.sheet_to_json(sheet);
    });

    return result;
};

/**
 * Validates if the required sheets exist
 * @param {Object} data - The parsed excel data
 * @returns {Object} - { isValid: boolean, missingSheets: string[] }
 */
export const validateSheets = (data) => {
    const requiredSheets = ['マスタ', '希望', '要員数', '月設定'];
    const missing = requiredSheets.filter(sheet => !data[sheet]);

    return {
        isValid: missing.length === 0,
        missingSheets: missing
    };
};
