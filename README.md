# Rental Management System

A Node.js/Express backend for a rental management application with user authentication, identity verification via Onfido, and MongoDB integration.

## Features

- User authentication (register, login, password reset)
- Email verification
- Identity verification using Onfido
- JWT-based authentication
- MongoDB data storage
- RESTful API endpoints

## Local Development

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example`
4. Run the development server:
   ```
   npm run dev
   ```

## Deployment on Vercel

This project is configured for deployment on Vercel. Follow these steps:

1. Install Vercel CLI:
   ```
   npm i -g vercel
   ```

2. Login to Vercel:
   ```
   vercel login
   ```

3. Deploy to Vercel:
   ```
   vercel
   ```

4. For production deployment:
   ```
   vercel --prod
   ```

### Environment Variables on Vercel

You need to configure the following environment variables in the Vercel dashboard:

- `MONGO_URI`: Your MongoDB connection string
- `JWT_SECRET`: Secret key for JWT authentication
- `SENDGRID_API_KEY`: API key for SendGrid email service
- `SENDGRID_FROM_EMAIL`: Sender email for transactional emails
- `SENDGRID_FROM_NAME`: Sender name for emails
- `FRONTEND_URL`: URL of your frontend application
- `ONFIDO_API_TOKEN`: API token for Onfido identity verification
- `ONFIDO_WEBHOOK_SECRET`: Webhook secret for Onfido
- `ONFIDO_WORKFLOW_ID`: (Optional) Workflow ID if using Onfido workflows

You can set these through the Vercel dashboard or using the CLI:
```
vercel env add MONGO_URI
```

## API Documentation

### Authentication Endpoints

- `POST /api/v1/auth/register`: Register a new user
- `POST /api/v1/auth/login`: Login a user
- `POST /api/v1/auth/forget-password`: Request a password reset
- `POST /api/v1/auth/reset-password`: Reset password with token
- `POST /api/v1/auth/verify-email`: Verify user email
- `POST /api/v1/auth/verify/onfido`: Initiate Onfido verification
- `GET /api/v1/auth/get-profile`: Get user profile
- `POST /api/v1/auth/webhooks/onfido`: Onfido webhook handler