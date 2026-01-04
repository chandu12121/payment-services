const express = require("express");
const router = express.Router();
const mailService = require("../services/emailNotification")
const authenticate = require("../../../OneDrive/Desktop/My-Projects/payment-gateway-services/middleware/authenticate")

router.post("/notifications", mailService)

module.exports = router
