const Invoice = require("../models/Invoice");
const PDFDocument = require('pdfkit');
const logger = require("../utils/logger");

// Get all invoices for the current user
const getUserInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .populate('bookingId', 'bookingNumber bookingType');

        return res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        logger.error(`Get Invoices Error: ${error.message}`);
        return res.status(500).json({ success: false, error: "Failed to fetch invoices" });
    }
};

// Get single invoice details
const getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            _id: req.params.id,
            userId: req.user.userId
        });

        if (!invoice) {
            return res.status(404).json({ success: false, error: "Invoice not found" });
        }

        return res.status(200).json({ success: true, data: invoice });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Download Invoice PDF
const downloadInvoice = async (req, res) => {
    let doc;
    try {
        const { id } = req.params;
        const query = { userId: req.user.userId };

        const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
        if (isObjectId) {
            query._id = id;
        } else {
            query.invoiceNumber = id;
        }

        const invoice = await Invoice.findOne(query);

        if (!invoice) {
            return res.status(404).json({ success: false, error: "Invoice not found" });
        }

        // Helper to format currency safely
        const formatAmount = (val) => {
            if (val === undefined || val === null) return "0.00";
            if (typeof val === 'number') return val.toFixed(2);
            if (typeof val === 'string') {
                const parsed = parseFloat(val);
                return isNaN(parsed) ? val : parsed.toFixed(2);
            }
            return "0.00";
        };

        doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);

        doc.pipe(res);

        // --- Header ---
        doc.fillColor('#444444')
            .fontSize(20)
            .text('PAYMENT INVOICE', 50, 57)
            .fontSize(10)
            .text(process.env.COMPANY_NAME || 'PayFlow Pro', 200, 50, { align: 'right' })
            .text(process.env.COMPANY_ADDRESS || '123 Tech Park', 200, 65, { align: 'right' })
            .text(process.env.COMPANY_CITY || 'Bangalore, India', 200, 80, { align: 'right' })
            .moveDown();

        // --- Divider ---
        doc.moveTo(50, 100).lineTo(550, 100).strokeColor('#aaaaaa').stroke();

        // --- Customer & Invoice Details ---
        const customer = invoice.customerDetails || {};

        doc.fontSize(10).fillColor('#000000');
        doc.text(`Invoice Number: ${invoice.invoiceNumber || 'N/A'}`, 50, 110);
        doc.text(`Invoice Date: ${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}`, 50, 125);
        doc.text(`Status: ${(invoice.status || 'paid').toUpperCase()}`, 50, 140);

        doc.text(`Bill To:`, 300, 110);
        doc.text(customer.name || 'Guest User', 300, 125);
        doc.text(customer.email || 'N/A', 300, 140);
        if (customer.taxId) doc.text(`Tax ID: ${customer.taxId}`, 300, 155);

        doc.moveDown();

        // --- Items Table Header ---
        const tableTop = 200;
        doc.font("Helvetica-Bold");
        doc.text("Item", 50, tableTop);
        doc.text("Quantity", 300, tableTop, { width: 90, align: "right" });
        doc.text("Price", 400, tableTop, { width: 90, align: "right" });
        doc.text("Total", 500, tableTop, { width: 50, align: "right" });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        doc.font("Helvetica");

        // --- Items List ---
        let y = tableTop + 25;
        const items = invoice.items || [];

        items.forEach(item => {
            doc.text(item.description || "Service Payment", 50, y);
            doc.text(item.quantity || 1, 300, y, { width: 90, align: "right" });
            doc.text(formatAmount(item.unitPrice || item.totalAmount), 400, y, { width: 90, align: "right" });
            doc.text(formatAmount(item.totalAmount), 500, y, { width: 50, align: "right" });
            y += 20;
        });

        doc.moveTo(50, y).lineTo(550, y).stroke();

        // --- Totals ---
        y += 15;
        doc.font("Helvetica-Bold");
        doc.text("Subtotal:", 400, y, { width: 90, align: "right" });
        doc.text(formatAmount(invoice.subtotal || invoice.totalAmount), 500, y, { width: 50, align: "right" });

        y += 15;
        doc.text("Tax:", 400, y, { width: 90, align: "right" });
        doc.text(formatAmount(invoice.taxAmount || 0), 500, y, { width: 50, align: "right" });

        y += 20;
        doc.fontSize(12).text("Total:", 400, y, { width: 90, align: "right" });
        doc.text(formatAmount(invoice.totalAmount), 500, y, { width: 50, align: "right" });

        // --- Footer ---
        doc.fontSize(10).font("Helvetica");
        doc.text("Thank you for your business.", 50, 700, { align: "center", width: 500 });

        doc.end();

    } catch (error) {
        logger.error(`Download Invoice Error: ${error.message}`);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, error: error.message });
        } else {
            // Document might be in a broken state, just end it
            if (doc) {
                try { doc.end(); } catch (e) { }
            }
        }
    }
};

module.exports = {
    getUserInvoices,
    getInvoiceById,
    downloadInvoice
};
