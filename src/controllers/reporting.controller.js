const reportingService = require('../services/reporting.service');

class ReportingController {
    /**
     * Download CSV export
     * GET /api/v1/reports/export?type=ORDERS&startDate=2024-01-01&endDate=2024-01-31
     */
    async exportData(req, res, next) {
        try {
            const { type, startDate, endDate } = req.query;

            if (!type || !['ORDERS', 'LEDGER'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid type. Must be ORDERS or LEDGER'
                });
            }

            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    error: 'startDate and endDate are required'
                });
            }

            const start = new Date(startDate);
            const end = new Date(endDate);
            // end set to end of day if only date provided
            end.setHours(23, 59, 59, 999);

            const csv = await reportingService.generateAdminExport(type, start, end);

            const filename = `${type.toLowerCase()}_export_${startDate}_${endDate}.csv`;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

            return res.status(200).send(csv);

        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ReportingController();
