const express = require("express");
const router = express.Router();
const { authenticate } = require("../middlewares/auth");
const { getUserInvoices, getInvoiceById, downloadInvoice } = require("../controllers/invoices");

// All routes are protected
router.use(authenticate);

router.get("/", getUserInvoices);
router.get("/:id", getInvoiceById);
router.get("/:id/download", downloadInvoice);

module.exports = router;
