class CustomError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

class AccountLockedError extends CustomError {
  constructor(lockUntil) {
    super(`Account locked until ${lockUntil}`, 403);
    this.lockUntil = lockUntil;
  }
}

class EmailUnverifiedError extends CustomError {
  constructor() {
    super('Email not verified', 403);
  }
}

class OnfidoPendingError extends CustomError {
  constructor() {
    super('OnFido verification pending', 403);
  }
}

// Export all classes as properties of module.exports
module.exports = {
  CustomError,
  AccountLockedError,
  EmailUnverifiedError,
  OnfidoPendingError
};