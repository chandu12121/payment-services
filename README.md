# Payment Services API

A robust Node.js-based payment processing service utilizing Razorpay for handling payments and generating invoices. This service includes features for order creation, payment verification, and automated email notifications.

## Features

- **Order Creation**: Securely create orders via Razorpay API.
- **Payment Verification**: Verify payment signatures to ensure transaction integrity.
- **Email Notifications**: Automatically send invoice details to customers upon successful payment.
- **Rate Limiting**: Protect APIs from abuse using express-rate-limit.
- **Logging**: Comprehensive request and error logging using Winston and Morgan.
- **Security**: Enhanced security with messaging via Helmet and CORS configuration.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (Local or Atlas)
- Razorpay Account (Key ID and Secret)
- Gmail Account (for sending notifications via Nodemailer)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd payment-services
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Configuration:**
    Create a `.env` file in the root directory with the following variables:

    ```env
    # Server Configuration
    PORT=3000
    NODE_ENV=development
    ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

    # Database
    MONGO_URI=mongodb://localhost:27017/payment-service

    # Razorpay Credentials
    RAZORPAY_KEY_ID=your_razorpay_key_id
    RAZORPAY_KEY_SECRET=your_razorpay_key_secret

    # Email Configuration (for Nodemailer)
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASS=your_email_app_password
    ```

## Usage

### Development Mode
Run the server with hot-reloading (requires nodemon):
```bash
npm run dev
```

### Production Mode
Start the server:
```bash
npm start
```

## API Endpoints

### Health Check
- **URL**: `/api/payments/health`
- **Method**: `GET`
- **Description**: Checks if the service is operational.

### Create Order
- **URL**: `/api/payments/create-order`
- **Method**: `POST`
- **Body**:
    ```json
    {
      "amount": 500,
      "currency": "INR",
      "receipt": "receipt_123",
      "notes": { "description": "Payment for services" }
    }
    ```

### Verify Payment
- **URL**: `/api/payments/verify-payment`
- **Method**: `POST`
- **Body**:
    ```json
    {
      "razorpay_order_id": "order_Hj...123",
      "razorpay_payment_id": "pay_Hj...456",
      "razorpay_signature": "e98...90a",
      "customer_email": "customer@example.com",
      "customer_name": "John Doe",
      "items": [{ "description": "Service Charge", "amount": 500 }]
    }
    ```

## Project Structure

- `server.js`: Entry point of the application.
- `routes/`: API route definitions.
- `controllers/`: Logic for handling requests.
- `models/`: Mongoose schemas for MongoDB.
- `middlewares/`: Custom middlewares (logging, validation, rate limiting).
- `services/`: External services (Email, etc.).
- `config/`: Configuration files (DB, Razorpay).
- `utils/`: Utility functions (Logger).

## License

ISC
