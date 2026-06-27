export const excelSerialToDate = (serial) => {
    // Excel base date is Dec 30, 1899 for Mac/Windows compatibility adjustment often used
    // Actually typically Dec 30 1899 + serial days
    // JS Date is ms since Jan 1 1970.
    // Excel serial 1 = 1900-01-01.
    // 25569 is diff between 1970-01-01 and 1900-01-01
    if (!serial || isNaN(serial)) return null;
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);

    // Adjust for timezone offset if needed, but usually just taking UTC parts is safer for "date only"
    // simplistic approach:
    const d = new Date((serial - 25569) * 86400 * 1000);
    // Add timezone offset to force it to return correct local YMD if we consider serial as "Local midnight"
    // But simplest is to just use UTC methods if we want strict date? 
    // Let's stick to a robust simple consturct that gives us correct YYYY/MM/DD
    return new Date(1900, 0, serial - 1);
};

export const formatDate = (date) => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    return `${y}/${m}/${d}`;
};

export const getDayOfWeek = (date) => {
    if (!date) return "";
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return days[date.getDay()];
};

export const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

// String parser "YYYY/MM/DD" or "YYYY-MM-DD"
export const parseDateString = (str) => {
    if (!str) return null;
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d;
};
