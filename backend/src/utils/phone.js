function normalizePhone(phone) {
  const raw = typeof phone === "string" ? phone.trim() : "";

  if (!raw) {
    return "";
  }

  if (raw.startsWith("+")) {
    return /^\+\d{10,15}$/.test(raw) ? raw : "";
  }

  if (/^\d{10}$/.test(raw)) {
    return `+91${raw}`;
  }

  return "";
}

function isNormalizedPhone(phone) {
  return /^\+\d{10,15}$/.test(phone);
}

module.exports = {
  normalizePhone,
  isNormalizedPhone
};
