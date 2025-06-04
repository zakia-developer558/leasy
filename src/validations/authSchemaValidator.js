const { z } = require("zod");

// User registration schema
const UserRegistrationSchema = z.object({
  email: z
    .string()
    .email({ message: "Invalid email address" })
    .transform((val) => val.toLowerCase()), // Ensure email is stored in lowercase
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/\d/, { message: "Password must contain at least one number" })
    .regex(/[@$!%*?&#]/, { message: "Password must contain at least one special character" }),
  address: z.string().min(1, { message: "Address must be at least 1 characters long" }).optional(),
  phoneNumber: z
    .string()
    .min(11, { message: "Password must be at least 11 characters long" })
    .optional(),
  onFidoId: z.string().optional(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"), // For ID verification if needed
});

// login validator
const UserLoginSchema = z.object({
  email: z
    .string()
    .email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

// forget password validator
const ForgotPasswordSchema = z.object({
  email: z.string().email({ message: "Invalid email address" })
});

// reset password validator
const ResetPasswordSchema = z.object({
  token: z.string().min(1, { message: "Reset token is required" }),
  newPassword: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/\d/, { message: "Password must contain at least one number" })
    .regex(/[@$!%*?&#]/, { message: "Password must contain at least one special character" })
});

// Export all schemas
module.exports = {
  UserRegistrationSchema,
  UserLoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema
};