// Shared email styling
const baseStyles = {
    container: "font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;",
    card: "background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;",
    button: (bgColor = "#4CAF50") => 
        `background-color: ${bgColor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;`,
    table: "width: 100%; border-collapse: collapse;",
    tableHeader: "background-color: #eee;",
    tableCell: "padding: 10px; border-bottom: 1px solid #eee;",
};

const getTemplate = (content) => `
    <div style="${baseStyles.container}">
        ${content}
    </div>
`;

module.exports = {
    baseStyles,
    getTemplate
};
