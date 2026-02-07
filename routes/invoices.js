const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { getUserInvoices, getInvoiceById, downloadInvoice } = require("../controllers/invoices");

// Download endpoint is public (for email links) - no auth required
router.get("/:id/download", downloadInvoice);

// All other routes are protected
router.use(authenticate);

router.get("/", getUserInvoices);
router.get("/:id", getInvoiceById);

module.exports = router;
