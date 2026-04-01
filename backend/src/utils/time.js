const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

function toISTDate(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const base = new Date(`${dateString}T12:00:00+05:30`);
  base.setUTCDate(base.getUTCDate() + days);
  return formatDate(base);
}

function getWeekEnd(weekStart) {
  return addDays(weekStart, 6);
}

function getPurchaseDeadline(weekStart) {
  const purchaseDate = addDays(weekStart, -1);
  return `${purchaseDate}T23:59:00+05:30`;
}

function isBeforeDeadline(deadlineIso, now = new Date()) {
  return now.getTime() <= new Date(deadlineIso).getTime();
}

function getISTWeekday(dateString) {
  return new Date(`${dateString}T12:00:00+05:30`).getUTCDay();
}

function isMonday(dateString) {
  return getISTWeekday(dateString) === 1;
}

function getCurrentISTTimestamp() {
  const now = toISTDate(new Date());
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  const second = String(now.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`;
}

function getCurrentISTDate(date = new Date()) {
  return formatDate(toISTDate(date));
}

function getNextMonday(date = new Date()) {
  const istDate = toISTDate(date);
  const weekday = istDate.getUTCDay();
  const delta = weekday === 1 ? 7 : ((8 - weekday) % 7 || 7);
  istDate.setUTCDate(istDate.getUTCDate() + delta);
  return formatDate(istDate);
}

module.exports = {
  IST_OFFSET_MINUTES,
  addDays,
  getCurrentISTTimestamp,
  getCurrentISTDate,
  getNextMonday,
  getPurchaseDeadline,
  getWeekEnd,
  isBeforeDeadline,
  isMonday
};
