const jwt = require("jsonwebtoken");
const { getConfig } = require("../utils/config");

function authMiddleware() {
  const { jwtSecret } = getConfig();

  return (req, res, next) => {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Missing or invalid authorization header"
      });
    }

    const token = header.slice("Bearer ".length);

    try {
      const payload = jwt.verify(token, jwtSecret);
      req.user = payload;
      return next();
    } catch (error) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Missing or invalid authorization header"
      });
    }
  };
}

module.exports = {
  authMiddleware
};
